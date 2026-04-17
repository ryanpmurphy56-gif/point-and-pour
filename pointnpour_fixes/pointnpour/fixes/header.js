import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import LOGO_RESOURCE from '@salesforce/resourceUrl/pointnpourlogo';
import { publish, subscribe, MessageContext } from 'lightning/messageService';
import PRODUCT_CHANNEL from '@salesforce/messageChannel/ProductFilters__c';

export default class Header extends NavigationMixin(LightningElement) {
    // LOGO FIX: The static resource name must match EXACTLY what is in Setup > Static Resources
    // Go to Setup > Static Resources and confirm the Name is exactly: pointnpourlogo
    // It must be uploaded as Cache Control: Public
    // If it's a single image file (PNG/SVG/JPG), reference it directly as below
    // If it's inside a zip, change to: LOGO_RESOURCE + '/pointnpour-logo.png' (path inside zip)
    logoUrl = LOGO_RESOURCE;

    @track isModalOpen = false;
    @track cartItemsCount = 0;

    @wire(MessageContext)
    messageContext;

    connectedCallback() {
        subscribe(this.messageContext, PRODUCT_CHANNEL, (message) => {
            if (message.cartCount !== undefined) {
                this.cartItemsCount = message.cartCount;
            }
        });
    }

    get cartBadgeVisible() {
        return this.cartItemsCount > 0;
    }

    get cartLabel() {
        return this.cartItemsCount > 0
            ? 'Cart (' + this.cartItemsCount + ')'
            : 'Cart';
    }

    handleShowMemberCard() {
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
    }

    handleSearchSubmit() {
        const searchInput = this.refs.searchInput;
        const val = searchInput ? searchInput.value.trim() : '';
        if (val) {
            this[NavigationMixin.Navigate]({
                type: 'standard__webPage',
                attributes: {
                    url: '/search?searchKey=' + encodeURIComponent(val)
                }
            });
            // Also publish to any in-page grids
            publish(this.messageContext, PRODUCT_CHANNEL, { searchKey: val });
        }
    }

    // FIX: handleSearchKeyUp was defined but never connected to the template
    // Added onkeyup={handleSearchKeyUp} in the HTML
    handleSearchKeyUp(event) {
        if (event.key === 'Enter') {
            this.handleSearchSubmit();
        }
    }

    handleFamilyChange(event) {
        const family = event.target.dataset.page;
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: {
                name: family,
            }
        });
    }

    handleViewCart() {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url: '/cart' }
        });
    }

    handleMembershipClick() {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url: '/membership' }
        });
    }
}
