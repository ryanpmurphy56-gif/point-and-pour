import { LightningElement, track, wire, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { publish, MessageContext } from 'lightning/messageService';
import PRODUCT_CHANNEL from '@salesforce/messageChannel/ProductFilters__c';
import getProductsOnOffer from '@salesforce/apex/ProductGridController.getProductsOnOffer';
import addToCart from '@salesforce/apex/CartController.addToCart';
import getCartItems from '@salesforce/apex/CartController.getCartItems';
import getCartCount from '@salesforce/apex/CartController.getCartCount';

//SESSION STUFF 

import { getSessionUID } from 'c/sessionService';
export default class OffersGrid extends NavigationMixin(LightningElement) {
    @track products = [];
    @track isLoading = true;
    @track showCartPopup = false;
    @track cartItems = [];
    @track cartCount = 0;
    @track lastAddedProduct = null;
    @api selectedFamily = 'offers';
    @track sessionUID='';  

    @wire(MessageContext)
    messageContext;

    connectedCallback() {
        this.sessionUID = getSessionUID(); // ✅ same UID as product grid
        console.log('Session UID:', this.sessionUID);
    }

    @wire(getProductsOnOffer)
    wiredProducts({ data, error }) {
        if (data) {
            const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
            this.products = data.map(p => {
                const reg = Number(p.Price__c);
                const mem = Number(p.Members_Price_Individual__c);
                const hasReg = Number.isFinite(reg) && reg > 0;
                const hasMem = Number.isFinite(mem) && mem > 0;
                const showMemberPrice = hasMem && (!hasReg || mem !== reg);
                const showOfferRibbon = hasReg && hasMem && mem < reg;
                return {
                    ...p,
                    formattedRegular: hasReg ? fmt.format(reg) : '',
                    formattedMember: hasMem ? fmt.format(mem) : '',
                    _showMemberPrice: showMemberPrice,
                    _showOfferRibbon: showOfferRibbon
                };
            });
            this.isLoading = false;
        } else if (error) {
            console.error('Error fetching offers:', error);
            this.isLoading = false;
        }
    }

    get hasProducts() {
        return this.products && this.products.length > 0;
    }

    handleAddToCart(event) {
        event.stopPropagation();
        const productId = event.target.dataset.id;
        const product = this.products.find(p => p.Id === productId);

        addToCart({ productId: productId, uid: this.sessionUID })
            .then(() => {
                this.lastAddedProduct = product;
                return getCartItems({ uid: this.sessionUID });
            })
            .then(cartData => {
                const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
                this.cartItems = cartData.map(item => ({
                    ...item,
                    _qty: Number(item.Qty),
                    _formattedTotal: fmt.format(
                        Number(item.Qty) * Number(item.MemberPrice || item.RegularPrice || 0)
                    )
                }));
                this.showCartPopup = true;
                return getCartCount(    { uid: this.sessionUID });
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
    }

    handleNavigate(event) {
        const productId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: {
                url: '/product-detail?productId=' + productId
            }
        });
    }

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