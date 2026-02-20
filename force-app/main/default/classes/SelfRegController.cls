/**
 * SelfRegController
 * Handles self-registration for Point & Pour Experience Cloud site.
 * Creates a Community User and a Members_Card__c record linked to their Account.
 *
 * SETUP REQUIRED:
 * 1. Change 'Point Pour Customer' below to your actual Community Profile name
 * 2. Ensure Members_Card__c has Account__c (Master-Detail to Account)
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
            // IMPORTANT: Change 'Point Pour Customer' to your actual Community Profile name
            Profile p = [SELECT Id FROM Profile WHERE Name = 'Point Pour Customer' LIMIT 1];

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

            String userId = Site.createExternalUser(newUser, null, password, false);

            if (userId != null) {
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

    // ─── CREATE MEMBERSHIP CARD ───────────────────────────────────────────────
    // Uses @future to avoid mixed DML error (can't do User + SObject in same transaction)
    // Barcode__c and Memeber_number__c are formula fields - Salesforce generates them automatically
    // We just need to create the record with the Account link and Name

    @future
    private static void createMembershipCardAsync(String userId) {
        try {
            // Get the Account associated with this Community User
            User u = [SELECT Id, AccountId, FirstName, LastName FROM User WHERE Id = :userId LIMIT 1];

            if (u.AccountId == null) {
                System.debug('No Account found for user ' + userId + ' - membership card not created');
                return;
            }

            Members_Card__c card = new Members_Card__c(
                Account__c = u.AccountId,
                Name = u.FirstName + ' ' + u.LastName + ' Membership',
                Start_Date__c = Date.today(),
                Expiry_Date__c = Date.today().addYears(1)
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

    private static String generateNickname(String firstName, String lastName) {
        String base = (firstName + lastName).replaceAll('[^a-zA-Z0-9]', '').toLowerCase();
        if (base.length() > 35) base = base.substring(0, 35);
        return base + String.valueOf(Math.abs(Crypto.getRandomInteger())).substring(0, 4);
    }

    private static Boolean isValidEmail(String email) {
        return Pattern.matches('^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$', email);
    }
}