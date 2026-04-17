# Self-Registration Setup — Point & Pour

After deploying SelfRegController.cls, follow these steps:

## 1. Set the Community Profile name

In SelfRegController.cls, line ~58:
```apex
Profile p = [SELECT Id FROM Profile WHERE Name = 'Point Pour Customer' LIMIT 1];
```
Change `'Point Pour Customer'` to the actual name of the Profile you want
new Community members assigned to. Check Setup → Profiles for the exact name.

Common names: 'Customer Community User', 'Customer Community Login User'

## 2. Enable Self-Registration in Experience Cloud

1. Go to Experience Builder → Administration → Registration
2. Under "Self-Registration", select:
   - Allow customers to self-register: **Enabled**
   - Registration Page: point to your `loginPage` LWC page
   - (Optional) Self-Registration Apex Class: `SelfRegController`

## 3. Add the loginPage to your site

In Experience Builder:
1. Create a new page (or use an existing Login page)
2. Drag the `loginPage` LWC component onto the page
3. Set page access to "Guest users can access"

## 4. Test the flow

1. Open an incognito window → navigate to your login page
2. Create a new account
3. In Salesforce, go to Contacts/Users to confirm the new user was created
4. Go to Members_Card__c object to confirm the card was created with:
   - Memeber_number__c: PNP-YYYYMMDD-XXXXXX format
   - Barcode__c: HTML img tag with QR code URL

## 5. QR Code note

The barcode uses Google Charts QR API (free, no API key needed):
`https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=MEMBER_NUMBER`

This is fine for development. For production, consider a self-hosted solution
or a paid QR service to remove the dependency on Google.
