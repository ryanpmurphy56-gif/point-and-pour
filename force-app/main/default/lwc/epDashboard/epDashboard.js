import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getCurrentUser from '@salesforce/apex/EmployeePortalController.getCurrentUser';
import getNextShift from '@salesforce/apex/EmployeePortalController.getNextShift';
import getHoursThisWeek from '@salesforce/apex/EmployeePortalController.getHoursThisWeek';
import getActiveShift from '@salesforce/apex/EmployeePortalController.getActiveShift';
import punchIn from '@salesforce/apex/EmployeePortalController.punchIn';
import punchOut from '@salesforce/apex/EmployeePortalController.punchOut';

export default class EpDashboard extends LightningElement {
    @track userName = '';
    @track hoursThisWeek = 0;
    @track nextShiftDate = 'No upcoming shifts';
    @track nextShiftTime = '';
    @track isPunchedIn = false;
    @track punchInTime = '';
    @track currentStatus = 'Off Duty';
    @track activeShiftId = null;
    @track notifications = [];

    @wire(getCurrentUser)
    wiredUser({ data }) {
        if (data) this.userName = data.Name;
    }

    @wire(getHoursThisWeek)
    wiredHours({ data }) {
        if (data !== undefined) this.hoursThisWeek = Number(data).toFixed(1);
    }

    @wire(getNextShift)
    wiredNextShift({ data }) {
        if (data) {
            const start = new Date(data.Start_Time__c);
            this.nextShiftDate = start.toLocaleDateString('en-AU', { weekday: 'long', month: 'short', day: 'numeric' });
            this.nextShiftTime = start.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) +
                ' — ' + new Date(data.End_Time__c).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
        }
    }

    @wire(getActiveShift)
    wiredActiveShift({ data }) {
        if (data) {
            this.isPunchedIn = true;
            this.activeShiftId = data.Id;
            this.currentStatus = 'On Shift';
            const punchTime = new Date(data.Actual_Start_Time__c);
            this.punchInTime = punchTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
        }
    }

    get timeOfDay() {
        const hour = new Date().getHours();
        if (hour < 12) return 'morning';
        if (hour < 17) return 'afternoon';
        return 'evening';
    }

    get hasNotifications() {
        return this.notifications && this.notifications.length > 0;
    }

    handlePunchIn() {
        if (!this.activeShiftId) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'No Shift Found',
                message: 'You have no scheduled shift to punch in to.',
                variant: 'warning'
            }));
            return;
        }
        punchIn({ shiftId: this.activeShiftId })
            .then(() => {
                this.isPunchedIn = true;
                this.currentStatus = 'On Shift';
                this.punchInTime = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Punched In',
                    message: 'Have a great shift!',
                    variant: 'success'
                }));
            })
            .catch(error => console.error(error));
    }

    handlePunchOut() {
        punchOut({ shiftId: this.activeShiftId })
            .then(() => {
                this.isPunchedIn = false;
                this.currentStatus = 'Off Duty';
                this.activeShiftId = null;
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Punched Out',
                    message: 'See you next time!',
                    variant: 'success'
                }));
            })
            .catch(error => console.error(error));
    }
}