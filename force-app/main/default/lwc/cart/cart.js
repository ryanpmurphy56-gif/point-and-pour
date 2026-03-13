import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { publish, MessageContext } from 'lightning/messageService';
import PRODUCT_CHANNEL from '@salesforce/messageChannel/ProductFilters__c';
import getCartItems from '@salesforce/apex/CartController.getCartItems';
import updateQuantity from '@salesforce/apex/CartController.updateQuantity';
import removeFromCart from '@salesforce/apex/CartController.removeFromCart';
import { getSessionUID } from 'c/sessionService';

function resolveActivePrice(item) {
    const family = (item.ProductFamily || '').toLowerCase();
    const has = v => { const n = Number(v); return Number.isFinite(n) && n > 0; };
    const isMember = item.IsMember;

    if (family === 'beer') {
        if (isMember) {
            if (has(item.MemberSixPackPrice)) return Number(item.MemberSixPackPrice);
            if (has(item.MemberSlabPrice))    return Number(item.MemberSlabPrice);
            if (has(item.MemberPrice))        return Number(item.MemberPrice);
        }
        if (has(item.SixPackPrice)) return Number(item.SixPackPrice);
        if (has(item.SlabPrice))    return Number(item.SlabPrice);
        return Number(item.RegularPrice) || 0;
    }

    if (isMember && has(item.MemberPrice)) return Number(item.MemberPrice);
    return Number(item.RegularPrice) || 0;
}

export default class Cart extends NavigationMixin(LightningElement) {
    @track cartItems = [];
    @track isLoading = true;

    @wire(MessageContext)
    messageContext;

    sessionUID;

    connectedCallback() {
        this.sessionUID = getSessionUID();
        this.loadCart();
    }

    loadCart() {
        this.isLoading = true;
        getCartItems({ uid: this.sessionUID })
            .then(data => {
                const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
                this.cartItems = data.map(item => {
                    const activePrice = resolveActivePrice(item);
                    const qty         = Number(item.Quantity) || 0;
                    const stock       = Number(item.QuantityOnHand);
                    const lineTotal   = activePrice * qty;
                    const fullReg     = Number(item.RegularPrice) || 0;
                    const savings     = item.IsMember && activePrice < fullReg
                        ? (fullReg - activePrice) * qty : 0;

                    return {
                        ...item,
                        _qty: qty,
                        formattedActivePrice: activePrice ? fmt.format(activePrice) : '',
                        formattedLineTotal:   fmt.format(lineTotal),
                        formattedSavings:     savings > 0 ? fmt.format(savings) : '',
                        _lineTotal:           lineTotal,
                        _savings:             savings,
                        _isLowStock:          stock > 0 && stock <= 5,
                        _isOutOfStock:        stock === 0
                    };
                });
                this.isLoading = false;
                this.publishCartCount();
            })
            .catch(error => {
                console.error('Cart load error:', error);
                this.isLoading = false;
            });
    }

    get hasItems()   { return this.cartItems && this.cartItems.length > 0; }

    get subtotal()   { return this.cartItems.reduce((sum, i) => sum + i._lineTotal, 0); }
    get totalSavings() { return this.cartItems.reduce((sum, i) => sum + i._savings, 0); }
    get hasMemberSavings() { return this.totalSavings > 0; }

    get formattedSubtotal() {
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(this.subtotal);
    }
    get formattedTotalSavings() {
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(this.totalSavings);
    }
    get formattedTotal() {
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(this.subtotal);
    }

    handleIncrease(event) {
        const itemId = event.target.dataset.id;
        const item   = this.cartItems.find(i => i.Id === itemId);
        if (!item) return;
        updateQuantity({ cartItemId: itemId, newQuantity: item._qty + 1 })
            .then(() => this.loadCart())
            .catch(err => console.error(err));
    }

    handleDecrease(event) {
        const itemId = event.target.dataset.id;
        const item   = this.cartItems.find(i => i.Id === itemId);
        if (!item) return;
        if (item._qty <= 1) {
            this.handleRemove(event);
        } else {
            updateQuantity({ cartItemId: itemId, newQuantity: item._qty - 1 })
                .then(() => this.loadCart())
                .catch(err => console.error(err));
        }
    }

    handleRemove(event) {
        const itemId = event.target.dataset.id;
        removeFromCart({ cartItemId: itemId })
            .then(() => this.loadCart())
            .catch(err => console.error(err));
    }

    publishCartCount() {
        const count = this.cartItems.reduce((sum, i) => sum + i._qty, 0);
        publish(this.messageContext, PRODUCT_CHANNEL, { cartCount: count });
    }

    handleContinueShopping() {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url: '/home' }
        });
    }

    handleCheckout() {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url: '/checkout' }
        });
    }
}