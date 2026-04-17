import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getStripePublishableKey from '@salesforce/apex/CheckoutController.getStripePublishableKey';
import getCheckoutSummary from '@salesforce/apex/CheckoutController.getCheckoutSummary';
import createPaymentIntent from '@salesforce/apex/CheckoutController.createPaymentIntent';
import placeOrder from '@salesforce/apex/CheckoutController.placeOrder';

const DELIVERY_FEE = 9.95;
const STRIPE_JS_URL = 'https://js.stripe.com/v3/';

export default class Checkout extends NavigationMixin(LightningElement) {

    // UI state
    @track isLoading = true;
    @track isPlacing = false;
    @track orderPlaced = false;
    @track stripeReady = false;
    @track errorMessage = '';
    @track placingLabel = 'Processing...';

    // Order data
    @track orderId = '';
    @track cartItems = [];
    @track subtotal = 0;
    @track memberSavings = 0;
    @track isMember = false;

    // Form fields
    @track fulfilmentType = 'Delivery';
    @track deliveryStreet = '';
    @track deliverySuburb = '';
    @track deliveryPostcode = '';
    @track deliveryNotes = '';
    @track ageVerified = false;

    // Stripe internals
    _stripe = null;
    _cardElement = null;
    _clientSecret = null;

    // ─── LIFECYCLE ────────────────────────────────────────────────────────────

    connectedCallback() {
        this.loadStripeJs();
        this.loadSummary();
    }

    // ─── STRIPE.JS LOADER ─────────────────────────────────────────────────────

    loadStripeJs() {
        if (document.querySelector(`script[src="${STRIPE_JS_URL}"]`)) {
            // Already injected — initialise immediately
            this.initStripe();
            return;
        }
        const script = document.createElement('script');
        script.src = STRIPE_JS_URL;
        script.onload = () => this.initStripe();
        script.onerror = () => {
            this.errorMessage = 'Could not load payment form. Please refresh and try again.';
        };
        document.head.appendChild(script);
    }

    initStripe() {
        getStripePublishableKey()
            .then(publishableKey => {
                // eslint-disable-next-line no-undef
                this._stripe = Stripe(publishableKey);
                const elements = this._stripe.elements();

                this._cardElement = elements.create('card', {
                    style: {
                        base: {
                            fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                            fontSize: '15px',
                            color: '#333333',
                            '::placeholder': { color: '#aab7c4' }
                        },
                        invalid: { color: '#c62828' }
                    },
                    hidePostalCode: true
                });

                // Mount into the div rendered by the template
                const mountTarget = this.template.querySelector('.stripe-card-input');
                if (mountTarget) {
                    this._cardElement.mount(mountTarget);
                    this._cardElement.on('change', event => {
                        const errEl = this.template.querySelector('.stripe-card-errors');
                        if (errEl) {
                            errEl.textContent = event.error ? event.error.message : '';
                        }
                    });
                    this.stripeReady = true;
                }
            })
            .catch(err => {
                console.error('Stripe init error:', err);
                this.errorMessage = 'Could not initialise payment form. Please refresh and try again.';
            });
    }

    // ─── LOAD CART SUMMARY ────────────────────────────────────────────────────

    loadSummary() {
        this.isLoading = true;
        getCheckoutSummary()
            .then(data => {
                if (!data) { this.cartItems = []; return; }
                const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
                this.isMember = data.isMember;
                this.subtotal = data.subtotal;
                this.memberSavings = data.memberSavings;
                this.cartItems = data.items.map(item => ({
                    ...item,
                    formattedLineTotal: fmt.format(item.lineTotal)
                }));
            })
            .catch(error => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error loading checkout',
                    message: error.body ? error.body.message : 'Something went wrong.',
                    variant: 'error'
                }));
            })
            .finally(() => { this.isLoading = false; });
    }

    // ─── COMPUTED GETTERS ─────────────────────────────────────────────────────

    get fmt() {
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
    }

    get isDelivery() { return this.fulfilmentType === 'Delivery'; }
    get hasItems() { return this.cartItems && this.cartItems.length > 0; }
    get hasMemberSavings() { return this.memberSavings > 0; }
    get formattedSubtotal() { return this.fmt.format(this.subtotal); }
    get formattedMemberSavings() { return this.fmt.format(this.memberSavings); }

    get totalAmount() {
        return this.subtotal + (this.isDelivery ? DELIVERY_FEE : 0);
    }

    get formattedTotal() {
        return this.fmt.format(this.totalAmount);
    }

    // Stripe needs amount in cents (no decimals)
    get totalAmountCents() {
        return Math.round(this.totalAmount * 100);
    }

    get deliveryBtnClass() {
        return this.isDelivery ? 'fulfilment-btn fulfilment-btn--active' : 'fulfilment-btn';
    }

    get collectBtnClass() {
        return this.fulfilmentType === 'ClickAndCollect'
            ? 'fulfilment-btn fulfilment-btn--active'
            : 'fulfilment-btn';
    }

    get paymentStepLabel() { return this.isDelivery ? '3' : '2'; }
    get ageStepLabel() { return this.isDelivery ? '4' : '3'; }

    // ─── FORM HANDLERS ────────────────────────────────────────────────────────

    handleSelectDelivery() { this.fulfilmentType = 'Delivery'; this.errorMessage = ''; }
    handleSelectCollect() { this.fulfilmentType = 'ClickAndCollect'; this.errorMessage = ''; }

    handleFieldChange(event) {
        this[event.target.dataset.field] = event.target.value;
    }

    handleAgeVerify(event) {
        this.ageVerified = event.target.checked;
    }

    // ─── PLACE ORDER FLOW ─────────────────────────────────────────────────────

    handlePlaceOrder() {
        this.errorMessage = '';

        // Client-side validation
        if (!this.hasItems) { this.errorMessage = 'Your cart is empty.'; return; }

        if (this.isDelivery) {
            if (!this.deliveryStreet.trim()) { this.errorMessage = 'Please enter your street address.'; return; }
            if (!this.deliverySuburb.trim()) { this.errorMessage = 'Please enter your suburb.'; return; }
            if (!this.deliveryPostcode.trim() || !/^\d{4}$/.test(this.deliveryPostcode)) {
                this.errorMessage = 'Please enter a valid 4-digit postcode.'; return;
            }
        }

        if (!this.ageVerified) {
            this.errorMessage = 'Please confirm you are 18 years or older.'; return;
        }

        if (!this._stripe || !this._cardElement) {
            this.errorMessage = 'Payment form is not ready yet. Please wait a moment and try again.'; return;
        }

        this.isPlacing = true;
        this.placingLabel = 'Setting up payment...';

        // Step 1: Create PaymentIntent in Salesforce → get client_secret
        createPaymentIntent({ amountCents: this.totalAmountCents })
            .then(clientSecret => {
                this._clientSecret = clientSecret;
                this.placingLabel = 'Confirming payment...';

                // Step 2: Confirm the card payment with Stripe.js (handles 3DS automatically)
                return this._stripe.confirmCardPayment(clientSecret, {
                    payment_method: { card: this._cardElement }
                });
            })
            .then(result => {
                if (result.error) {
                    // Stripe declined or card error — show Stripe's message
                    throw new Error(result.error.message);
                }

                if (result.paymentIntent.status !== 'succeeded') {
                    throw new Error('Payment did not complete. Please try again.');
                }

                this.placingLabel = 'Placing your order...';

                // Step 3: Payment confirmed — create the order in Salesforce
                return placeOrder({
                    paymentIntentId: result.paymentIntent.id,
                    fulfilmentType: this.fulfilmentType,
                    deliveryStreet: this.deliveryStreet,
                    deliverySuburb: this.deliverySuburb,
                    deliveryState: 'VIC',
                    deliveryPostcode: this.deliveryPostcode,
                    deliveryNotes: this.deliveryNotes
                });
            })
            .then(newOrderId => {
                this.orderId = newOrderId;
                this.orderPlaced = true;
            })
            .catch(error => {
                // Could be a Stripe client error (Error object) or Apex AuraHandledException
                this.errorMessage = error.message || (error.body ? error.body.message : 'Something went wrong. Please try again.');
            })
            .finally(() => {
                this.isPlacing = false;
                this.placingLabel = 'Processing...';
            });
    }

    handleContinueShopping() {
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: { name: 'Home' }
        });
    }
}