import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin, CurrentPageReference } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { publish, MessageContext } from 'lightning/messageService';
import PRODUCT_CHANNEL from '@salesforce/messageChannel/ProductFilters__c';
import getProductById from '@salesforce/apex/ProductGridController.getProductById';
import addToCart from '@salesforce/apex/CartController.addToCart';
import getCartItems from '@salesforce/apex/CartController.getCartItems';
import getCartCount from '@salesforce/apex/CartController.getCartCount';
import checkIsMember from '@salesforce/apex/CartController.checkIsMember';

export default class ProductDetail extends NavigationMixin(LightningElement) {
    @track product;
    @track productId;
    @track quantity = 1;
    @track isAdding = false;
    @track showCartPopup = false;
    @track cartItems = [];
    @track cartCount = 0;
    @track isMember = false;

    @wire(MessageContext) messageContext;

    @wire(CurrentPageReference)
    pageRef(ref) {
        if (ref && ref.state && ref.state.productId) {
            this.productId = ref.state.productId;
        }
    }

    @wire(getProductById, { productId: '$productId' })
    wiredProduct({ data, error }) {
        if (data) {
            const reg = Number(data.Price__c);
            const mem = Number(data.Members_Price_Individual__c);
            this.product = {
                ...data,
                _showOfferRibbon: reg > 0 && mem > 0 && mem < reg
            };
        } else if (error) {
            console.error(error);
        }
    }

    @wire(checkIsMember)
    wiredMember({ data }) {
        if (data !== undefined) this.isMember = data;
    }

    get fmt() {
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
    }

    get formattedRegular() {
        return this.product && this.product.Price__c ? this.fmt.format(this.product.Price__c) : '';
    }

    get formattedMember() {
        return this.product && this.product.Members_Price_Individual__c
            ? this.fmt.format(this.product.Members_Price_Individual__c) : '';
    }

    get formattedSavings() {
        if (this.product && this.product.Price__c && this.product.Members_Price_Individual__c) {
            return this.fmt.format(this.product.Price__c - this.product.Members_Price_Individual__c);
        }
        return '';
    }

    get showMemberPrice() {
        return this.isMember &&
               this.product &&
               this.product.Members_Price_Individual__c &&
               this.product.Members_Price_Individual__c < this.product.Price__c;
    }

    get showMemberPromo() {
        return !this.isMember &&
               this.product &&
               this.product.Members_Price_Individual__c &&
               this.product.Members_Price_Individual__c < this.product.Price__c;
    }

    get activePrice() {
        if (this.showMemberPrice) return this.product.Members_Price_Individual__c;
        return this.product ? this.product.Price__c : 0;
    }

    get formattedLineTotal() {
        return this.fmt.format(this.activePrice * this.quantity);
    }

    get showLineTotal() { return this.quantity > 1; }
    get inStock() { return this.product && this.product.Quantity_on_Hand__c > 0; }
    get isLowStock() { return this.product && this.product.Quantity_on_Hand__c > 0 && this.product.Quantity_on_Hand__c <= 5; }
    get addDisabled() { return !this.inStock || this.isAdding; }
    get isQtyMin() { return this.quantity <= 1; }
    get isQtyMax() {
        return this.product && this.product.Quantity_on_Hand__c &&
               this.quantity >= this.product.Quantity_on_Hand__c;
    }

    handleIncreaseQty() { if (!this.isQtyMax) this.quantity++; }
    handleDecreaseQty() { if (this.quantity > 1) this.quantity--; }

    handleAddToCart() {
        if (!this.inStock) return;
        this.isAdding = true;

        const addPromises = [];
        for (let i = 0; i < this.quantity; i++) {
            addPromises.push(addToCart({ productId: this.productId }));
        }

        Promise.all(addPromises)
            .then(() => getCartItems())
            .then(cartData => {
                const fmt = this.fmt;
                this.cartItems = cartData.map(item => ({
                    ...item,
                    _qty: Number(item.Quantity__c),
                    _formattedTotal: fmt.format(
                        Number(item.Quantity__c) *
                        Number(item.MemberPrice || item.RegularPrice)
                    )
                }));
                this.showCartPopup = true;
                return getCartCount();
            })
            .then(count => {
                this.cartCount = count;
                publish(this.messageContext, PRODUCT_CHANNEL, { cartCount: count });
                this.isAdding = false;
                this.quantity = 1;
                setTimeout(() => { this.showCartPopup = false; }, 5000);
            })
            .catch(error => {
                this.isAdding = false;
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error',
                    message: error.body ? error.body.message : 'Could not add to cart.',
                    variant: 'error'
                }));
            });
    }

    handleClosePopup() { this.showCartPopup = false; }

    handleViewCart() {
        this.showCartPopup = false;
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url: '/cart' }
        });
    }

    handleBack() { history.back(); }

    handleSignUp() {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url: '/login' }
        });
    }
}