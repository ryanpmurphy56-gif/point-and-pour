public without sharing class CartController {

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

    @AuraEnabled
    public static Cart__c getOrCreateCart(String uid) {
        List<Cart__c> existing = [
            SELECT Id FROM Cart__c
            WHERE (OwnerId = :UserInfo.getUserId() OR Temporary_OwnerId__c = :uid)
            AND Status__c = 'Active'
            LIMIT 1
        ];
        if (!existing.isEmpty()) return existing[0];
        Cart__c newCart = new Cart__c(Status__c = 'Active', Temporary_OwnerId__c = uid);
        insert newCart;
        return newCart;
    }

    @AuraEnabled(cacheable=false)
    public static List<CartItemWrapper> getCartItems(String uid) {
        Cart__c cart = getOrCreateCart(uid);
        Boolean memberStatus = isMember();

        List<Cart_Item__c> items = [
            SELECT Id, Product__c, Product__r.Name, Product__r.Price__c,
                   Product__r.Members_Price_Individual__c,
                   Product__r.Product_Image_Field__c,
                   Product__r.Quantity_on_Hand__c,
                   Quantity__c, Line_Total__c
            FROM Cart_Item__c
            WHERE Cart__c = :cart.Id
            ORDER BY CreatedDate ASC
        ];

        List<CartItemWrapper> wrapped = new List<CartItemWrapper>();
        for (Cart_Item__c item : items) {
            CartItemWrapper w = new CartItemWrapper();
            w.Id = item.Id;
            w.ProductId = item.Product__c;
            w.Qty = item.Quantity__c;
            w.LineTotal = item.Line_Total__c;
            w.ProductName = item.Product__r.Name;
            w.ProductImage = item.Product__r.Product_Image_Field__c;
            w.QuantityOnHand = item.Product__r.Quantity_on_Hand__c;
            w.RegularPrice = item.Product__r.Price__c;
            w.MemberPrice = memberStatus ? item.Product__r.Members_Price_Individual__c : null;
            w.IsMember = memberStatus;
            wrapped.add(w);
        }
        return wrapped;
    }

    @AuraEnabled
    public static void addToCart(Id productId,String uid) {
        Cart__c cart = getOrCreateCart(uid);
        Product2 product = [
            SELECT Id, Quantity_on_Hand__c FROM Product2 WHERE Id = :productId
        ];
        List<Cart_Item__c> existing = [
            SELECT Id, Quantity__c FROM Cart_Item__c
            WHERE Cart__c = :cart.Id AND Product__c = :productId
            LIMIT 1
        ];
        if (!existing.isEmpty()) {
            Cart_Item__c item = existing[0];
            Decimal newQty = item.Quantity__c + 1;
            if (product.Quantity_on_Hand__c != null && newQty > product.Quantity_on_Hand__c) {
                throw new AuraHandledException('Sorry, not enough stock available.');
            }
            item.Quantity__c = newQty;

            update item;
        } else {
            if (product.Quantity_on_Hand__c != null && product.Quantity_on_Hand__c < 1) {
                throw new AuraHandledException('Sorry, this product is out of stock.');
            }
            insert new Cart_Item__c(
                Cart__c = cart.Id,
                Product__c = productId,
                Quantity__c = 1
            );
        }
    }

    @AuraEnabled
    public static void updateQuantity(Id cartItemId, Decimal newQuantity) {
        Cart_Item__c item = [SELECT Id, Product__c FROM Cart_Item__c WHERE Id = :cartItemId LIMIT 1];
        Product2 product = [SELECT Quantity_on_Hand__c FROM Product2 WHERE Id = :item.Product__c LIMIT 1];
        if (product.Quantity_on_Hand__c != null && newQuantity > product.Quantity_on_Hand__c) {
            throw new AuraHandledException('Sorry, not enough stock available.');
        }
        if (newQuantity <= 0) {
            delete item;
        } else {
            item.Quantity__c = newQuantity;
            update item;
        }
    }

    @AuraEnabled
    public static void removeFromCart(Id cartItemId) {
        delete [SELECT Id FROM Cart_Item__c WHERE Id = :cartItemId LIMIT 1];
    }

    @AuraEnabled(cacheable=false)
    public static Integer getCartCount(String uid) {
        Cart__c cart = getOrCreateCart(uid);
        AggregateResult[] results = [
            SELECT SUM(Quantity__c) total FROM Cart_Item__c WHERE Cart__c = :cart.Id
        ];
        if (results.isEmpty() || results[0].get('total') == null) return 0;
        return Integer.valueOf(results[0].get('total'));
    }

    @AuraEnabled(cacheable=true)
    public static Boolean checkIsMember() {
        return isMember();
    }

    public class CartItemWrapper {
        @AuraEnabled public String Id;
        @AuraEnabled public String ProductId;
        @AuraEnabled public Decimal Qty;
        @AuraEnabled public Decimal LineTotal;
        @AuraEnabled public String ProductName;
        @AuraEnabled public String ProductImage;
        @AuraEnabled public Decimal QuantityOnHand;
        @AuraEnabled public Decimal RegularPrice;
        @AuraEnabled public Decimal MemberPrice;
        @AuraEnabled public Boolean IsMember;
    }
}