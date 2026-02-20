import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

export default class CartPopup extends NavigationMixin(LightningElement) {
    @api cartItems = [];
    @api cartCount = 0;
    @api lastAddedProduct;

    get cartTotal() {
        if (!this.cartItems) return 'AUD $0.00';
        const total = this.cartItems.reduce((sum, item) => {
            const price = Number(item.Product__r?.Members_Price_Individual__c || item.Product__r?.Price__c || 0);
            const qty = Number(item.Quantity__c || 0);
            return sum + price * qty;
        }, 0);
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(total);
    }

    get hasItems() {
        return this.cartItems && this.cartItems.length > 0;
    }

    get lastAddedName() {
        return this.lastAddedProduct ? this.lastAddedProduct.Name : 'Item';
    }

    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleViewCart() {
        this.dispatchEvent(new CustomEvent('viewcart'));
    }
}
