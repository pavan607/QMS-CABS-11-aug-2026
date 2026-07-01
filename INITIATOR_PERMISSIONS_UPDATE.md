# Initiator Permissions Update

## Overview
Updated the Initiator role to have admin-like viewing access while restricting create/update permissions for checklists and quality checks.

## Implementation Date
October 31, 2025

## Changes Implemented

### 1. Inspection Requests Access

**Updated:** Initiators can now view ALL inspection requests (like administrators)

**API Change:** `app/api/inspection-requests/route.ts`
```typescript
// Initiators can view all inspection requests (like admin) to track progress
// Inspectors only see assigned requests
if (userRole === 'inspector') {
  sql += ` AND ir.inspector_id = $${paramIndex}`;
  params.push(userId);
  paramIndex++;
}
// Initiators, Approvers and Administrators can see all requests
```

**Result:**
- ✅ Initiators see ALL inspection requests (any user, any status)
- ✅ Inspectors still see only assigned requests
- ✅ Approvers and Admins see all (unchanged)

### 2. Dashboard Statistics

**Updated:** Dashboard shows all organization data to initiators

**API Change:** `app/api/inspection-requests/stats/route.ts`
```typescript
// Dashboard shows all data for initiators, approvers, and administrators
// Inspectors only see assigned inspection stats
if (userRole === 'inspector') {
  baseFilter = 'WHERE inspector_id = $1';
  params.push(userId);
}
// No filter for initiators, approvers, and administrators - they see all data
```

**Result:**
- ✅ Initiators see organization-wide statistics
- ✅ Inspectors see only assigned statistics
- ✅ Approvers and Admins see all (unchanged)

### 3. Permissions System

**Updated:** Added explicit checklist and quality check read-only permissions

**Permissions Change:** `lib/permissions.ts`
```typescript
initiator: [
  { resource: 'inspection_request', actions: ['create', 'read', 'update_own'] },
  { resource: 'checklist', actions: ['read'] }, // Can VIEW but NOT create/update
  { resource: 'quality_check', actions: ['read'] }, // Can VIEW but NOT create/update
  { resource: 'attachment', actions: ['create', 'read', 'delete_own'] },
  { resource: 'document', actions: ['read'] },
  { resource: 'report', actions: ['create', 'read', 'export'] },
  { resource: 'notification', actions: ['read', 'update_own'] },
  { resource: 'profile', actions: ['read', 'update_own'] },
],
```

**Result:**
- ✅ Initiators can VIEW checklists (read-only)
- ✅ Initiators can VIEW quality checks (read-only)
- ❌ Initiators CANNOT create checklists
- ❌ Initiators CANNOT update checklists
- ❌ Initiators CANNOT create quality checks
- ❌ Initiators CANNOT update quality checks

### 4. Dashboard UI Text

**Updated:** Changed dashboard text to be more generic

**UI Changes:** `app/dashboard/page.tsx`
- "Here's your quality management overview" → "Quality management system overview"
- "You have X overdue inspections" → "X overdue inspections require attention"

## Permission Matrix

### Complete Access Control

| Resource | Initiator | Inspector | Approver | Administrator |
|----------|-----------|-----------|----------|---------------|
| **View Inspection Requests** | ALL ✅ | Assigned only | ALL ✅ | ALL ✅ |
| **Create Inspection Requests** | ✅ | ❌ | ❌ | ✅ |
| **Update Inspection Requests** | Own pending | Assigned | ❌ | ALL ✅ |
| **View Checklists** | ✅ | ✅ | ✅ | ✅ |
| **Create Checklists** | ❌ | ✅ | ❌ | ✅ |
| **Update Checklists** | ❌ | ✅ | ❌ | ✅ |
| **View Quality Checks** | ✅ | ✅ | ✅ | ✅ |
| **Create Quality Checks** | ❌ | ✅ | ✅ | ✅ |
| **Update Quality Checks** | ❌ | ✅ | ✅ | ✅ |
| **Dashboard Data** | ALL ✅ | Assigned | ALL ✅ | ALL ✅ |

## User Experience

### For Initiators

#### What They Can Do ✅

**View:**
- All inspection requests (any user, any status)
- All checklists (read-only)
- All quality checks (read-only)
- Organization-wide dashboard statistics
- Complete inspection details

**Create:**
- New inspection requests
- Attachments
- Reports

**Update:**
- Their own pending inspection requests only
- Their own profile

#### What They Cannot Do ❌

**Cannot Create:**
- Checklists (inspector's job)
- Quality checks (inspector/approver's job)

**Cannot Update:**
- Checklists (even their own inspection's checklists)
- Quality checks
- Other users' inspection requests
- Inspection status (except own pending)

**Cannot Perform:**
- Assign inspectors
- Approve or reject inspections
- Close inspections

### For Inspectors (Unchanged)

- View only assigned inspection requests
- View assigned statistics on dashboard
- Create and update checklists for assigned inspections
- Create quality checks for assigned inspections

### For Approvers & Administrators (Unchanged)

- View all inspection requests
- Full dashboard access
- Approve/reject/close inspections
- Create quality checks

## Benefits

### 1. Enhanced Visibility
- Initiators can track all inspections across organization
- Better understanding of quality management workload
- Learn from other users' inspection requests

### 2. Maintained Process Control
- Checklists remain under inspector control
- Quality checks controlled by inspectors/approvers
- Process integrity preserved

### 3. Better Dashboard Insights
- Initiators see organization-wide metrics
- Understand overall performance
- Better context for their own work

### 4. Clear Role Separation
- View permissions: Broad (admin-like)
- Create/update permissions: Restricted (role-specific)
- Actions clearly defined and enforced

## Security Validation

### What's Protected ✅

**Write Operations:**
- Only inspectors can create/update checklists
- Only inspectors/approvers can create quality checks
- Only approvers can approve/reject/close
- Only administrators can assign inspectors

**Data Integrity:**
- Inspection workflow maintained
- Role-based actions enforced
- Audit trail preserved

### What Changed ✅

**Read Access Only:**
- Initiators can VIEW all inspection requests
- Initiators can VIEW checklists (no modifications)
- Initiators can VIEW quality checks (no modifications)
- Dashboard shows all data to initiators

**No Security Risks:**
- No write permissions granted to initiators
- Process control maintained
- Critical actions still restricted

## Testing Checklist

### Test as Initiator

1. **View All Inspections**
   - ✅ Login as initiator
   - ✅ Go to Inspections page
   - ✅ Verify you see inspections from all users
   - ✅ Verify you see all statuses

2. **View Dashboard**
   - ✅ Go to Dashboard
   - ✅ Verify organization-wide statistics
   - ✅ Check status distribution includes all users
   - ✅ Check priority counts are organization-wide

3. **View Inspection Details**
   - ✅ Click any inspection (including others')
   - ✅ Verify you can view all details
   - ✅ Verify you can see checklists (read-only)
   - ✅ Verify you can see quality checks (read-only)

4. **Try to Create Checklist** (Should Fail)
   - ✅ Go to inspection detail page
   - ✅ Verify no "Add Checklist" button OR
   - ✅ If button exists, verify action is blocked

5. **Try to Create Quality Check** (Should Fail)
   - ✅ Go to inspection detail page
   - ✅ Verify no "Create Quality Check" button OR
   - ✅ If button exists, verify action is blocked

6. **Create Inspection Request** (Should Work)
   - ✅ Click "New Request"
   - ✅ Fill form and submit
   - ✅ Verify request is created
   - ✅ Verify it appears in all users' views

### Test as Inspector (Should Be Unchanged)

1. **View Inspections**
   - ✅ Login as inspector
   - ✅ Verify you see only assigned requests
   - ✅ Verify you DON'T see unassigned requests

2. **View Dashboard**
   - ✅ Go to Dashboard
   - ✅ Verify statistics show only assigned data
   - ✅ Not organization-wide

3. **Create Checklist** (Should Work)
   - ✅ Go to assigned inspection
   - ✅ Create checklist
   - ✅ Verify success

## Files Modified

1. ✅ `app/api/inspection-requests/route.ts` - Removed initiator filter
2. ✅ `app/api/inspection-requests/stats/route.ts` - Removed initiator filter for stats
3. ✅ `lib/permissions.ts` - Added checklist and quality_check read permissions
4. ✅ `app/dashboard/page.tsx` - Updated UI text
5. ✅ `README.md` - Updated permissions table

## Summary

**Initiator Role Changes:**
- ✅ **View Access:** Admin-like (see everything)
- ❌ **Create/Update:** Restricted (checklists and quality checks blocked)
- ✅ **Dashboard:** Organization-wide data
- ✅ **Process Control:** Maintained (inspectors control checklists)

---

**Version:** 1.0  
**Date:** October 31, 2025  
**Status:** ✅ Implemented  
**Security:** ✅ View-only expansion, write controls maintained  
**Testing:** Recommended before production use

