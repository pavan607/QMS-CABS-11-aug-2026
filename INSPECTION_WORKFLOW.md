# Inspection Workflow & Features

## Complete Inspection Lifecycle

### 1. **Initiation**
- **Who:** Initiators
- **Action:** Create inspection request
- **Details:** Title, description, location, item, type, priority, due date
- **Status:** `pending`

### 2. **Assignment**
- **Who:** Administrators only
- **Action:** Assign inspector and (optionally) approver
- **Validation:** 
  - Only users with `inspector` role can be assigned as inspectors
  - Only users with `approver` or `administrator` role can be assigned as approvers
- **Status:** `pending` → `assigned`
- **Notifications:** Inspector and initiator are notified

### 3. **Inspection Execution**
- **Who:** Assigned inspector ONLY
- **Permission Check:** Only the assigned inspector can update the inspection
- **Actions:**
  - Start inspection: `assigned` → `in_progress`
  - Create checklists and checklist items
  - Upload attachments (photos, evidence)
  - Add inspection notes and findings
  - Complete inspection: `in_progress` → `completed`
- **Restrictions:**
  - Checklists can only be created/modified by the assigned inspector
  - Status can only be updated by the assigned inspector
  - Other inspectors cannot interfere with assigned inspections

### 4. **Approval**
- **Who:** Approvers and administrators
- **Requirement:** Inspection must be in `completed` status
- **Actions:**
  - **Approve:** `completed` → `approved`
  - **Reject:** `completed` → `rejected` (with reason)
- **Status:** `completed` → `approved` or `rejected`
- **Notifications:** Initiator and inspector are notified

### 5. **Closure** (NEW)
- **Who:** Approvers and administrators
- **Requirement:** Inspection must be in `approved` status
- **Action:** Official closure of the inspection
- **Status:** `approved` → `closed`
- **Notes:** Optional closing notes can be added
- **Finality:** Closed inspections cannot be modified (final state)
- **Notifications:** All stakeholders are notified

## Status Flow

```
pending → assigned → in_progress → completed → approved → closed
                                              ↘
                                               rejected
```

## Role-Based Permissions

### Initiator
- ✅ Create inspection requests
- ✅ View own requests
- ✅ Upload attachments to own requests
- ❌ Cannot assign inspectors
- ❌ Cannot perform inspections
- ❌ Cannot approve/reject
- ❌ Cannot close

### Inspector
- ✅ View requests assigned to them
- ✅ Update status of assigned requests (`assigned` → `in_progress` → `completed`)
- ✅ Create/modify checklists for assigned requests
- ✅ Upload attachments/evidence for assigned requests
- ✅ Add findings and notes
- ❌ Cannot work on requests not assigned to them
- ❌ Cannot assign inspectors
- ❌ Cannot approve/reject
- ❌ Cannot close

### Approver
- ✅ View all inspection requests
- ✅ Approve completed inspections
- ✅ Reject completed inspections (with reason)
- ✅ Close approved inspections
- ✅ Generate reports
- ❌ Cannot assign inspectors
- ❌ Cannot modify checklists
- ❌ Cannot perform inspections

### Administrator
- ✅ Full access to all features
- ✅ Assign inspectors and approvers
- ✅ View all requests
- ✅ Perform any action
- ✅ Override permissions when needed
- ✅ Manage users and settings

## Enforcement Mechanisms

### 1. Assignment Enforcement
```typescript
// In checklist routes
if (userRole === 'inspector' && checklist.inspector_id !== userId) {
  return error('You can only update checklists for requests assigned to you');
}
```

### 2. Status Transition Enforcement
```typescript
// Only assigned inspector can update status
if (userRole === 'inspector' && existingRequest.inspector_id !== userId) {
  return error('You can only update requests assigned to you');
}

// Check allowed transitions
const allowedTransitions = getAllowedStatusTransitions(userRole, currentStatus);
if (!allowedTransitions.includes(newStatus)) {
  return error('Cannot transition from ${currentStatus} to ${newStatus}');
}
```

### 3. Approval Enforcement
```typescript
// Request must be completed before approval
if (existingRequest.status !== 'completed') {
  return error('Request must be completed before approval');
}
```

### 4. Closure Enforcement
```typescript
// Request must be approved before closure
if (existingRequest.status !== 'approved') {
  return error('Request must be approved before closure');
}
```

## API Endpoints

### Assignment
```http
PUT /api/inspection-requests/[id]/assign
Body: { inspector_id, approver_id? }
Permission: administrator only
```

### Status Updates
```http
PUT /api/inspection-requests/[id]/status
Body: { status }
Permission: based on role and assignment
```

### Approval
```http
PUT /api/inspection-requests/[id]/approve
Permission: approver, administrator
Requirement: status === 'completed'
```

### Rejection
```http
PUT /api/inspection-requests/[id]/reject
Body: { reason }
Permission: approver, administrator
Requirement: status === 'completed'
```

### Closure (NEW)
```http
PUT /api/inspection-requests/[id]/close
Body: { notes? }
Permission: approver, administrator
Requirement: status === 'approved'
```

## Database Schema Updates

### New Fields in `inspection_requests`
```sql
closed_date TIMESTAMP        -- When inspection was closed
closed_by INTEGER            -- User who closed the inspection
```

## Notification Events

1. **Request Submitted** → Administrators
2. **Request Assigned** → Inspector + Initiator
3. **Inspection Completed** → Approvers + Initiator
4. **Inspection Approved** → Initiator + Inspector
5. **Inspection Rejected** → Initiator + Inspector
6. **Inspection Closed** (NEW) → All stakeholders

## Audit Trail

All actions are logged in the `audit_logs` table:
- Who performed the action
- What was changed (old vs new values)
- When it happened
- IP address and user agent (when available)

## Activity Timeline

All inspection activities are tracked in `inspection_activities`:
- Status changes
- Checklist completions
- Approvals/rejections
- Closures
- File uploads

## Best Practices

1. **Always assign an inspector** before inspection can begin
2. **Only assigned inspectors** should work on inspections
3. **Complete all checklists** before marking as completed
4. **Provide detailed rejection reasons** when rejecting
5. **Add closing notes** when closing to document final state
6. **Review all evidence** before approval
7. **Use proper permissions** - don't work around the system

## Testing the Workflow

### Test Account Credentials
```
Administrator: admin@qms.com / admin123
Inspector: inspector@qms.com / admin123
Approver: approver@qms.com / admin123
Initiator: initiator@qms.com / admin123
```

### Test Scenarios

1. **Complete Happy Path:**
   - Login as Initiator → Create request
   - Login as Administrator → Assign to Inspector
   - Login as Inspector → Start → Complete with checklists
   - Login as Approver → Approve
   - Login as Approver → Close

2. **Test Assignment Enforcement:**
   - Create request assigned to Inspector A
   - Login as Inspector B
   - Try to modify checklist → Should fail

3. **Test Status Transitions:**
   - Try to approve a request that's not completed → Should fail
   - Try to close a request that's not approved → Should fail

4. **Test Rejections:**
   - Complete inspection
   - Reject with reason
   - Verify initiator and inspector receive notifications

## Troubleshooting

### "You can only update requests assigned to you"
- Verify you're logged in as the correct inspector
- Check the assignment in the database
- Administrator can override if needed

### "Request must be completed before approval"
- Inspector needs to mark the inspection as completed first
- Verify all required checklists are filled

### "Request must be approved before closure"
- Approver needs to approve the inspection first
- Cannot close rejected inspections directly

---

**Updated:** With closure feature and enhanced permission enforcement


