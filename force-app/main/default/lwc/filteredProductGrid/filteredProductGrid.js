import { LightningElement, track, wire, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { publish, subscribe, MessageContext } from 'lightning/messageService';
import PRODUCT_CHANNEL from '@salesforce/messageChannel/ProductFilters__c';
import getProductsByFamily from '@salesforce/apex/ProductGridController.getProductsByFamily';
import addToCart from '@salesforce/apex/CartController.addToCart';
import getCartItems from '@salesforce/apex/CartController.getCartItems';
import getCartCount from '@salesforce/apex/CartController.getCartCount';

export default class FilteredProductGrid extends NavigationMixin(LightningElement) {
    @api selectedFamily = '';
    @track products = [];
    @track selectedSubFamily = '';
    @track searchKey = '';
    @track isLoading = false;
    @track showCartPopup = false;
    @track cartItems = [];
    @track cartCount = 0;
    @track lastAddedProduct = null;
    _subscription = null;

    @wire(MessageContext)
    messageContext;

    connectedCallback() {
        this._subscription = subscribe(this.messageContext, PRODUCT_CHANNEL, (message) => {
            if (message.searchKey !== undefined) {
                this.searchKey = message.searchKey;
            }
            if (message.subFamily !== undefined) {
                this.selectedSubFamily = message.subFamily;
            }
        });
    }

    @wire(getProductsByFamily, {
        family: '$selectedFamily',
        subFamily: '$selectedSubFamily',
        searchKey: '$searchKey'
    })
    wiredProducts({ data, error }) {
        if (data) {
            const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
            this.products = data.map(p => {
                const reg = Number(p.Price__c);
                const mem = Number(p.Members_Price_Individual__c);
                const hasReg = Number.isFinite(reg) && reg > 0;
                const hasMem = Number.isFinite(mem) && mem > 0;
                return {
                    ...p,
                    formattedRegular: hasReg ? fmt.format(reg) : '',
                    formattedMember: hasMem ? fmt.format(mem) : '',
                    _showMemberPrice: hasMem && (!hasReg || mem !== reg),
                    _showOfferRibbon: hasReg && hasMem && mem < reg
                };
            });
        } else if (error) {
            console.error(error);
        }
    }

    get hasProducts() {
        return this.products && this.products.length > 0;
    }

    handleAddToCart = (event) => {
        event.stopPropagation();
        const productId = event.target.dataset.id;
        const product = this.products.find(p => p.Id === productId);

        addToCart({ productId: productId })
            .then(() => {
                this.lastAddedProduct = product;
                return getCartItems();
            })
            .then(cartData => {
                const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
                this.cartItems = cartData.map(item => ({
                    ...item,
                    _qty: Number(item.Quantity__c),
                    _formattedTotal: fmt.format(
                        Number(item.Quantity__c) *
                        Number(item.Product__r.Members_Price_Individual__c || item.Product__r.Price__c)
                    )
                }));
                this.showCartPopup = true;
                return getCartCount();
            })
            .then(count => {
                this.cartCount = count;
                publish(this.messageContext, PRODUCT_CHANNEL, { cartCount: count });
                setTimeout(() => { this.showCartPopup = false; }, 5000);
            })
            .catch(error => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Could not add to cart',
                    message: error.body ? error.body.message : 'An error occurred.',
                    variant: 'error'
                }));
            });
    };

    handleNavigate = (event) => {
        const productId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: {
                url: '/product-detail?productId=' + productId
            }
        });
    };

    handleClosePopup() {
        this.showCartPopup = false;
    }

    handleViewCart() {
        this.showCartPopup = false;
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url: '/cart' }
        });
    }
}