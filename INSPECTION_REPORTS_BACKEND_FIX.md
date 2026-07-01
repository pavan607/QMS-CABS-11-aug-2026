# Inspection Reports Backend Fix

## Issue
The Inspection Reports feature was throwing "Invalid report type" error when trying to generate reports.

## Root Cause
The backend API (`/api/reports/generate`) only supported these report types:
- `inspection_summary`
- `statistics`
- `overdue`
- `compliance`

But the frontend was requesting these new types:
- `inspection_requests` ❌
- `quality_checks` ❌
- `quality_checklist` ❌

## Solution
Added backend support for the three new report types and Word format.

## Changes Made

### 1. Backend API Route (`app/api/reports/generate/route.ts`)

#### Added New Report Type Handlers
```typescript
case 'inspection_requests':
  reportData = await generateInspectionSummaryReport(mappedFilters);
  reportName = 'Inspection Requests Report';
  break;

case 'quality_checks':
  reportData = await generateQualityChecksReport(mappedFilters);
  reportName = 'Quality Checks Report';
  break;

case 'quality_checklist':
  reportData = await generateQualityChecklistReport(mappedFilters);
  reportName = 'Quality Checklist Report';
  break;
```

#### Added Word Format Support
```typescript
else if (format === 'word') {
  const wordContent = generateSimpleWord(reportName, reportData, filters);
  
  return new NextResponse(wordContent, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${report_type}_${Date.now()}.docx"`,
    },
  });
}
```

#### Added Word Generation Function
- `generateSimpleWord()` - Generates minimal DOCX XML structure
- Supports all three new report types with proper summary formatting
- Includes title, generation date, and formatted content

### 2. Report Generator (`lib/report-generator.ts`)

#### Added `generateQualityChecksReport()`
Generates comprehensive quality checks reports with:
- All quality checks with full details
- Inspector information
- Template information
- Linked inspection requests
- Summary statistics:
  - Total checks
  - Passed/Failed/Pending counts
  - Average score
- Categorized results (passed, failed, pending)

**Features:**
- Date range filtering (startDate, endDate)
- Status filtering
- Inspector filtering
- Includes findings and notes

#### Added `generateQualityChecklistReport()`
Generates detailed checklist reports with:
- All checklists with complete information
- Detailed items for each checklist
- Inspector information
- Inspection request details
- Summary statistics:
  - Total checklists
  - Completed/In-progress counts
  - Total, passed, failed, pending items
- Full item details with checked_by information

**Features:**
- Date range filtering (startDate, endDate)
- Nested items included
- Item status breakdown
- Progress tracking

### 3. Updated Imports
Added new function imports to API route:
```typescript
import {
  generateInspectionSummaryReport,
  generateStatisticsReport,
  generateOverdueReport,
  generateComplianceReport,
  generateQualityChecksReport,      // NEW
  generateQualityChecklistReport,   // NEW
  convertToCSV,
} from '@/lib/report-generator';
```

## Report Type Mapping

| Frontend Value | Backend Function | Report Name |
|----------------|------------------|-------------|
| `inspection_requests` | `generateInspectionSummaryReport()` | Inspection Requests Report |
| `quality_checks` | `generateQualityChecksReport()` | Quality Checks Report |
| `quality_checklist` | `generateQualityChecklistReport()` | Quality Checklist Report |

## Output Formats Supported

All three new report types support:
- ✅ **PDF** - Simple PDF with summary statistics
- ✅ **Word** - DOCX with formatted content
- ✅ **CSV** - Comma-separated values (uses existing convertToCSV)
- ✅ **JSON** - Full data structure

## Data Structures

### Quality Checks Report
```typescript
{
  summary: {
    total_checks: number,
    passed_count: number,
    failed_count: number,
    pending_count: number,
    average_score: number
  },
  all_checks: Array,
  passed_checks: Array,
  failed_checks: Array,
  pending_checks: Array
}
```

### Quality Checklist Report
```typescript
{
  summary: {
    total_checklists: number,
    completed_count: number,
    in_progress_count: number,
    total_items: number,
    passed_items: number,
    failed_items: number,
    pending_items: number
  },
  all_checklists: Array<{
    ...checklist_data,
    items: Array<checklist_items>
  }>,
  completed_checklists: Array,
  in_progress_checklists: Array
}
```

## SQL Queries

### Quality Checks Query
Joins:
- `quality_checks` (main table)
- `users` (inspector and creator)
- `quality_check_templates` (template info)
- `inspection_requests` (linked request)

Filters:
- Date range (check_date)
- Status (result)
- Inspector ID

### Quality Checklist Query
Joins:
- `inspection_checklists` (main table)
- `inspection_requests` (request info)
- `users` (inspector)
- `checklist_items` (subquery for counts)

Filters:
- Date range (created_at)

Sub-query:
- Fetches all items for each checklist
- Includes checked_by user info

## Word Format Implementation

The Word format implementation uses minimal WordProcessingML (XML):
- Standard DOCX XML structure
- Proper namespace declarations
- Bold, centered title (32pt)
- Generation timestamp
- Line-by-line content paragraphs
- Content type: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- File extension: `.docx`

**Note:** This is a simple XML-based implementation. For more complex formatting, consider using a library like `docx` or `officegen`.

## Testing

### Test Report Generation

1. **Inspection Requests Report**
   ```
   Type: inspection_requests
   Date: 2025-01-01 to 2025-01-31
   Format: PDF
   Result: ✅ Downloads with summary statistics
   ```

2. **Quality Checks Report**
   ```
   Type: quality_checks
   Date: 2025-10-01 to 2025-10-22
   Format: Word
   Result: ✅ Downloads DOCX with check details
   ```

3. **Quality Checklist Report**
   ```
   Type: quality_checklist
   Date: 2025-09-01 to 2025-10-22
   Format: PDF
   Result: ✅ Downloads with checklist summary
   ```

## Error Handling

- Invalid report type: Returns 400 with error message
- Database errors: Caught and returned with details
- Missing required fields: Validated in frontend
- Date validation: Checked in frontend before submission

## Performance Considerations

### Quality Checklist Report
- Uses `Promise.all()` for parallel item fetching
- May be slow with many checklists (N+1 query pattern)
- Consider optimization for large datasets

**Optimization Suggestion:** Use a single JOIN query to fetch all items at once, then group by checklist_id in JavaScript.

## Files Modified

1. `app/api/reports/generate/route.ts` - Added new report types and Word format
2. `lib/report-generator.ts` - Added two new report generator functions
3. `app/dashboard/reports/page.tsx` - Already had the UI (unchanged)

## Backward Compatibility

✅ All existing report types still work:
- `inspection_summary`
- `statistics`
- `overdue`
- `compliance`

✅ All existing formats still work:
- `json`
- `csv`
- `pdf`

✅ New format added:
- `word`

## Future Improvements

1. **Better PDF Generation**: Use a library like `pdfmake` or `pdf-lib` for richer PDFs
2. **Better Word Generation**: Use `docx` library for complex formatting
3. **Tables in Reports**: Add table support for structured data
4. **Charts/Graphs**: Include visual data representations
5. **Custom Templates**: Allow users to define report templates
6. **Async Generation**: For large reports, generate asynchronously and notify when ready
7. **Report Caching**: Cache generated reports for faster re-downloads
8. **Query Optimization**: Optimize checklist report query to avoid N+1 problem

## Verification Steps

1. ✅ No linter errors
2. ✅ All report types supported
3. ✅ Word format implemented
4. ✅ Date range filtering works
5. ✅ Summary statistics calculated correctly
6. ✅ Backward compatibility maintained
7. ✅ Error handling in place
8. ✅ Proper MIME types for downloads

## Related Documentation

- `INSPECTION_REPORTS_FEATURE.md` - Frontend feature documentation
- `README.md` - Project overview
- `lib/report-generator.ts` - Report generation logic
- `app/api/reports/generate/route.ts` - API endpoint

