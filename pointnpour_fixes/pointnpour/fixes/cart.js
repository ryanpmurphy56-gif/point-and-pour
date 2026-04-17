import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { publish, MessageContext } from 'lightning/messageService';
import PRODUCT_CHANNEL from '@salesforce/messageChannel/ProductFilters__c';
import getCartItems from '@salesforce/apex/CartController.getCartItems';
import updateQuantity from '@salesforce/apex/CartController.updateQuantity';
import removeFromCart from '@salesforce/apex/CartController.removeFromCart';

export default class Cart extends NavigationMixin(LightningElement) {
    @track cartItems = [];
    @track isLoading = true;

    @wire(MessageContext)
    messageContext;

    connectedCallback() {
        this.loadCart();
    }

    loadCart() {
        this.isLoading = true;
        getCartItems()
            .then(data => {
                const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
                this.cartItems = data.map(item => {
                    // FIX: Always use Number() to avoid string concatenation bugs
                    const reg = Number(item.Product__r.Price__c);
                    const mem = Number(item.Product__r.Members_Price_Individual__c);
                    const qty = Number(item.Quantity__c);
                    const stock = Number(item.Product__r.Quantity_on_Hand__c);
                    const hasReg = Number.isFinite(reg) && reg > 0;
                    const hasMem = Number.isFinite(mem) && mem > 0;
                    const showMember = hasMem && mem !== reg;
                    const activePrice = showMember ? mem : reg;
                    const lineTotal = activePrice * qty;
                    const savings = showMember ? (reg - mem) * qty : 0;
                    return {
                        ...item,
                        formattedRegular: hasReg ? fmt.format(reg) : '',
                        formattedMember: hasMem ? fmt.format(mem) : '',
                        formattedSavings: savings > 0 ? fmt.format(savings) : '',
                        formattedLineTotal: fmt.format(lineTotal),
                        _lineTotal: lineTotal,
                        _savings: savings,
                        _qty: qty,
                        _showMemberPrice: showMember,
                        _isLowStock: stock > 0 && stock <= 5,
                        _isOutOfStock: stock === 0
                    };
                });
                this.isLoading = false;
                this.publishCartCount();
            })
            .catch(error => {
                console.error('Error loading cart:', error);
                this.isLoading = false;
            });
    }

    get hasItems() {
        return this.cartItems && this.cartItems.length > 0;
    }

    get subtotal() {
        return this.cartItems.reduce((sum, item) => sum + item._lineTotal, 0);
    }

    get totalSavings() {
        return this.cartItems.reduce((sum, item) => sum + item._savings, 0);
    }

    get total() {
        return this.subtotal;
    }

    get hasMemberSavings() {
        return this.totalSavings > 0;
    }

    get formattedSubtotal() {
        const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
        return fmt.format(this.subtotal);
    }

    get formattedTotalSavings() {
        const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
        return fmt.format(this.totalSavings);
    }

    get formattedTotal() {
        const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
        return fmt.format(this.total);
    }

    handleIncrease(event) {
        const itemId = event.target.dataset.id;
        const item = this.cartItems.find(i => i.Id === itemId);
        if (item) {
            // FIX: Use _qty (pre-converted number) to avoid string concat
            updateQuantity({ cartItemId: itemId, newQuantity: item._qty + 1 })
                .then(() => this.loadCart())
                .catch(error => console.error(error));
        }
    }

    handleDecrease(event) {
        const itemId = event.target.dataset.id;
        const item = this.cartItems.find(i => i.Id === itemId);
        if (item && item._qty > 1) {
            updateQuantity({ cartItemId: itemId, newQuantity: item._qty - 1 })
                .then(() => this.loadCart())
                .catch(error => console.error(error));
        } else if (item && item._qty === 1) {
            this.handleRemove(event);
        }
    }

    handleRemove(event) {
        const itemId = event.target.dataset.id;
        removeFromCart({ cartItemId: itemId })
            .then(() => this.loadCart())
            .catch(error => console.error(error));
    }

    publishCartCount() {
        const count = this.cartItems.reduce((sum, item) => sum + item._qty, 0);
        publish(this.messageContext, PRODUCT_CHANNEL, { cartCount: count });
    }

    handleContinueShopping() {
        // FIX: Navigate to site home page instead of hardcoded /newtest/home
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: {
                name: 'Home'
            }
        });
    }

    handleCheckout() {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url: '/checkout' }
        });
    }
}
