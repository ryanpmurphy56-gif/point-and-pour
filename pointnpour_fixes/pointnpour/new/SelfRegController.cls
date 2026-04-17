/**
 * SelfRegController
 * Handles self-registration for Point & Pour Experience Cloud site.
 * Creates a Community User and auto-generates a Members_Card__c record
 * with a unique membership number and QR code barcode.
 *
 * SETUP REQUIRED:
 * 1. In Experience Cloud Admin > Administration > Registration:
 *    Set "Self-Registration Apex Class" to SelfRegController
 * 2. Ensure the Profile you assign below exists (e.g. "Point Pour Customer")
 * 3. Ensure Members_Card__c has: Memeber_number__c (Text), Barcode__c (Rich Text or Formula)
 *
 * NOTE: This class must be "without sharing" to create Users.
 */
public without sharing class SelfRegController {

    // ─── REGISTRATION ─────────────────────────────────────────────────────────

    @AuraEnabled
    public static String registerUser(
        String firstName,
        String lastName,
        String email,
        String password,
        String confirmPassword
    ) {
        // Basic validation
        if (String.isBlank(firstName) || String.isBlank(lastName) || String.isBlank(email)) {
            throw new AuraHandledException('Please fill in all required fields.');
        }
        if (String.isBlank(password) || password.length() < 8) {
            throw new AuraHandledException('Password must be at least 8 characters.');
        }
        if (password != confirmPassword) {
            throw new AuraHandledException('Passwords do not match.');
        }
        if (!isValidEmail(email)) {
            throw new AuraHandledException('Please enter a valid email address.');
        }

        // Check if user already exists
        List<User> existing = [SELECT Id FROM User WHERE Username = :email LIMIT 1];
        if (!existing.isEmpty()) {
            throw new AuraHandledException('An account with this email already exists. Please log in.');
        }

        try {
            // Get the Community profile
            // IMPORTANT: Change 'Point Pour Customer' to your actual Community profile name
            Profile p = [SELECT Id FROM Profile WHERE Name = 'Point Pour Customer' LIMIT 1];

            // Build the User record
            User newUser = new User(
                FirstName = firstName.trim(),
                LastName = lastName.trim(),
                Email = email.trim().toLowerCase(),
                Username = email.trim().toLowerCase(),
                Alias = (firstName.substring(0, 1) + lastName.substring(0, Math.min(7, lastName.length()))).toLowerCase(),
                CommunityNickname = generateNickname(firstName, lastName),
                ProfileId = p.Id,
                LocaleSidKey = 'en_AU',
                LanguageLocaleKey = 'en_US',
                TimeZoneSidKey = 'Australia/Sydney',
                EmailEncodingKey = 'UTF-8',
                IsActive = true
            );

            // Create the user — Site.createExternalUser handles community user creation
            String userId = Site.createExternalUser(newUser, null, password, false);

            if (userId != null) {
                // Create the membership card in a future method (avoids mixed DML)
                createMembershipCardAsync(userId);
                return 'SUCCESS';
            } else {
                throw new AuraHandledException('Could not create account. Please try again.');
            }
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Registration failed: ' + e.getMessage());
        }
    }

    // ─── CREATE MEMBERSHIP CARD (Future to avoid mixed DML) ──────────────────

    @future
    private static void createMembershipCardAsync(String userId) {
        try {
            String memberNumber = generateMembershipNumber();
            String barcodeHtml = generateBarcodeHtml(memberNumber);

            Members_Card__c card = new Members_Card__c(
                OwnerId = userId,
                Memeber_number__c = memberNumber,
                Barcode__c = barcodeHtml
            );
            insert card;
        } catch (Exception e) {
            System.debug('Error creating membership card: ' + e.getMessage());
        }
    }

    // ─── LOGIN ────────────────────────────────────────────────────────────────

    @AuraEnabled
    public static String loginUser(String email, String password) {
        if (String.isBlank(email) || String.isBlank(password)) {
            throw new AuraHandledException('Please enter your email and password.');
        }
        try {
            ApexPages.PageReference startUrl = Site.login(email.trim().toLowerCase(), password, '/');
            if (startUrl != null) {
                return startUrl.getUrl();
            }
            throw new AuraHandledException('Invalid email or password. Please try again.');
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Login failed: ' + e.getMessage());
        }
    }

    // ─── HELPERS ──────────────────────────────────────────────────────────────

    private static String generateMembershipNumber() {
        // Format: PNP-YYYYMMDD-XXXXXX (e.g. PNP-20250115-482931)
        String datePart = String.valueOf(Date.today()).replace('-', '');
        String randPart = String.valueOf(Math.abs(Crypto.getRandomInteger())).substring(0, 6);
        return 'PNP-' + datePart + '-' + randPart;
    }

    private static String generateBarcodeHtml(String memberNumber) {
        // Generates an img tag pointing to a QR code API
        // Uses Google Charts QR API (free, no key needed)
        String encoded = EncodingUtil.urlEncode(memberNumber, 'UTF-8');
        String qrUrl = 'https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=' + encoded + '&choe=UTF-8';
        return '<img src="' + qrUrl + '" alt="QR Code for ' + memberNumber + '" />';
    }

    private static String generateNickname(String firstName, String lastName) {
        String base = (firstName + lastName).replaceAll('[^a-zA-Z0-9]', '').toLowerCase();
        if (base.length() > 35) base = base.substring(0, 35);
        return base + String.valueOf(Math.abs(Crypto.getRandomInteger())).substring(0, 4);
    }

    private static Boolean isValidEmail(String email) {
        return Pattern.matches('^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$', email);
    }
}
