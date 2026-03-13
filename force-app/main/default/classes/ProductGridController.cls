public with sharing class ProductGridController {

    @AuraEnabled(cacheable=true)
    public static List<Product2> getProductsByFamily(String family, String subFamily, String searchKey) {
        String query = 'SELECT Id, Name, Family, Product_Sub_Family__c, Price__c, ' +
                       'Members_Price_Individual__c, Price_6_Pack_New__c, Price_Slab_of_24_new__c, ' +
                       'Members_Price_6_Pack__c, Members_Price_Slab_of_24__c, ' +
                       'Product_Image_Field__c, QuantityUnitOfMeasure FROM Product2';

        List<String> filters = new List<String>();

        if (family != null && family.equalsIgnoreCase('offers')) {
            filters.add('Members_Price_Individual__c < Price__c');
        } else if (String.isNotBlank(family) && !family.equalsIgnoreCase('all')) {
            filters.add('Family = \'' + String.escapeSingleQuotes(family) + '\'');
        }

        if (String.isNotBlank(subFamily)) {
            filters.add('Product_Sub_Family__c = \'' + String.escapeSingleQuotes(subFamily) + '\'');
        }

        if (String.isNotBlank(searchKey)) {
            filters.add('Name LIKE \'%' + String.escapeSingleQuotes(searchKey) + '%\'');
        }

        if (!filters.isEmpty()) {
            query += ' WHERE ' + String.join(filters, ' AND ');
        }

        query += ' ORDER BY Name';
        return Database.query(query);
    }

    @AuraEnabled(cacheable=true)
    public static List<Product2> getProductsOnOffer() {
        List<Product2> allProducts = [
            SELECT Id, Name, Family, Price__c, Members_Price_Individual__c,
                   Price_6_Pack_New__c, Price_Slab_of_24_new__c,
                   Members_Price_6_Pack__c, Members_Price_Slab_of_24__c,
                   Product_Image_Field__c, Product_Sub_Family__c,
                   QuantityUnitOfMeasure
            FROM Product2
            WHERE Members_Price_Individual__c != null
            AND Price__c != null
            ORDER BY Name
        ];

        List<Product2> offers = new List<Product2>();
        for (Product2 p : allProducts) {
            if (p.Members_Price_Individual__c > 0 && p.Members_Price_Individual__c < p.Price__c) {
                offers.add(p);
            }
        }
        return offers;
    }

    @AuraEnabled(cacheable=true)
    public static Members_Card__c getMemberDetails() {
        return [SELECT Id, Memeber_number__c, Barcode__c
                FROM Members_Card__c
                WHERE CreatedById = :UserInfo.getUserId()
                LIMIT 1];
    }

    @AuraEnabled(cacheable=true)
    public static Product2 getProductById(Id productId) {
        return [
            SELECT Id, Name, Family, Product_Sub_Family__c,
                   Price__c, Members_Price_Individual__c,
                   Price_6_Pack_New__c, Price_Slab_of_24_new__c,
                   Members_Price_6_Pack__c, Members_Price_Slab_of_24__c,
                   Product_Image_Field__c, Description,
                   Alcohol_By_Volume__c, Volume_ml__c,
                   Origin_Country__c, Quantity_on_Hand__c,
                   Tasting_Notes__c, QuantityUnitOfMeasure
            FROM Product2
            WHERE Id = :productId
            LIMIT 1
        ];
    }
    @AuraEnabled(cacheable=true)
public static Map<String, Integer> getSiteStats() {
    Map<String, Integer> stats = new Map<String, Integer>();
    stats.put('productCount', [SELECT COUNT() FROM Product2 WHERE IsActive = true]);
    stats.put('memberCount', [SELECT COUNT() FROM Members_Card__c WHERE Expiry_Date__c >= TODAY]);
    return stats;
}

    @AuraEnabled(cacheable=true)
    public static List<Product2> getRelatedProducts(String family, String excludeId) {
        return [
            SELECT Id, Name, Family, Price__c, Members_Price_Individual__c,
                   Price_6_Pack_New__c, Price_Slab_of_24_new__c,
                   Members_Price_6_Pack__c, Members_Price_Slab_of_24__c,
                   Product_Image_Field__c, Product_Sub_Family__c,
                   QuantityUnitOfMeasure
            FROM Product2
            WHERE Family = :family
            AND Id != :excludeId
            AND IsActive = true
            ORDER BY Name
            LIMIT 6
        ];
    }
}