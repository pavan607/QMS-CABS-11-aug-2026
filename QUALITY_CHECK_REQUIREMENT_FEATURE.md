# Quality Check Requirement Feature

## Overview
This feature enforces a business rule that requires at least one quality check to be completed before an inspection can be marked as complete.

## Business Rule
**An inspection request MUST have at least 1 completed quality check (with result "passed" or "failed") before it can be marked as complete.**

## Implementation

### Frontend Validation (`app/dashboard/quality-checks/[id]/page.tsx`)

#### 1. Mark Complete Button Logic
- **Location**: Lines 606-631
- **Behavior**:
  - Button is **disabled** if no quality checks are completed
  - Warning message displayed when button is disabled
  - Message: "⚠ At least 1 quality check must be completed"

```typescript
const hasCompletedQualityChecks = inspection.quality_checks && 
  inspection.quality_checks.some((qc: QualityCheck) => 
    qc.result === 'passed' || qc.result === 'failed'
  );
```

#### 2. Quality Checks Tab Label
- **Location**: Line 729-731
- **Shows**: `"Quality Checks (X/Y completed)"`
- **Example**: "Quality Checks (1/3 completed)"

#### 3. Quality Checks Tab Content Banner
- **Location**: Lines 984-1013
- **Displays**:
  - **Green banner** when requirement is met: "✓ Quality Check Requirement Met (X/Y completed)"
  - **Orange banner** when requirement is NOT met: "⚠ Quality Check Required: X/Y completed (minimum 1 required to complete inspection)"
- **Only shown** when inspection status is `"in_progress"`

#### 4. Enhanced Error Handling
- **Location**: Lines 170-188
- **Shows alert** with backend error message if validation fails
- **Error message**: From backend validation

### Backend Validation (`app/api/inspection-requests/[id]/status/route.ts`)

#### Quality Check Validation
- **Location**: Lines 65-83
- **Triggered**: When status is being changed to `"completed"`
- **Validation**:
  ```sql
  SELECT COUNT(*) as total_checks,
         COUNT(CASE WHEN result IN ('passed', 'failed') THEN 1 END) as completed_checks
         FROM quality_checks 
         WHERE inspection_request_id = $1
  ```
- **Error Response**: HTTP 400 with message:
  - "At least one quality check must be completed before marking the inspection as complete"

## User Experience Flow

### Scenario 1: No Quality Checks Completed
1. User is on inspection detail page (status: "in_progress")
2. Quality Checks tab shows: "Quality Checks (0/0 completed)"
3. Orange banner displays: "⚠ Quality Check Required: 0/0 completed (minimum 1 required to complete inspection)"
4. "Mark Complete" button is **disabled** with warning message
5. User cannot complete the inspection

### Scenario 2: At Least 1 Quality Check Completed
1. User creates a quality check and sets result to "passed" or "failed"
2. Quality Checks tab updates to: "Quality Checks (1/1 completed)"
3. Green banner displays: "✓ Quality Check Requirement Met (1/1 completed)"
4. "Mark Complete" button is **enabled**
5. User can now complete the inspection

### Scenario 3: Some Quality Checks Pending
1. User has 3 quality checks total
2. 1 is completed (passed/failed), 2 are still "pending"
3. Quality Checks tab shows: "Quality Checks (1/3 completed)"
4. Green banner displays: "✓ Quality Check Requirement Met (1/3 completed)"
5. "Mark Complete" button is **enabled** (requirement met)

### Scenario 4: Backend Validation Catches Attempt
1. User somehow bypasses frontend validation
2. Attempts to mark inspection as complete without quality checks
3. Backend returns HTTP 400 error
4. Frontend shows alert: "At least one quality check must be completed before marking the inspection as complete"
5. Status does not change

## Completed Quality Check Definition
A quality check is considered "completed" if its result is:
- `"passed"` - Quality check passed
- `"failed"` - Quality check failed (but completed)

A quality check with result `"pending"` is NOT considered completed.

## Visual Indicators

### Disabled Button State
```
┌─────────────────────────────┐
│  ✓ Mark Complete (DISABLED) │
└─────────────────────────────┘
⚠ At least 1 quality check must be completed
```

### Orange Warning Banner
```
┌────────────────────────────────────────────────────────────┐
│ ⚠ Quality Check Required: 0/2 completed                    │
│   (minimum 1 required to complete inspection)              │
└────────────────────────────────────────────────────────────┘
```

### Green Success Banner
```
┌────────────────────────────────────────────────────────────┐
│ ✓ Quality Check Requirement Met (2/2 completed)            │
└────────────────────────────────────────────────────────────┘
```

## Testing Checklist

- [ ] Create inspection and start it (status: in_progress)
- [ ] Verify "Mark Complete" button is disabled with no quality checks
- [ ] Verify orange warning banner is displayed
- [ ] Create a quality check with result "pending"
- [ ] Verify button is still disabled (pending doesn't count)
- [ ] Update quality check result to "passed"
- [ ] Verify button is now enabled
- [ ] Verify green success banner is displayed
- [ ] Click "Mark Complete" button
- [ ] Verify inspection status changes to "completed"
- [ ] Test backend validation by attempting API call without quality checks
- [ ] Verify proper error message is returned

## Files Modified

1. `app/dashboard/quality-checks/[id]/page.tsx`
   - Added button disable logic
   - Added validation warning message
   - Updated tab label to show completion count
   - Added requirement status banner
   - Enhanced error handling

2. `app/api/inspection-requests/[id]/status/route.ts`
   - Added backend validation for quality check requirement
   - Returns HTTP 400 with descriptive error message

## Benefits

1. **Data Quality**: Ensures all inspections have documented quality checks
2. **Process Compliance**: Enforces business rules at both UI and API level
3. **User Guidance**: Clear visual feedback about requirements
4. **Error Prevention**: Prevents invalid state transitions
5. **Audit Trail**: Quality checks are required and recorded

## Related Features
- Quality Check Result Values Fix (QUALITY_CHECK_RESULT_FIX.md)
- Inspection Request Workflow
- Quality Check Management

