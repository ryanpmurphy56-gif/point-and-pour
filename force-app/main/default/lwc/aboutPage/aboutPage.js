import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

export default class AboutPage extends NavigationMixin(LightningElement) {

    @track faqs = [
        {
            id: '1',
            question: 'Is membership really free?',
            answer: 'Yes, completely free. There are no annual fees, no minimum spend, and no credit card required to sign up. Just create an account and your membership card is generated automatically.',
            isOpen: false
        },
        {
            id: '2',
            question: 'How do I use my member pricing in-store?',
            answer: 'Open your profile on your phone, go to "Membership Card", and show the QR code to the cashier. They\'ll scan it to apply your member pricing at the register. It takes about 2 seconds.',
            isOpen: false
        },
        {
            id: '3',
            question: 'Can I use member pricing online and in-store?',
            answer: 'Yes! When you\'re logged in on this website, member prices are automatically shown and applied at checkout. In-store, just scan your digital QR code.',
            isOpen: false
        },
        {
            id: '4',
            question: 'How long does my membership last?',
            answer: 'Your membership is valid for 12 months from the date you register and renews automatically each year at no cost.',
            isOpen: false
        },
        {
            id: '5',
            question: 'Do you offer click & collect?',
            answer: 'Yes! Select "Click & Collect" at checkout and your order will be ready for pickup at our store within 2 hours during opening hours. Collection is free.',
            isOpen: false
        },
        {
            id: '6',
            question: 'What ID is accepted for age verification?',
            answer: 'We accept Australian driver\'s licences, passports, and proof-of-age cards issued by the Victorian Government. ID will be checked on delivery or collection.',
            isOpen: false
        },
        {
            id: '7',
            question: 'What areas do you deliver to?',
            answer: 'We currently deliver to the Melbourne metropolitan area. Delivery times and fees are calculated at checkout based on your address. Most deliveries arrive same-day or next-day.',
            isOpen: false
        },
        {
            id: '8',
            question: 'Can I return a product?',
            answer: 'If a product is damaged, faulty, or not as described, we\'ll happily replace or refund it. Unopened products in original condition may be returned within 7 days with proof of purchase. Contact us at hello@pointnpour.com.au.',
            isOpen: false
        }
    ];

    handleFaqToggle(event) {
        const id = event.currentTarget.dataset.id;
        this.faqs = this.faqs.map(faq => ({
            ...faq,
            isOpen: faq.id === id ? !faq.isOpen : faq.isOpen
        }));
    }

    handleRegister() {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url: '/login' }
        });
    }

    handleShop() {
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: { name: 'Home' }
        });
    }
}