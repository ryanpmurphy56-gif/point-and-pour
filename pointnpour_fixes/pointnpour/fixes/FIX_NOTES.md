# Point & Pour - Fix Package

## Fix 1: Logo Not Displaying
The logo uses `@salesforce/resourceUrl/pointnpourlogo` which is correct IF the static resource
is named exactly `pointnpourlogo` (no spaces, exact case) in Setup > Static Resources.

Two possible causes:
1. Static resource name mismatch
2. The resource is a zip file but you're referencing it like a direct image

If your logo is a single PNG/SVG file, it must be uploaded as a Static Resource with type
"Public" and the name must match exactly.

If it's inside a zip, the JS needs: `LOGO_RESOURCE + '/logo.png'` (path inside zip)

## Fix 2: Cart "Continue Shopping" 
Changed URL from '/newtest/home' to '/' (root/home page of Experience Cloud site)

## Fix 3: Add to Cart on Product Grids
The offersGrid handleAddToCart was broken - just navigated to cart instead of calling Apex.
Fixed in offersGrid.js - now calls addToCart Apex and shows mini cart popup.

## Fix 4: Mini Cart Popup
New component: cartPopup - slides in from the right when you add an item.

## Fix 5: Login/Register Page
New components:
- loginPage (LWC) - handles login + registration
- SelfRegController (Apex) - creates Community user + Members_Card__c with auto-generated membership number + barcode
