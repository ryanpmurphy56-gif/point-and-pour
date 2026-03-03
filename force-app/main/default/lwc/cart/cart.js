import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { publish, MessageContext } from 'lightning/messageService';
import PRODUCT_CHANNEL from '@salesforce/messageChannel/ProductFilters__c';
import getCartItems from '@salesforce/apex/CartController.getCartItems';
import updateQuantity from '@salesforce/apex/CartController.updateQuantity';
import removeFromCart from '@salesforce/apex/CartController.removeFromCart';

//SESSION STUFF 
import { getSessionUID } from 'c/sessionService';

export default class Cart extends NavigationMixin(LightningElement) {
    @track cartItems = [];
    @track isLoading = true;

    @wire(MessageContext)
    messageContext;
    sessionUID;

   connectedCallback() {
    this.sessionUID = getSessionUID(); // ✅ same UID as product grid
    console.log('Session UID:', this.sessionUID);
    this.loadCart();
}

    loadCart() {
        this.isLoading = true;
        getCartItems({ uid: this.sessionUID })
            .then(data => {
                const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
                this.cartItems = data.map(item => {
                    const reg = Number(item.RegularPrice);
                    const mem = Number(item.MemberPrice);
                    const qty = Number(item.Qty);
                    const stock = Number(item.QuantityOnHand);
                    const isMember = item.IsMember;

                    const hasReg = Number.isFinite(reg) && reg > 0;
                    const hasMem = isMember && Number.isFinite(mem) && mem > 0;
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
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(this.subtotal);
    }

    get formattedTotalSavings() {
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(this.totalSavings);
    }

    get formattedTotal() {
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(this.total);
    }

    handleIncrease(event) {
        const itemId = event.target.dataset.id;
        const item = this.cartItems.find(i => i.Id === itemId);
        if (item) {
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
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: { name: 'Home' }
        });
    }

    handleCheckout() {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url: '/checkout' }
        });
    }
}