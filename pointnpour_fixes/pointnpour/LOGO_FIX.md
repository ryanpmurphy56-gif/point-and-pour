# LOGO FIX — Point & Pour

## Why the logo shows as a broken image

In Salesforce LWC, `@salesforce/resourceUrl/pointnpourlogo` resolves to the URL of
a Static Resource. If the image shows broken, ONE of these is wrong:

---

## Step 1 — Check the Static Resource name

1. In Salesforce, go to: **Setup → Static Resources**
2. Find your logo file
3. The **Name** field must be EXACTLY: `pointnpourlogo`
   - No spaces
   - No capital letters (or match exactly what's in your code)
   - No special characters

If the name is different (e.g. "PointNPourLogo" or "point_n_pour_logo"), either:
- **Rename it** in Static Resources to `pointnpourlogo`, OR
- **Update every JS file** that imports it to match the actual name

---

## Step 2 — Check Cache Control

In the Static Resource record, set:
- **Cache Control: Public**

(Not "Private" — Private resources can fail to load in Experience Cloud)

---

## Step 3 — Is it a single file or a zip?

### If you uploaded a single image file (PNG, SVG, JPG):
Your current code is correct:
```js
import LOGO_RESOURCE from '@salesforce/resourceUrl/pointnpourlogo';
logoUrl = LOGO_RESOURCE;  // Use directly as src
```

### If you uploaded a ZIP file containing the image:
You need to append the path inside the zip:
```js
import LOGO_RESOURCE from '@salesforce/resourceUrl/pointnpourlogo';
logoUrl = LOGO_RESOURCE + '/pointnpour-logo.png';  // Adjust filename to match what's inside the zip
```

---

## Step 4 — Re-upload if needed

If the file was originally uploaded as Private:
1. Delete the existing Static Resource
2. Re-upload with Cache Control set to **Public**

---

## Files affected

The logo is imported in these components — all use the same fix:
- `header.js`
- `ageVerification.js`
- `membershipModal.js`
- `loginPage.js` (new)

All of them use: `import LOGO_RESOURCE from '@salesforce/resourceUrl/pointnpourlogo';`
Make sure the static resource name matches in all of them.

---

## Quick test

After fixing, open browser DevTools (F12) → Network tab → reload the page.
Filter by "pointnpour" — you should see the image request returning 200, not 404.
