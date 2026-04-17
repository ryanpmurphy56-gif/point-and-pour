/**
 * CheckoutController
 * Handles checkout summary, Stripe PaymentIntent creation, and order placement.
 *
 * Prerequisites in Salesforce Setup:
 *  1. Named Credential  → "Stripe_API"
 *       URL: https://api.stripe.com
 *       Auth Protocol: Password Authentication
 *       Username: your Stripe secret key (sk_live_... or sk_test_...)
 *       Password: (leave blank)
 *  2. Remote Site Setting → https://api.stripe.com  (enabled)
 *  3. CSP Trusted Sites   → https://js.stripe.com   (for Stripe.js to load in LWC)
 *                         → https://hooks.stripe.com (for 3DS if triggered)
 *  4. Custom Metadata Type → Stripe_Settings__mdt with one record:
 *       DeveloperName: Default
 *       Publishable_Key__c: pk_live_... (or pk_test_...)
 */
public with sharing class CheckoutController {

    // ─── STRIPE PUBLISHABLE KEY (safe to expose to LWC) ──────────────────────

    @AuraEnabled(cacheable=true)
    public static String getStripePublishableKey() {
        List<Stripe_Settings__mdt> settings = [
            SELECT Publishable_Key__c
            FROM Stripe_Settings__mdt
            WHERE DeveloperName = 'Default'
            LIMIT 1
        ];
        if (settings.isEmpty()) {
            throw new AuraHandledException('Stripe configuration not found. Please set up Stripe_Settings__mdt.');
        }
        return settings[0].Publishable_Key__c;
    }

    // ─── GET CART SUMMARY FOR CHECKOUT PAGE ───────────────────────────────────

    @AuraEnabled(cacheable=false)
    public static CheckoutSummary getCheckoutSummary() {
        Cart__c cart = getActiveCart();
        if (cart == null) return null;

        Boolean memberStatus = isMember();

        List<Cart_Item__c> items = [
            SELECT Id, Product__c, Product__r.Name, Product__r.Price__c,
                   Product__r.Members_Price_Individual__c,
                   Product__r.Product_Image_Field__c,
                   Quantity__c, Line_Total__c
            FROM Cart_Item__c
            WHERE Cart__c = :cart.Id
            ORDER BY CreatedDate ASC
        ];

        CheckoutSummary summary = new CheckoutSummary();
        summary.cartId = cart.Id;
        summary.isMember = memberStatus;
        summary.items = new List<CheckoutItemWrapper>();

        Decimal subtotal = 0;
        Decimal memberSavings = 0;

        for (Cart_Item__c item : items) {
            CheckoutItemWrapper w = new CheckoutItemWrapper();
            w.cartItemId = item.Id;
            w.productName = item.Product__r.Name;
            w.productImage = item.Product__r.Product_Image_Field__c;
            w.quantity = item.Quantity__c;
            w.regularPrice = item.Product__r.Price__c;
            w.memberPrice = memberStatus ? item.Product__r.Members_Price_Individual__c : null;

            Decimal activePrice = (memberStatus && w.memberPrice != null && w.memberPrice > 0)
                ? w.memberPrice
                : w.regularPrice;
            w.lineTotal = activePrice * w.quantity;

            if (memberStatus && w.memberPrice != null && w.memberPrice < w.regularPrice) {
                memberSavings += (w.regularPrice - w.memberPrice) * w.quantity;
            }

            subtotal += w.lineTotal;
            summary.items.add(w);
        }

        summary.subtotal = subtotal;
        summary.memberSavings = memberSavings;
        summary.total = subtotal;
        return summary;
    }

    // ─── CREATE STRIPE PAYMENT INTENT ─────────────────────────────────────────
    // Called before the customer fills in card details.
    // Returns the client_secret which Stripe.js uses to confirm the payment.

    @AuraEnabled
    public static String createPaymentIntent(Integer amountCents) {
        if (amountCents == null || amountCents <= 0) {
            throw new AuraHandledException('Invalid payment amount.');
        }

        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:Stripe_API/v1/payment_intents');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/x-www-form-urlencoded');
        req.setBody(
            'amount=' + amountCents +
            '&currency=aud' +
            '&automatic_payment_methods[enabled]=true' +
            '&automatic_payment_methods[allow_redirects]=never'
        );

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() != 200) {
            Map<String, Object> errBody = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            Map<String, Object> err = (Map<String, Object>) errBody.get('error');
            String msg = err != null ? (String) err.get('message') : 'Stripe error.';
            throw new AuraHandledException('Payment setup failed: ' + msg);
        }

        Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        return (String) result.get('client_secret');
    }

    // ─── PLACE ORDER (called only after Stripe confirms payment) ──────────────

    @AuraEnabled
    public static String placeOrder(
        String paymentIntentId,
        String fulfilmentType,
        String deliveryStreet,
        String deliverySuburb,
        String deliveryState,
        String deliveryPostcode,
        String deliveryNotes
    ) {
        // Double-check with Stripe that the payment actually succeeded
        verifyPaymentIntent(paymentIntentId);

        Cart__c cart = getActiveCart();
        if (cart == null) throw new AuraHandledException('No active cart found.');

        Boolean memberStatus = isMember();

        List<Cart_Item__c> items = [
            SELECT Id, Product__c, Product__r.Name, Product__r.Price__c,
                   Product__r.Members_Price_Individual__c,
                   Quantity__c
            FROM Cart_Item__c
            WHERE Cart__c = :cart.Id
        ];

        if (items.isEmpty()) throw new AuraHandledException('Your cart is empty.');

        Decimal orderTotal = 0;
        Decimal deliveryFee = fulfilmentType == 'Delivery' ? 9.95 : 0;

        for (Cart_Item__c item : items) {
            Decimal price = (memberStatus
                && item.Product__r.Members_Price_Individual__c != null
                && item.Product__r.Members_Price_Individual__c > 0)
                ? item.Product__r.Members_Price_Individual__c
                : item.Product__r.Price__c;
            orderTotal += price * item.Quantity__c;
        }
        orderTotal += deliveryFee;

        Order order = new Order(
            Status__c = 'Confirmed',
            Fulfilment_Type__c = fulfilmentType,
            Order_Total__c = orderTotal,
            Delivery_Fee__c = deliveryFee,
            Stripe_Payment_Intent_Id__c = paymentIntentId,
            Age_Verification__c = true
        );

        if (fulfilmentType == 'Delivery') {
            order.Delivery_Street__c = deliveryStreet;
            order.Delivery_Suburb__c = deliverySuburb;
            order.Delivery_State__c = deliveryState;
            order.Delivery_Postcode__c = deliveryPostcode;
            order.Delivery_Notes__c = deliveryNotes;
        }

        try {
            insert order;

            List<Order_Item__c> orderItems = new List<Order_Item__c>();
            for (Cart_Item__c item : items) {
                Decimal unitPrice = (memberStatus
                    && item.Product__r.Members_Price_Individual__c != null
                    && item.Product__r.Members_Price_Individual__c > 0)
                    ? item.Product__r.Members_Price_Individual__c
                    : item.Product__r.Price__c;

                orderItems.add(new Order_Item__c(
                    Order__c = order.Id,
                    Product__c = item.Product__c,
                    Product_Name__c = item.Product__r.Name,
                    Quantity__c = item.Quantity__c,
                    Unit_Price__c = unitPrice,
                    Line_Total__c = unitPrice * item.Quantity__c
                ));
            }
            insert orderItems;

            cart.Status__c = 'Completed';
            update cart;

            return order.Id;

        } catch (Exception e) {
            throw new AuraHandledException('Failed to place order: ' + e.getMessage());
        }
    }

    // ─── VERIFY PAYMENT INTENT STATUS WITH STRIPE ─────────────────────────────

    private static void verifyPaymentIntent(String paymentIntentId) {
        if (String.isBlank(paymentIntentId)) {
            throw new AuraHandledException('Missing payment reference.');
        }

        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:Stripe_API/v1/payment_intents/' + paymentIntentId);
        req.setMethod('GET');

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() != 200) {
            throw new AuraHandledException('Could not verify payment. Please contact support.');
        }

        Map<String, Object> intent = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        String status = (String) intent.get('status');

        if (status != 'succeeded') {
            throw new AuraHandledException('Payment has not been completed (status: ' + status + ').');
        }
    }

    // ─── HELPERS ──────────────────────────────────────────────────────────────

    private static Cart__c getActiveCart() {
        List<Cart__c> carts = [
            SELECT Id FROM Cart__c
            WHERE OwnerId = :UserInfo.getUserId()
            AND Status__c = 'Active'
            LIMIT 1
        ];
        return carts.isEmpty() ? null : carts[0];
    }

    private static Boolean isMember() {
        Id userId = UserInfo.getUserId();
        List<User> u = [SELECT AccountId FROM User WHERE Id = :userId LIMIT 1];
        if (u.isEmpty() || u[0].AccountId == null) return false;
        List<Members_Card__c> cards = [
            SELECT Id FROM Members_Card__c
            WHERE Account__c = :u[0].AccountId
            AND Expiry_Date__c >= TODAY
            LIMIT 1
        ];
        return !cards.isEmpty();
    }

    // ─── WRAPPER CLASSES ──────────────────────────────────────────────────────

    public class CheckoutSummary {
        @AuraEnabled public String cartId;
        @AuraEnabled public Boolean isMember;
        @AuraEnabled public List<CheckoutItemWrapper> items;
        @AuraEnabled public Decimal subtotal;
        @AuraEnabled public Decimal memberSavings;
        @AuraEnabled public Decimal total;
    }

    public class CheckoutItemWrapper {
        @AuraEnabled public String cartItemId;
        @AuraEnabled public String productName;
        @AuraEnabled public String productImage;
        @AuraEnabled public Decimal quantity;
        @AuraEnabled public Decimal regularPrice;
        @AuraEnabled public Decimal memberPrice;
        @AuraEnabled public Decimal lineTotal;
    }
}