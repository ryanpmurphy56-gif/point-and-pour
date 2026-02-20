import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getProductsByFamily from '@salesforce/apex/ProductGridController.getProductsByFamily';
import addToCart from '@salesforce/apex/CartController.addToCart';
import getCartCount from '@salesforce/apex/CartController.getCartCount';
import { publish, subscribe, MessageContext } from 'lightning/messageService';
import PRODUCT_CHANNEL from '@salesforce/messageChannel/ProductFilters__c';

export default class ProductGrid extends NavigationMixin(LightningElement) {
    @track products = [];
    @track selectedFamily = '';
    @track selectedSubFamily = '';
    @track searchKey = '';
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

    handleFamilyChange = (event) => {
        this.selectedFamily = event.target.value;
        this.selectedSubFamily = '';
        this.searchKey = '';
    };

    handleAddToCart = (event) => {
        event.stopPropagation();
        const productId = event.target.dataset.id;
        const product = this.products.find(p => p.Id === productId);

        addToCart({ productId: productId })
            .then(() => {
                // Show toast notification
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Added to Cart',
                    message: product ? product.Name + ' added to your cart.' : 'Item added to cart.',
                    variant: 'success'
                }));
                // Update badge in header
                return getCartCount();
            })
            .then(count => {
                publish(this.messageContext, PRODUCT_CHANNEL, { cartCount: count });
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
}