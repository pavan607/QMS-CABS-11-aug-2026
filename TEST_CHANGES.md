# Testing Guide for Inspection Request Updates

## Prerequisites
- Database is running
- Application dependencies installed (`npm install`)
- Database schema and migration applied

## Step-by-Step Testing

### 1. Apply Database Migration

Run the database initialization (which includes the migration):

```bash
npm run db:init
```

Or if you prefer to run just the migration:

```bash
# Using psql
psql -U postgres -d qms -f database/migrations/001_add_inspection_request_fields.sql
```

### 2. Start the Application

```bash
npm run dev
```

The application should start on `http://localhost:3000`

### 3. Login

Use one of the default accounts:
- **Admin**: admin@qms.com / admin123
- **Initiator**: initiator@qms.com / admin123
- **Inspector**: inspector@qms.com / admin123

### 4. Test Inspection Request Creation

1. Navigate to **Dashboard → Inspections**
2. Click **"New Request"**
3. Fill in the form:
   - **Title**: Test Safety Inspection
   - **Description**: Testing new IR-MONTH-NUM format
   - **Location**: Factory Floor A
   - **Item**: Production Line 1
   - **Inspection Type**: Safety
   - **Priority**: High
   - **Request Date**: (will default to today - you can change it)
   - **Due Date**: (select a future date)
4. Click **"Create Request"**

**Expected Result:**
- Request is created successfully
- Request number shows format like **IR-OCT-001** (based on current month)
- Request date is displayed

### 5. Create Another Inspection Request

Repeat step 4 with different details.

**Expected Result:**
- Second request gets sequential number: **IR-OCT-002**

### 6. Test Quality Check Creation

1. Navigate to **Dashboard → Quality Checks**
2. Click **"New Check"**
3. Fill in the form:
   - **Check Name**: Production Line Quality Audit
   - **Inspection Request**: Select one of the requests created above (e.g., "IR-OCT-001 - Test Safety Inspection")
   - **Check Date**: (defaults to today)
   - **Score**: 85
   - **Notes**: All parameters within acceptable range
4. Click **"Add Check"**

**Expected Result:**
- Quality check is created successfully
- Table shows the quality check with the linked inspection request
- Inspection Request column displays both the request number and title

### 7. Try Creating Quality Check Without Inspection Request

1. Click **"New Check"**
2. Fill in all fields EXCEPT "Inspection Request"
3. Try to submit

**Expected Result:**
- Form validation prevents submission
- Error message indicates inspection request is required

### 8. Verify Data in Database

```sql
-- Check inspection requests
SELECT id, request_number, request_date, title, created_at 
FROM inspection_requests 
ORDER BY created_at DESC 
LIMIT 5;

-- Verify request number format
SELECT request_number 
FROM inspection_requests 
WHERE request_number ~ '^IR-[A-Z]{3}-\d{3}$';

-- Check quality checks with inspection requests
SELECT 
  qc.id,
  qc.name,
  qc.inspection_request_id,
  ir.request_number,
  ir.title
FROM quality_checks qc
LEFT JOIN inspection_requests ir ON qc.inspection_request_id = ir.id
ORDER BY qc.created_at DESC;
```

### 9. Test Month Rollover

To test the sequential numbering resets per month:

```sql
-- Manually insert a request with a different month
INSERT INTO inspection_requests (
  request_number, title, description, location, item, 
  inspection_type, priority, due_date, request_date, initiator_id, status
) VALUES (
  'IR-NOV-001', 'Test November Request', 'Testing month change', 
  'Test Location', 'Test Item', 'routine', 'medium', 
  '2025-11-30', '2025-11-01', 1, 'pending'
);
```

Then create a new request in November (or change system date):
- Should get **IR-NOV-002**

## Expected Results Summary

✅ **Inspection Requests:**
- Auto-generate ID in format `IR-MONTH-NUMBER`
- Sequential numbering within each month
- Request date field is present and defaults to today

✅ **Quality Checks:**
- Require selection of an existing inspection request
- Display inspection request info in the list
- Cannot be created without selecting an inspection request

✅ **Database:**
- `request_date` column exists in `inspection_requests`
- `inspection_request_id` column exists in `quality_checks`
- `generate_inspection_request_number()` function exists and works

## Troubleshooting

### Issue: Migration fails
**Solution:** Make sure the database is running and you have the correct credentials in `.env`

### Issue: Request number doesn't follow format
**Solution:** Verify the `generate_inspection_request_number()` function exists:
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'generate_inspection_request_number';
```

### Issue: Can't create quality check
**Solution:** Make sure you have at least one inspection request created first

### Issue: Inspection request dropdown is empty
**Solution:** Create some inspection requests first, then refresh the quality checks page

## API Testing (Optional)

### Test with cURL or Postman

**Create Inspection Request:**
```bash
curl -X POST http://localhost:3000/api/inspection-requests \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Test Request",
    "description": "Testing via API",
    "location": "Test Location",
    "item": "Test Item",
    "inspection_type": "routine",
    "priority": "medium",
    "request_date": "2025-10-21",
    "due_date": "2025-10-25"
  }'
```

**Create Quality Check:**
```bash
curl -X POST http://localhost:3000/api/quality-checks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test Check",
    "inspection_request_id": 1,
    "check_date": "2025-10-21",
    "score": 90,
    "notes": "Test notes"
  }'
```

## Success Criteria

- ✅ Inspection requests created with correct ID format
- ✅ Sequential numbering works within each month
- ✅ Request date is captured and displayed
- ✅ Quality checks require inspection request selection
- ✅ Quality checks display linked inspection request info
- ✅ No console errors or warnings
- ✅ Database constraints are working properly


