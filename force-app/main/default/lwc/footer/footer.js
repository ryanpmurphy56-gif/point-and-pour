import { LightningElement } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import LOGO_RESOURCE from '@salesforce/resourceUrl/pointnpourlogo';

export default class Footer extends NavigationMixin(LightningElement) {
    logoUrl = LOGO_RESOURCE;

    get currentYear() {
        return new Date().getFullYear();
    }

    handleLogoError(event) {
        event.target.style.display = 'none';
    }

    handleNav(event) {
        const url = event.target.dataset.url;
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url }
        });
    }
}