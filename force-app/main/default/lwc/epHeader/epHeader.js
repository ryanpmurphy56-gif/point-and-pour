import { LightningElement, api, wire } from 'lwc';
import getCurrentUser from '@salesforce/apex/EmployeePortalController.getCurrentUser';
import isManager from '@salesforce/apex/EmployeePortalController.isManager';

export default class EpHeader extends LightningElement {
    @api activeTab = 'dashboard';
    userName = '';
    userPhoto = '';
    isManager = false;

    @wire(getCurrentUser)
    wiredUser({ data }) {
        if (data) {
            this.userName = data.Name;
            this.userPhoto = data.SmallPhotoUrl;
        }
    }

    @wire(isManager)
    wiredManager({ data }) {
        if (data !== undefined) this.isManager = data;
    }

    handleNav(event) {
        const tab = event.target.dataset.tab;
        this.dispatchEvent(new CustomEvent('navigate', { detail: tab }));
    }
}