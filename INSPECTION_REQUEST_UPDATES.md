# Inspection Request & Quality Check Updates

## Summary of Changes

This document outlines the updates made to the QMS system for inspection requests and quality checks.

### 1. Inspection Request ID Format
- **New Format**: `IR-MONTH-NUMBER`
  - Example: `IR-OCT-001`, `IR-OCT-002`, etc.
  - `IR` = Inspection Request prefix
  - `MONTH` = 3-letter month abbreviation (JAN, FEB, MAR, etc.)
  - `NUMBER` = Sequential 3-digit number for the month (001, 002, etc.)

### 2. Inspection Request Date
- Added `request_date` field to inspection requests
- Defaults to the current date when creating a new request
- Can be customized during creation

### 3. Quality Check Link to Inspection Requests
- Quality checks now **require** an existing inspection request
- Users must select from available inspection requests when creating a quality check
- Quality check list displays the associated inspection request number and title

## Database Changes

### Migration File
Location: `database/migrations/001_add_inspection_request_fields.sql`

**Key Changes:**
1. Added `request_date` DATE field to `inspection_requests` table
2. Added `inspection_request_id` foreign key to `quality_checks` table
3. Created `generate_inspection_request_number()` function for auto-generating IDs
4. Migrated existing inspection request numbers to new format

## API Changes

### Inspection Requests API (`/api/inspection-requests`)
**POST endpoint changes:**
- Now uses `generate_inspection_request_number()` function
- Accepts optional `request_date` parameter (defaults to today)
- Auto-generates ID in `IR-MONTH-NUMBER` format

**Example Request:**
```json
{
  "title": "Equipment Safety Inspection",
  "description": "Monthly safety check",
  "location": "Factory Floor A",
  "item": "Production Line 1",
  "inspection_type": "safety",
  "priority": "high",
  "request_date": "2025-10-21",
  "due_date": "2025-10-25"
}
```

**Example Response:**
```json
{
  "request": {
    "id": 1,
    "request_number": "IR-OCT-001",
    "request_date": "2025-10-21",
    "title": "Equipment Safety Inspection",
    ...
  }
}
```

### Quality Checks API (`/api/quality-checks`)
**POST endpoint changes:**
- Now **requires** `inspection_request_id` parameter
- Validates that the inspection request exists
- Returns inspection request info with quality check data

**Example Request:**
```json
{
  "name": "Production Line Quality Audit",
  "inspection_request_id": 1,
  "check_date": "2025-10-21",
  "score": 85,
  "notes": "All checks passed"
}
```

**GET endpoint changes:**
- Now includes `inspection_request_number` and `inspection_request_title` in results

## UI Changes

### Inspection Requests Page (`/dashboard/inspections`)
**Form Updates:**
- Added "Request Date" field (defaults to today)
- Request number is auto-generated on the server

### Quality Checks Page (`/dashboard/quality-checks`)
**Form Updates:**
- Added "Inspection Request" dropdown (required field)
- Dropdown shows: `{request_number} - {title}`
- Help text: "Quality checks must be linked to an existing inspection request"

**Table Updates:**
- Added "Inspection Request" column
- Shows request number and title for each quality check

## How to Apply Changes

### 1. Run Database Migration
```bash
# Option 1: Run database init (includes migration)
npm run db:init

# Option 2: Run migration directly
psql -U your_user -d your_db -f database/migrations/001_add_inspection_request_fields.sql
```

### 2. Verify Migration
Check that the migration was successful:
```sql
-- Check for new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name='inspection_requests' AND column_name='request_date';

SELECT column_name FROM information_schema.columns 
WHERE table_name='quality_checks' AND column_name='inspection_request_id';

-- Check for the function
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'generate_inspection_request_number';
```

### 3. Test the New Features

**Create an Inspection Request:**
1. Go to `/dashboard/inspections`
2. Click "New Request"
3. Fill in the form (note the Request Date field)
4. Submit and verify the ID format (IR-OCT-XXX)

**Create a Quality Check:**
1. Go to `/dashboard/quality-checks`
2. Click "New Check"
3. Select an inspection request from the dropdown
4. Fill in other details and submit
5. Verify the inspection request info appears in the table

## Technical Details

### Request Number Generation Logic
The `generate_inspection_request_number()` function:
1. Gets the current month abbreviation
2. Finds the highest number used for that month/year
3. Increments by 1 and pads with zeros
4. Returns the formatted string

### Data Integrity
- Foreign key constraint on `quality_checks.inspection_request_id`
- If an inspection request is deleted, linked quality checks set `inspection_request_id` to NULL (ON DELETE SET NULL)
- Index added on `quality_checks.inspection_request_id` for performance

## Backward Compatibility

- Existing inspection requests are automatically migrated to the new format
- Month abbreviation based on `request_date` or `created_at`
- Sequential numbering preserved within each month
- No data loss during migration

## Future Enhancements

Potential improvements:
1. Add year to the ID format (e.g., `IR-2025-OCT-001`)
2. Filter quality checks by inspection request
3. Display all quality checks for an inspection request
4. Generate reports grouped by inspection request


