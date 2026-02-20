public with sharing class EmployeePortalController {

    @AuraEnabled(cacheable=true)
    public static User getCurrentUser() {
        return [
            SELECT Id, Name, Email, Title, SmallPhotoUrl, Profile.Name
            FROM User
            WHERE Id = :UserInfo.getUserId()
            LIMIT 1
        ];
    }

    @AuraEnabled(cacheable=true)
    public static Boolean isManager() {
        User u = [SELECT Profile.Name FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        return u.Profile.Name.contains('Manager') || u.Profile.Name.contains('Admin');
    }

    @AuraEnabled(cacheable=true)
    public static List<Roster_Shifts__c> getMyShifts() {
        return [
            SELECT Id, Name, Start_Time__c, End_Time__c,
                   Actual_Start_Time__c, Actual_End_Time__c,
                   Role__c, Status__c, Shift_Duration_Hours__c,
                   Date__c, Staff_Member__c, Staff_Member__r.Name
            FROM Roster_Shifts__c
            WHERE Staff_Member__c = :UserInfo.getUserId()
            AND Start_Time__c >= :DateTime.now().addDays(-7)
            ORDER BY Start_Time__c ASC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static Roster_Shifts__c getNextShift() {
        List<Roster_Shifts__c> shifts = [
            SELECT Id, Name, Start_Time__c, End_Time__c,
                   Role__c, Status__c, Shift_Duration_Hours__c
            FROM Roster_Shifts__c
            WHERE Staff_Member__c = :UserInfo.getUserId()
            AND Start_Time__c >= :DateTime.now()
            AND Status__c = 'Scheduled'
            ORDER BY Start_Time__c ASC
            LIMIT 1
        ];
        return shifts.isEmpty() ? null : shifts[0];
    }

    @AuraEnabled(cacheable=true)
    public static Decimal getHoursThisWeek() {
        // Calculate start of current week (Monday)
        Date today = Date.today();
        Integer dayOfWeek = Math.mod(today.toStartOfWeek().daysBetween(today), 7);
        DateTime weekStart = DateTime.newInstance(today.toStartOfWeek(), Time.newInstance(0,0,0,0));
        
        AggregateResult[] results = [
            SELECT SUM(Shift_Duration_Hours__c) total
            FROM Roster_Shifts__c
            WHERE Staff_Member__c = :UserInfo.getUserId()
            AND Status__c = 'Completed'
            AND Start_Time__c >= :weekStart
        ];
        if (results.isEmpty() || results[0].get('total') == null) return 0;
        return (Decimal)results[0].get('total');
    }

    @AuraEnabled(cacheable=true)
    public static Roster_Shifts__c getActiveShift() {
        List<Roster_Shifts__c> shifts = [
            SELECT Id, Name, Start_Time__c, Actual_Start_Time__c, Role__c
            FROM Roster_Shifts__c
            WHERE Staff_Member__c = :UserInfo.getUserId()
            AND Status__c = 'In Progress'
            LIMIT 1
        ];
        return shifts.isEmpty() ? null : shifts[0];
    }

    @AuraEnabled
    public static void punchIn(Id shiftId) {
        Roster_Shifts__c shift = [
            SELECT Id, Status__c, Actual_Start_Time__c
            FROM Roster_Shifts__c WHERE Id = :shiftId LIMIT 1
        ];
        if (shift.Status__c == 'In Progress') {
            throw new AuraHandledException('You are already punched in.');
        }
        shift.Actual_Start_Time__c = DateTime.now();
        shift.Status__c = 'In Progress';
        update shift;
    }

    @AuraEnabled
    public static void punchOut(Id shiftId) {
        Roster_Shifts__c shift = [
            SELECT Id, Status__c, Actual_End_Time__c
            FROM Roster_Shifts__c WHERE Id = :shiftId LIMIT 1
        ];
        shift.Actual_End_Time__c = DateTime.now();
        shift.Status__c = 'Completed';
        update shift;
    }

    @AuraEnabled(cacheable=true)
    public static List<Roster_Shifts__c> getAllShifts(String startDate, String endDate) {
        DateTime start = DateTime.valueOf(startDate + ' 00:00:00');
        DateTime finish = DateTime.valueOf(endDate + ' 23:59:59');
        return [
            SELECT Id, Name, Start_Time__c, End_Time__c,
                   Role__c, Status__c, Shift_Duration_Hours__c,
                   Staff_Member__c, Staff_Member__r.Name, Date__c
            FROM Roster_Shifts__c
            WHERE Start_Time__c >= :start
            AND Start_Time__c <= :finish
            ORDER BY Start_Time__c ASC
        ];
    }

    @AuraEnabled
    public static Roster_Shifts__c createShift(Id employeeId, DateTime startTime,
                                                DateTime endTime, String role) {
        Roster_Shifts__c shift = new Roster_Shifts__c(
            Staff_Member__c = employeeId,
            Start_Time__c = startTime,
            End_Time__c = endTime,
            Role__c = role,
            Status__c = 'Scheduled'
        );
        insert shift;
        return shift;
    }

    @AuraEnabled
    public static void deleteShift(Id shiftId) {
        delete [SELECT Id FROM Roster_Shifts__c WHERE Id = :shiftId LIMIT 1];
    }

    @AuraEnabled(cacheable=true)
    public static List<User> getEmployees() {
        return [
            SELECT Id, Name, Email, Title, SmallPhotoUrl
            FROM User
            WHERE IsActive = true
            AND UserType = 'Standard'
            ORDER BY Name ASC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Time_Off_Request__c> getMyTimeOffRequests() {
        return [
            SELECT Id, Start_Date__c, End_Date__c, Reason__c,
                   Status__c, Manager_Notes__c, CreatedDate
            FROM Time_Off_Request__c
            WHERE Employee__c = :UserInfo.getUserId()
            ORDER BY CreatedDate DESC
        ];
    }

    @AuraEnabled
    public static void submitTimeOffRequest(Date startDate, Date endDate, String reason) {
        Time_Off_Request__c request = new Time_Off_Request__c(
            Employee__c = UserInfo.getUserId(),
            Start_Date__c = startDate,
            End_Date__c = endDate,
            Reason__c = reason,
            Status__c = 'Pending'
        );
        insert request;
    }

    @AuraEnabled(cacheable=true)
    public static List<Time_Off_Request__c> getPendingTimeOffRequests() {
        return [
            SELECT Id, Employee__c, Employee__r.Name,
                   Start_Date__c, End_Date__c, Reason__c,
                   Status__c, Manager_Notes__c
            FROM Time_Off_Request__c
            WHERE Status__c = 'Pending'
            ORDER BY CreatedDate ASC
        ];
    }

    @AuraEnabled
    public static void updateTimeOffRequest(Id requestId, String status, String notes) {
        Time_Off_Request__c request = [
            SELECT Id FROM Time_Off_Request__c WHERE Id = :requestId LIMIT 1
        ];
        request.Status__c = status;
        request.Manager_Notes__c = notes;
        update request;
    }

}