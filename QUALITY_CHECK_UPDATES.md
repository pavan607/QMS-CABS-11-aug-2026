# Quality Check Updates - Pending Inspection Request Integration

## Overview
Enhanced the Quality Checks page to display pending inspection requests, allowing inspectors to easily select and create quality checks from existing inspection requests.

## Changes Made

### 1. **Users Page Fix** (`app/dashboard/users/page.tsx`)
Fixed runtime error where `<Select.Item />` components had empty string values, which is not allowed by Radix UI.

**Changes:**
- Updated initial state: `selectedRole` and `selectedStatus` from `''` to `'all'`
- Changed `<SelectItem value="">` to `<SelectItem value="all">`
- Updated filtering logic to exclude `'all'` value when building API query parameters

### 2. **Quality Checks Page Enhancements** (`app/dashboard/quality-checks/page.tsx`)

#### a. Pending Inspection Requests Section
Added a new card section that displays all pending inspection requests (status: `pending`, `assigned`, or `in_progress`).

**Features:**
- **Visual Information Display:**
  - Request number badge
  - Priority badge (critical, high, medium, low) with color coding
  - Status badge with appropriate colors
  - Location and item details with icons
  - Due date display
  - Inspector name (if assigned)

- **Quick Action:**
  - Click anywhere on the inspection request card to create a quality check
  - "Create Check" button for explicit action

#### b. Auto-Fill Form Functionality
When an inspector selects a pending inspection request:
- Form automatically populates with:
  - **Name:** `Quality Check - [Inspection Request Title]`
  - **Inspection Request:** Pre-selected from the dropdown
  - **Check Date:** Current date
  - **Notes:** Pre-filled with reference to the inspection request number

#### c. Enhanced Data Fetching
- Filters inspection requests to show only pending ones
- Prevents completed requests from appearing in the selection list

#### d. UI Components Updates
- **New Imports:** Added `Clock`, `MapPin`, and `Package` icons from Lucide React
- **New Badge Helpers:**
  - `getPriorityBadge()` - Color-coded priority badges
  - `getStatusBadge()` - Status badges with appropriate colors

#### e. Select Component Upgrade
- Replaced native HTML `<select>` with shadcn/ui `<Select>` component for consistency
- Better user experience with styled dropdown

## User Workflow

### Inspector's Process:
1. Navigate to Quality Checks page (`/dashboard/quality-checks`)
2. View **Pending Inspection Requests** section showing all available requests
3. Review inspection request details:
   - Request number and title
   - Priority level
   - Current status
   - Location and item to inspect
   - Due date
   - Assigned inspector
4. Click on a pending inspection request card
5. Dialog opens with pre-filled information
6. Complete remaining fields (score, additional notes)
7. Submit to create quality check

### Alternative: Manual Creation
- Click "New Check" button in header
- Manually select inspection request from dropdown
- Fill in all required fields
- Submit

## Technical Details

### Updated Interfaces
```typescript
interface InspectionRequest {
  id: number;
  request_number: string;
  title: string;
  status: string;
  priority: string;
  location: string;
  item: string;
  inspection_type: string;
  due_date: string;
  initiator_name?: string;
  inspector_name?: string;
}
```

### New Functions
- `handleSelectInspectionRequest(request: InspectionRequest)` - Pre-fills form and opens dialog
- `getPriorityBadge(priority: string)` - Returns styled priority badge
- `getStatusBadge(status: string)` - Returns styled status badge

### Filter Logic
```javascript
const pendingRequests = (data.requests || []).filter((req: InspectionRequest) => 
  ['pending', 'assigned', 'in_progress'].includes(req.status)
);
```

## Visual Design

### Priority Badge Colors:
- **Critical:** Red (`bg-red-600`)
- **High:** Orange (`bg-orange-500`)
- **Medium:** Yellow (`bg-yellow-500`)
- **Low:** Blue (`bg-blue-500`)

### Status Badge Colors:
- **Pending:** Gray (`bg-gray-500`)
- **Assigned:** Blue (`bg-blue-500`)
- **In Progress:** Yellow (`bg-yellow-500`)
- **Completed:** Green (`bg-green-500`)

## Benefits

1. **Improved Efficiency:**
   - Inspectors can see all pending requests in one place
   - No need to remember request numbers
   - Quick one-click quality check creation

2. **Better Visibility:**
   - Clear overview of pending work
   - Priority-based decision making
   - Due date awareness

3. **Reduced Errors:**
   - Auto-filled forms reduce data entry mistakes
   - Pre-validated inspection request selection
   - Consistent quality check naming

4. **Enhanced User Experience:**
   - Visual feedback with icons and badges
   - Hover effects for interactivity
   - Clean, organized layout

## Testing Recommendations

1. **Test Pending Request Display:**
   - Verify only pending/assigned/in_progress requests appear
   - Confirm completed requests are filtered out

2. **Test Form Auto-Fill:**
   - Click on different inspection requests
   - Verify form populates correctly
   - Check that dialog opens with proper data

3. **Test Quality Check Creation:**
   - Create quality check from pending request
   - Verify link between quality check and inspection request
   - Check that quality check appears in the main table

4. **Test Edge Cases:**
   - No pending requests available
   - Multiple pending requests
   - Very long inspection request titles

## Future Enhancements (Optional)

1. **Filtering Options:**
   - Filter by priority
   - Filter by due date
   - Search by location or item

2. **Sorting:**
   - Sort by priority
   - Sort by due date
   - Sort by status

3. **Bulk Actions:**
   - Create multiple quality checks at once
   - Assign multiple requests to inspector

4. **Notifications:**
   - Alert inspectors of overdue inspection requests
   - Notify when new inspection requests are assigned

## Files Modified

1. `app/dashboard/users/page.tsx` - Fixed Select component empty value error
2. `app/dashboard/quality-checks/page.tsx` - Added pending inspection requests integration

## No Database Changes Required
All functionality uses existing database schema. The `inspection_request_id` column already exists in the `quality_checks` table (added via migration `001_add_inspection_request_fields.sql`).


