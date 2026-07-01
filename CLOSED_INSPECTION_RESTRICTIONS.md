# Closed Inspection Restrictions

## Overview
This document describes restrictions applied to closed inspections to prevent modifications after an inspection has been officially closed.

## Business Rule
**Once an inspection is marked as "closed", no further modifications should be allowed.**

## Implementation

### File Upload Restriction

#### Location
- **File**: `app/dashboard/quality-checks/[id]/page.tsx`
- **Section**: Attachments tab (lines 1104-1117)

#### Change
The "Upload File" button in the Attachments section is now **hidden** when the inspection status is `"closed"`.

**Before:**
```tsx
<div>
  <Input type="file" id="file-upload" className="hidden" onChange={handleFileUpload} />
  <Button size="sm" onClick={() => document.getElementById('file-upload')?.click()}>
    <Upload className="mr-2 h-4 w-4" />
    Upload File
  </Button>
</div>
```

**After:**
```tsx
{inspection.status !== 'closed' && (
  <div>
    <Input type="file" id="file-upload" className="hidden" onChange={handleFileUpload} />
    <Button size="sm" onClick={() => document.getElementById('file-upload')?.click()}>
      <Upload className="mr-2 h-4 w-4" />
      Upload File
    </Button>
  </div>
)}
```

### Existing Restrictions (Already Implemented)

#### 1. Add Checklist Button
- **Condition**: Only visible when `status === 'in_progress'`
- **Reason**: Checklists can only be added during active inspection
- **Location**: Line 890

#### 2. Create Quality Check Button
- **Condition**: Only visible when `status === 'in_progress' || status === 'completed'`
- **Reason**: Quality checks can be added during inspection or after completion for review
- **Location**: Line 975

#### 3. Status Action Buttons
- **"Mark Complete"**: Only shown for `in_progress` status
- **"Approve/Reject"**: Only shown for `completed` status
- **"Close Inspection"**: Only shown for `approved` status
- **Location**: Lines 601-656

## Status Workflow

```
pending → assigned → in_progress → completed → approved → closed
                          ↓            ↓          ↓
                     (can add)    (can add QC)  (can close)
                     checklists
                     files
                     QC
```

### What Can Be Done at Each Status

| Status | Add Checklist | Add Quality Check | Upload Files | Edit/Delete |
|--------|--------------|-------------------|--------------|-------------|
| pending | ❌ | ❌ | ❌ | ❌ |
| assigned | ❌ | ❌ | ❌ | ❌ |
| in_progress | ✅ | ✅ | ✅ | ✅ |
| completed | ❌ | ✅ | ✅ | ❌ |
| approved | ❌ | ❌ | ✅ | ❌ |
| rejected | ❌ | ❌ | ✅ | ❌ |
| **closed** | **❌** | **❌** | **❌** | **❌** |

## User Experience

### Active Inspection (Not Closed)
```
┌──────────────────────────────────────────────┐
│ Attachments                    [Upload File] │
│ Photos, documents, and evidence files        │
└──────────────────────────────────────────────┘
```

### Closed Inspection
```
┌──────────────────────────────────────────────┐
│ Attachments                                  │
│ Photos, documents, and evidence files        │
└──────────────────────────────────────────────┘
```
(Upload button is hidden)

## Benefits

1. **Data Integrity**: Prevents accidental modifications to completed inspections
2. **Audit Compliance**: Ensures closed inspections remain unchanged for record-keeping
3. **Process Control**: Enforces proper workflow and prevents bypassing approval process
4. **Historical Accuracy**: Maintains accurate historical records

## Testing

### Test Scenario 1: Non-Closed Inspection
1. Open an inspection with status: `in_progress`, `completed`, or `approved`
2. Navigate to Attachments tab
3. ✅ Verify "Upload File" button is visible
4. ✅ Verify you can upload files

### Test Scenario 2: Closed Inspection
1. Open an inspection with status: `closed`
2. Navigate to Attachments tab
3. ✅ Verify "Upload File" button is NOT visible
4. ✅ Verify existing attachments are still viewable and downloadable
5. Navigate to Checklists tab
6. ✅ Verify "Add Checklist" button is NOT visible
7. Navigate to Quality Checks tab
8. ✅ Verify "Create Quality Check" button is NOT visible

## Future Considerations

Additional restrictions that could be added for closed inspections:
- Disable download functionality (read-only access)
- Hide edit/delete actions in dropdowns
- Add a visual "CLOSED" watermark or banner
- Prevent API-level modifications with backend validation

## Related Files
- `app/dashboard/quality-checks/[id]/page.tsx` - Main inspection detail page
- `app/api/inspection-requests/[id]/close/route.ts` - Close inspection endpoint
- `INSPECTION_WORKFLOW.md` - Overall workflow documentation

