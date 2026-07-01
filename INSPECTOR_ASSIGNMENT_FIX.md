# Inspector Assignment Fix - Complete Guide

## Problem Identified

Inspector names were showing as "Unassigned" in the Quality Checks tab and Recent Quality Checks list even after creating quality checks.

## Root Causes Found

1. **Missing Database Column**: The `quality_checks` table didn't have the `inspection_request_id` column in the original schema
2. **Missing Inspector Field**: Quality check creation forms were missing the inspector selector field
3. **Data Type Mismatch**: Inspector ID was being sent as string instead of integer
4. **Existing Data**: One quality check (ID 2) in the database has `inspector_id = NULL`

## Solutions Implemented

### 1. Database Migration ✅

**File Created**: `scripts/run-migrations.js`

Ran the migration that adds:
- `inspection_request_id` column to `quality_checks` table
- Proper foreign key constraints
- Database indexes for performance

**Command**: `npm run db:migrate`

**Status**: ✅ Successfully completed

### 2. Form Updates ✅

#### Files Modified:
- `app/dashboard/inspections/[id]/page.tsx`
- `app/dashboard/quality-checks/[id]/page.tsx`
- `app/dashboard/quality-checks/page.tsx`

#### Changes Made:
1. **Added Inspector State Management**
   - Fetches list of inspectors from API
   - Stores inspector data in state

2. **Added Inspector Field to Create Quality Check Dialog**
   - Dropdown selector showing all inspectors
   - Displays inspector name and email
   - Optional field (can be left as "None")

3. **Added Inspector Field to Edit Quality Check Dialog**
   - Allows updating inspector on existing quality checks
   - Pre-fills with current inspector if assigned

4. **Fixed Data Type Conversion**
   - Converts `inspector_id` from string to integer before API submission
   - Ensures proper database storage

### 3. Verification Script ✅

**File Created**: `scripts/verify-quality-checks.js`

**Command**: `npm run db:verify-qc`

Displays:
- Database column structure
- Count of quality checks without inspectors
- Sample quality check data with inspector information

## Current Database Status

```
✅ Column structure:
   - inspection_request_id: integer
   - inspector_id: integer

📊 Quality checks without inspector: 1
📊 Quality checks without inspection request: 0

📋 Quality check (ID 2: "quality check 1"):
     Inspector: Unassigned (ID: NULL)
     Request: IR-OCT-002 (ID: 2)
```

## How to Fix Existing Quality Check

You have 3 options to fix the existing quality check showing "Unassigned":

### Option 1: Edit the Existing Quality Check ✅ RECOMMENDED

1. Navigate to **Dashboard > Quality Checks**
2. Find the quality check named "quality check 1"
3. Click the **Actions menu** (⋮) and select **Edit**
4. In the edit dialog, select an inspector from the **Inspector** dropdown
5. Click **Save Changes**

### Option 2: Create a New Quality Check ✅

1. Navigate to **Dashboard > Quality Checks**
2. Click **"New Check"** or go to an inspection detail page
3. In the Create Quality Check dialog:
   - Fill in the required fields
   - **Select an inspector** from the Inspector dropdown
   - Link to an inspection request
4. Click **Create Quality Check**

### Option 3: Delete and Recreate ✅

1. Navigate to **Dashboard > Quality Checks**
2. Find "quality check 1"
3. Click **Actions** > **Delete**
4. Create a new quality check with an inspector assigned

## Testing Checklist

- [x] Database migration completed
- [x] Inspector field added to all quality check forms
- [x] Data type conversion implemented
- [x] Existing data verified
- [ ] **USER ACTION**: Edit existing quality check to assign inspector
- [ ] **USER ACTION**: Test creating new quality check with inspector
- [ ] **USER ACTION**: Verify inspector name displays correctly in all views

## Files Modified

### Database & Scripts
- `scripts/run-migrations.js` (NEW)
- `scripts/verify-quality-checks.js` (NEW)
- `package.json` (updated with new scripts)

### Frontend Components
- `app/dashboard/inspections/[id]/page.tsx`
- `app/dashboard/quality-checks/[id]/page.tsx`
- `app/dashboard/quality-checks/page.tsx`

## New NPM Commands

```bash
# Run database migrations
npm run db:migrate

# Verify quality checks data
npm run db:verify-qc
```

## Expected Behavior After Fix

### When Creating Quality Checks
1. Form shows an **Inspector** dropdown with all available inspectors
2. Inspector can be selected (optional)
3. Upon submission, inspector ID is properly stored in database
4. Inspector name displays immediately in all views

### When Viewing Quality Checks
1. **Quality Checks Tab** (in inspection details)
   - Shows inspector name instead of "Unassigned"
   
2. **Recent Quality Checks List** (main page)
   - Inspector column shows actual inspector name
   - "Unassigned" only shown if no inspector was selected

### When Editing Quality Checks
1. Current inspector pre-filled in dropdown
2. Can change or remove inspector assignment
3. Changes save immediately

## Troubleshooting

### If Inspector Still Shows "Unassigned"

1. **Check the database directly**:
   ```bash
   npm run db:verify-qc
   ```

2. **Verify the inspector_id is set**:
   - If `inspector_id: NULL` in the output, the field wasn't saved
   - Make sure an inspector is selected in the form before submitting

3. **Check browser console** for errors during form submission

4. **Verify inspector exists**:
   - Go to **Dashboard > Users**
   - Check that users with role "inspector" exist
   - They must be "active" status

### If Form Doesn't Show Inspector Dropdown

1. **Check if inspectors exist** in the database
2. **Clear browser cache** and refresh
3. **Check browser console** for JavaScript errors

## Additional Notes

- Migrations are **idempotent** - safe to run multiple times
- Existing quality checks can be edited to add inspectors
- New quality checks automatically support inspector assignment
- Inspector field is **optional** - quality checks can be created without an inspector

---

**Last Updated**: 2025-10-22  
**Status**: ✅ Implementation Complete - User Testing Required

