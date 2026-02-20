import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin, CurrentPageReference } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { publish, MessageContext } from 'lightning/messageService';
import PRODUCT_CHANNEL from '@salesforce/messageChannel/ProductFilters__c';
import getProductsByFamily from '@salesforce/apex/ProductGridController.getProductsByFamily';
import addToCart from '@salesforce/apex/CartController.addToCart';
import getCartCount from '@salesforce/apex/CartController.getCartCount';

export default class SearchResults extends NavigationMixin(LightningElement) {
    @track products = [];
    @track searchKey = '';

    @wire(MessageContext)
    messageContext;

    @wire(CurrentPageReference)
    pageRef(ref) {
        if (ref && ref.state && ref.state.searchKey) {
            this.searchKey = ref.state.searchKey;
        }
    }

    @wire(getProductsByFamily, {
        family: '',
        subFamily: '',
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
            console.error('Search error:', error);
        }
    }

    get hasProducts() {
        return this.products && this.products.length > 0;
    }

    get noResults() {
        return this.searchKey && this.products && this.products.length === 0;
    }

    get resultCount() {
        return this.products ? this.products.length : 0;
    }

    handleAddToCart(event) {
        event.stopPropagation();
        const productId = event.target.dataset.id;

        addToCart({ productId })
            .then(() => getCartCount())
            .then(count => {
                publish(this.messageContext, PRODUCT_CHANNEL, { cartCount: count });
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Added to Cart',
                    message: 'Item added to your cart.',
                    variant: 'success'
                }));
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
}