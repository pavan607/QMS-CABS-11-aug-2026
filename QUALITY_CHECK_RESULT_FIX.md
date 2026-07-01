# Quality Check Result Values Fix

## Issue
Quality checks were being marked as "pass" but the statistics were not updating the passed count or percentage correctly.

## Root Cause
There was an inconsistency in the result values used across the application:

1. **Form Input Values**: The quality check creation form used `"pass"` and `"fail"` as dropdown values
2. **Database & Stats Query**: The statistics API and display logic expected `"passed"` and `"failed"`

This mismatch caused:
- Passed count to remain at 0 even when checks were marked as "pass"
- Percentage calculations to be incorrect
- Display badges to not show the correct status

## Files Changed

### 1. `app/dashboard/quality-checks/[id]/page.tsx`
**Changes:**
- Fixed Select dropdown values from `"pass"`/`"fail"` to `"passed"`/`"failed"` (line 1556-1557)
- Removed empty string SelectItem value for inspector selection (line 1524)

### 2. `app/dashboard/quality-checks/page.tsx`
**Changes:**
- Removed empty string SelectItem values for inspector selection (lines 936 and 1019)

### 3. `database/migrations/003_fix_quality_check_result_values.sql`
**New Migration File:**
- Updates existing quality check records from `"pass"` to `"passed"`
- Updates existing quality check records from `"fail"` to `"failed"`
- Adds documentation comment to the result column

### 4. `scripts/run-migrations.js`
**Changes:**
- Added migration 003 to the migration script

## Database Impact
The migration updates any existing quality check records:
```sql
UPDATE quality_checks SET result = 'passed' WHERE result = 'pass';
UPDATE quality_checks SET result = 'failed' WHERE result = 'fail';
```

## Expected Result Values
The quality check `result` column now accepts only these values:
- `"pending"` - Default state, check not yet completed
- `"passed"` - Check completed successfully
- `"failed"` - Check completed with failure

## Statistics Calculation
The stats API (`/api/quality-checks/stats`) correctly counts:
```sql
COUNT(CASE WHEN result = 'passed' THEN 1 END) as passed_count
COUNT(CASE WHEN result = 'failed' THEN 1 END) as failed_count
COUNT(CASE WHEN result = 'pending' THEN 1 END) as pending_count
```

## Additional Fix
Fixed the empty string value error in Select components by removing `<SelectItem value="">None</SelectItem>` entries, as empty strings are reserved for clearing selections and cannot be used as valid option values.

## Testing
1. Create a new quality check and set result to "Passed"
2. Verify the passed count increases on the quality checks page
3. Verify the percentage calculation is correct
4. Edit an existing quality check and change result to "Failed"
5. Verify the failed count increases and passed count decreases

## Migration Status
✅ Migration 003 completed successfully

