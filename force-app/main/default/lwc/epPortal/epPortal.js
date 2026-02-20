import { LightningElement, track } from 'lwc';

export default class EpPortal extends LightningElement {
    @track activeTab = 'dashboard';

    get isDashboard() { return this.activeTab === 'dashboard'; }
    get isShifts() { return this.activeTab === 'shifts'; }
    get isTimeOff() { return this.activeTab === 'timeoff'; }

    handleNavigate(event) {
        this.activeTab = event.detail;
    }
}