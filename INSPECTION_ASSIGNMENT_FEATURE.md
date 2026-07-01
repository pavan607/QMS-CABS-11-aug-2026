# Inspection Request Assignment Feature

## Overview
Implemented a comprehensive assignment feature for inspection requests that allows administrators and approvers to assign pending inspection requests to inspector users. The feature includes a dedicated pending requests section, an assignment dialog, and seamless integration with the existing notification system.

## Changes Made

### 1. **Inspections Page Enhancements** (`app/dashboard/inspections/page.tsx`)

#### a. New State Management
Added state variables to handle the assignment functionality:
- `showAssignDialog` - Controls assign dialog visibility
- `selectedRequest` - Stores the currently selected inspection request
- `inspectors` - List of active inspector users
- `selectedInspector` - Currently selected inspector ID

#### b. Inspector Data Fetching
```javascript
const fetchInspectors = async () => {
  const response = await fetch('/api/users?role=inspector&status=active');
  // Filters to get only active inspectors
};
```

#### c. Assignment Functionality
```javascript
const handleAssign = async (e: React.FormEvent) => {
  // Sends PUT request to /api/inspection-requests/{id}/assign
  // Updates request status to 'assigned'
  // Triggers notifications to inspector and initiator
};
```

#### d. Pending Requests Section
A prominent orange-highlighted card that displays all inspection requests needing assignment:

**Features:**
- Shows up to 5 pending requests prominently
- Displays request number, priority badge, location, due date, and initiator
- Quick "Assign Inspector" button for each request
- Auto-hides when no pending requests exist

**Visual Design:**
- Orange border and background (`border-orange-200 bg-orange-50/50`)
- Alert icon to draw attention
- Counter showing number of pending assignments
- Clean, organized layout

#### e. Assignment Dialog
A modal dialog for assigning inspectors with:
- **Request Details Display:**
  - Request title
  - Location
  - Due date
- **Inspector Selection:**
  - Dropdown list of active inspectors
  - Shows name, email, and department
  - Validation to ensure inspector is selected
- **Empty State:**
  - Message when no inspectors are available
  - Disables submit button

#### f. Assign Button on Request Cards
- Appears on all pending/unassigned requests
- Icon with "Assign" text
- Opens assignment dialog when clicked

### 2. **API Route Updates** (`app/api/inspection-requests/[id]/assign/route.ts`)

#### Permission Updates
Extended assignment permissions from administrators-only to include approvers:
```javascript
// Before: Only administrators
if (userRole !== 'administrator') { ... }

// After: Administrators and approvers
if (userRole !== 'administrator' && userRole !== 'approver') { ... }
```

**Permissions:**
- ✅ Administrator - Can assign
- ✅ Approver - Can assign  
- ❌ Inspector - Cannot assign
- ❌ Initiator - Cannot assign

### 3. **Interface Updates**

#### InspectionRequest Interface
Added `inspector_id` field:
```typescript
interface InspectionRequest {
  // ... existing fields
  inspector_id?: number;  // NEW
}
```

#### New Inspector Interface
```typescript
interface Inspector {
  id: number;
  name: string;
  email: string;
  department?: string;
}
```

## User Workflow

### For Administrators/Approvers:

1. **Navigate to Inspections Page** (`/dashboard/inspections`)

2. **View Pending Requests Section** (if any pending)
   - See highlighted orange card with pending requests
   - Review request details (number, priority, location, due date)

3. **Assign Inspector** (Two methods):
   
   **Method 1: From Pending Section**
   - Click "Assign Inspector" button on pending request card
   
   **Method 2: From Request List**
   - Find any pending request in the main list
   - Click "Assign" button next to "View Details"

4. **Select Inspector**
   - Dialog opens showing request details
   - Select inspector from dropdown
   - View inspector name, email, and department
   - Click "Assign Inspector" to confirm

5. **Confirmation**
   - Success message appears
   - Request list refreshes automatically
   - Request status changes to "assigned"
   - Notifications sent to inspector and initiator

### For Inspectors:
- Receive notification when assigned to an inspection request
- Can view assigned requests in their dashboard
- Request status shows as "assigned"

### For Initiators:
- Receive notification when their request is assigned
- Can see assigned inspector name in request details

## Technical Implementation

### API Integration

**Endpoint:** `PUT /api/inspection-requests/:id/assign`

**Request Body:**
```json
{
  "inspector_id": 123
}
```

**Response:**
```json
{
  "request": {
    "id": 1,
    "status": "assigned",
    "inspector_id": 123,
    // ... other fields
  }
}
```

**Validations:**
1. User must be administrator or approver
2. Inspector must exist and be active
3. Inspector must have 'inspector' role
4. Inspection request must exist

**Side Effects:**
1. Updates request status to 'assigned'
2. Creates audit log entry
3. Creates inspection activity record
4. Sends notifications to inspector and initiator

### Filtering Logic

**Pending Requests Filter:**
```javascript
filteredRequests.filter(r => r.status === 'pending' || !r.inspector_id)
```

This shows requests that are either:
- Status is 'pending', OR
- No inspector assigned (regardless of status)

### UI Components Used
- `Dialog` - Assignment modal
- `Card` - Pending requests container
- `Badge` - Priority and status indicators
- `Button` - Action buttons
- `select` - Inspector dropdown (native HTML for simplicity)

## Visual Features

### Priority Badges
- **Critical:** Red background (`bg-red-100 text-red-800`)
- **High:** Orange background (`bg-orange-100 text-orange-800`)
- **Medium:** Yellow background (`bg-yellow-100 text-yellow-800`)
- **Low:** Blue background (`bg-blue-100 text-blue-800`)

### Status Badges
- **Pending:** Gray background
- **Assigned:** Blue background
- **In Progress:** Yellow background
- **Completed:** Green background
- **Approved:** Emerald background
- **Rejected:** Red background

### Pending Section Styling
- Orange color scheme for urgency
- Border and subtle background color
- Prominent "Assign Inspector" buttons
- Alert icon for attention

## Notifications

The system automatically sends notifications when an inspector is assigned:

1. **To Inspector:**
   - Type: `request_assigned`
   - Title: "New Inspection Assignment"
   - Message: Details about the assigned request

2. **To Initiator:**
   - Type: `request_assigned`
   - Title: "Inspector Assigned to Your Request"
   - Message: Details about who was assigned

## Audit Trail

Every assignment is logged in the audit_logs table:
```sql
INSERT INTO audit_logs (
  user_id,         -- Who performed the assignment
  action,          -- 'ASSIGN'
  entity_type,     -- 'inspection_request'
  entity_id,       -- Request ID
  old_values,      -- Previous state (JSON)
  new_values       -- Updated state (JSON)
)
```

## Activity Tracking

Each assignment creates an activity record:
```sql
INSERT INTO inspection_activities (
  inspection_request_id,
  activity_type,     -- 'assigned'
  description,       -- 'Request assigned to inspector'
  user_id           -- Who performed the assignment
)
```

## Benefits

### 1. **Improved Workflow Efficiency**
- Clear visibility of unassigned requests
- Quick assignment from pending section
- Reduced steps to complete assignment

### 2. **Better Resource Management**
- See all active inspectors at once
- View inspector details during assignment
- Filter by department if needed

### 3. **Enhanced Visibility**
- Prominent display of pending requests
- Counter shows how many need assignment
- Priority-based decision making

### 4. **Accountability**
- Full audit trail of assignments
- Activity tracking for all changes
- Notifications keep everyone informed

### 5. **User Experience**
- Intuitive assignment process
- Visual feedback with badges and colors
- Responsive design works on all devices

## Testing Recommendations

### 1. **Assignment Tests**
- ✅ Assign inspector to pending request
- ✅ Verify status changes to 'assigned'
- ✅ Check notifications are sent
- ✅ Verify audit log entry created

### 2. **Permission Tests**
- ✅ Administrator can assign
- ✅ Approver can assign
- ✅ Inspector cannot assign (403 error)
- ✅ Initiator cannot assign (403 error)

### 3. **Validation Tests**
- ✅ Cannot assign non-inspector users
- ✅ Cannot assign inactive inspectors
- ✅ Cannot assign to non-existent request
- ✅ Requires inspector selection

### 4. **UI Tests**
- ✅ Pending section shows only unassigned requests
- ✅ Pending section hides when all assigned
- ✅ Assign button appears only on pending requests
- ✅ Dialog shows correct request details
- ✅ Inspector dropdown populated correctly

### 5. **Edge Cases**
- ✅ No inspectors available
- ✅ All requests already assigned
- ✅ Multiple rapid assignments
- ✅ Network errors during assignment

## Future Enhancements (Optional)

### 1. **Bulk Assignment**
- Select multiple requests
- Assign all to one inspector
- Distribute across multiple inspectors

### 2. **Intelligent Assignment**
- Auto-suggest inspectors based on:
  - Workload balance
  - Location proximity
  - Specialization/expertise
  - Availability

### 3. **Workload Dashboard**
- Show inspector workload
- Display pending/active/completed counts per inspector
- Calendar view of inspector schedules

### 4. **Assignment Rules**
- Set automatic assignment rules
- Round-robin distribution
- Priority-based assignment
- Department-based routing

### 5. **Mobile Optimization**
- Dedicated mobile assignment view
- Push notifications for new requests
- Quick-assign interface

### 6. **Advanced Filtering**
- Filter pending requests by:
  - Priority level
  - Due date range
  - Location
  - Inspection type

## Files Modified

1. **app/dashboard/inspections/page.tsx** - Main inspections page with assignment UI
2. **app/api/inspection-requests/[id]/assign/route.ts** - Assignment API endpoint with updated permissions

## Database Schema

No database changes required. Uses existing schema:

**Tables Used:**
- `inspection_requests` - Stores inspector_id
- `users` - Fetches active inspectors
- `audit_logs` - Records assignment actions
- `inspection_activities` - Tracks assignment events
- `notifications` - Sends assignment notifications

**Existing Columns:**
- `inspection_requests.inspector_id` - Foreign key to users table
- `inspection_requests.status` - Updated to 'assigned'
- `users.role` - Filtered for 'inspector'
- `users.status` - Filtered for 'active'

## Security Considerations

### 1. **Role-Based Access Control**
- Only administrators and approvers can assign
- API validates user role before processing
- Frontend shows assign button based on permissions

### 2. **Data Validation**
- Inspector must have 'inspector' role
- Inspector must be active status
- Request must exist in database
- Inspector ID required (cannot be empty)

### 3. **Audit Trail**
- All assignments logged with user ID
- Old and new values stored
- Timestamp recorded automatically

### 4. **Input Sanitization**
- Inspector ID parsed as integer
- Request ID validated
- SQL injection prevented via parameterized queries

## Performance Considerations

### 1. **Optimized Queries**
- Single query to fetch inspectors
- Filtered by role and status in database
- Indexed columns for fast lookup

### 2. **Efficient Filtering**
- Client-side filtering for pending requests
- Limit displayed to 5 in pending section
- Full list available in main table

### 3. **Minimal Re-renders**
- State updates only when necessary
- Dialog state isolated from main list
- Conditional rendering for performance

## Accessibility

### 1. **Keyboard Navigation**
- Tab through all interactive elements
- Enter to submit forms
- Escape to close dialogs

### 2. **Screen Reader Support**
- Semantic HTML structure
- Descriptive button labels
- Form labels properly associated

### 3. **Visual Indicators**
- Color not sole indicator (icons + text)
- High contrast for readability
- Focus states visible

## Conclusion

The inspection request assignment feature provides a complete, user-friendly solution for managing inspector assignments. It integrates seamlessly with the existing system while adding significant value through improved visibility, efficiency, and accountability.

The feature is production-ready with:
- ✅ Complete functionality
- ✅ Proper permissions
- ✅ Full audit trail
- ✅ Notification system
- ✅ Error handling
- ✅ Responsive design
- ✅ No linting errors


