import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

export default class CartPopup extends NavigationMixin(LightningElement) {
    @api cartItems = [];
    @api cartCount = 0;
    @api lastAddedProduct;

    get cartTotal() {
        if (!this.cartItems || this.cartItems.length === 0) return 'AUD $0.00';
        const total = this.cartItems.reduce((sum, item) => {
            const price = Number(item.MemberPrice || item.RegularPrice || 0);
            const qty = Number(item._qty || item.Qty || 0);
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