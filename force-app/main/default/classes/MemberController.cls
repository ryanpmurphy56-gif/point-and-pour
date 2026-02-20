public with sharing class MemberController {
    @AuraEnabled(cacheable=true)
    public static Members_Card__c getMemberDetails() {
        // We use Members_Card__c and Memeber_number__c to match your Org exactly
        return [SELECT Id, Memeber_number__c, Barcode__c 
                FROM Members_Card__c 
                WHERE CreatedById = :UserInfo.getUserId() 
                LIMIT 1];
    }
}