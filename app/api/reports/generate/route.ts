import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';
import {
  generateInspectionSummaryReport,
  generateStatisticsReport,
  generateOverdueReport,
  generateComplianceReport,
  generateQualityChecksReport,
  generateQualityChecklistReport,
  convertToCSV,
} from '@/lib/report-generator';
import * as XLSX from 'xlsx';

// POST generate report
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;

    // Check permissions
    if (!hasPermission(userRole, 'report', 'create')) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { report_type, format, filters } = body;

    if (!report_type) {
      return NextResponse.json({ error: 'Report type is required' }, { status: 400 });
    }

    // Map snake_case to camelCase for filters
    const mappedFilters = filters ? {
      startDate: filters.start_date,
      endDate: filters.end_date,
      status: filters.status,
      inspectorId: filters.inspector_id,
      initiatorId: filters.initiator_id,
      projectId: filters.project_id,
    } : {};

    let reportData: any;
    let reportName: string;

    try {
      switch (report_type) {
        case 'inspection_summary':
          reportData = await generateInspectionSummaryReport(mappedFilters);
          reportName = 'Inspection Summary Report';
          break;

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

        case 'statistics':
          reportData = await generateStatisticsReport(mappedFilters);
          reportName = 'Statistical Analysis Report';
          break;

        case 'overdue':
          reportData = await generateOverdueReport();
          reportName = 'Overdue Inspections Report';
          break;

        case 'compliance':
          reportData = await generateComplianceReport(mappedFilters);
          reportName = 'Compliance Report';
          break;

        default:
          return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
      }
    } catch (dbError: any) {
      console.error('Database error generating report:', dbError);
      return NextResponse.json({ 
        error: `Failed to generate report: ${dbError.message || 'Database error'}` 
      }, { status: 500 });
    }

    // Format the response based on requested format
    if (format === 'csv') {
      let csv = '';
      
      // Handle inspection summary with structured data
      if (report_type === 'inspection_summary' && reportData.all_requests) {
        // Add summary section
        csv += 'SUMMARY\n';
        csv += `Total Requests,${reportData.summary.total_requests}\n`;
        csv += `Completed,${reportData.summary.completed_count}\n`;
        csv += `Pending,${reportData.summary.pending_count}\n`;
        csv += `Rejected,${reportData.summary.rejected_count}\n`;
        csv += `Avg Completion Days,${reportData.summary.avg_completion_days.toFixed(2)}\n`;
        csv += '\n';
        
        // Add all requests
        csv += 'ALL INSPECTION REQUESTS\n';
        csv += convertToCSV(reportData.all_requests) + '\n\n';
        
        // Add completed section
        csv += 'COMPLETED INSPECTIONS\n';
        csv += reportData.completed_inspections.length > 0 
          ? convertToCSV(reportData.completed_inspections) + '\n\n'
          : 'No completed inspections\n\n';
        
        // Add pending section
        csv += 'PENDING INSPECTIONS\n';
        csv += reportData.pending_inspections.length > 0
          ? convertToCSV(reportData.pending_inspections) + '\n\n'
          : 'No pending inspections\n\n';
        
        // Add rejected section if any
        if (reportData.rejected_inspections.length > 0) {
          csv += 'REJECTED INSPECTIONS\n';
          csv += convertToCSV(reportData.rejected_inspections) + '\n';
        }
      } else {
        // Default CSV handling for other reports
        csv = Array.isArray(reportData) 
          ? convertToCSV(reportData)
          : convertToCSV([reportData]);
      }
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${report_type}_${Date.now()}.csv"`,
        },
      });
    } else if (format === 'pdf') {
      // Generate simple PDF content (text-based for now)
      const pdfContent = generateSimplePDF(reportName, reportData, filters);
      
      return new NextResponse(pdfContent, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${report_type}_${Date.now()}.pdf"`,
        },
      });
    } else if (format === 'excel') {
      const buf = generateExcelFile(reportName, reportData);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${report_type}_${Date.now()}.xlsx"`,
        },
      });
    } else if (format === 'word') {
      const wordHtml = generateWordHtml(reportName, reportData, filters);
      return new NextResponse(wordHtml, {
        headers: {
          'Content-Type': 'application/msword',
          'Content-Disposition': `attachment; filename="${report_type}_${Date.now()}.doc"`,
        },
      });
    } else if (format === 'json') {
      return NextResponse.json({
        report: {
          name: reportName,
          type: report_type,
          generated_at: new Date().toISOString(),
          filters,
          data: reportData,
        },
      });
    } else {
      // Default to JSON
      return NextResponse.json({
        report: {
          name: reportName,
          type: report_type,
          generated_at: new Date().toISOString(),
          filters,
          data: reportData,
        },
      });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

// Simple PDF generation function (text-based)
function generateSimplePDF(title: string, data: any, filters: any): string {
  let contentLines: string[] = [];
  
  // Add title and date
  contentLines.push(title);
  contentLines.push(`Generated: ${new Date().toLocaleString()}`);
  contentLines.push('');
  
  // Format data for PDF display
  if (data.summary && data.all_requests) {
    // Inspection summary format
    contentLines.push('=== SUMMARY ===');
    contentLines.push(`Total Requests: ${data.summary.total_requests}`);
    contentLines.push(`Completed: ${data.summary.completed_count}`);
    contentLines.push(`Pending: ${data.summary.pending_count}`);
    contentLines.push(`Rejected: ${data.summary.rejected_count}`);
    contentLines.push(`Avg Completion Days: ${data.summary.avg_completion_days.toFixed(2)}`);
    contentLines.push('');
    
    // Add detailed inspection requests
    if (data.all_requests && data.all_requests.length > 0) {
      contentLines.push('=== DETAILED INSPECTION REQUESTS ===');
      data.all_requests.forEach((req: any, idx: number) => {
        contentLines.push('');
        contentLines.push(`${idx + 1}. Request #${req.request_number}`);
        contentLines.push(`   Title: ${req.title}`);
        contentLines.push(`   Status: ${req.status}`);
        contentLines.push(`   Type: ${req.inspection_type}`);
        if (req.location) contentLines.push(`   Location: ${req.location}`);
        if (req.item) contentLines.push(`   Item: ${req.item}`);
        if (req.description) contentLines.push(`   Description: ${req.description}`);
        contentLines.push(`   Initiator: ${req.initiator_name || 'N/A'}`);
        contentLines.push(`   Inspector: ${req.inspector_name || 'Not Assigned'}`);
        if (req.request_date) contentLines.push(`   Request Date: ${new Date(req.request_date).toLocaleDateString()}`);
        if (req.due_date) contentLines.push(`   Due Date: ${new Date(req.due_date).toLocaleDateString()}`);
        if (req.completed_date) contentLines.push(`   Completed: ${new Date(req.completed_date).toLocaleDateString()}`);
      });
    }
  } else if (data.summary && data.all_checks) {
    // Quality checks format
    contentLines.push('=== SUMMARY ===');
    contentLines.push(`Total Checks: ${data.summary.total_checks}`);
    contentLines.push(`Passed: ${data.summary.passed_count}`);
    contentLines.push(`Failed: ${data.summary.failed_count}`);
    contentLines.push(`Pending: ${data.summary.pending_count}`);
    contentLines.push(`Average Score: ${data.summary.average_score.toFixed(2)}%`);
    contentLines.push('');
    
    // Add detailed quality checks
    if (data.all_checks && data.all_checks.length > 0) {
      contentLines.push('=== DETAILED QUALITY CHECKS ===');
      data.all_checks.forEach((check: any, idx: number) => {
        contentLines.push('');
        contentLines.push(`${idx + 1}. ${check.name}`);
        contentLines.push(`   Result: ${check.result} | Score: ${check.score || 'N/A'}`);
        contentLines.push(`   Inspector: ${check.inspector_name || 'N/A'}`);
        contentLines.push(`   Check Date: ${new Date(check.check_date).toLocaleDateString()}`);
        if (check.template_name) contentLines.push(`   Template: ${check.template_name}`);
        if (check.inspection_title) contentLines.push(`   Inspection: ${check.request_number} - ${check.inspection_title}`);
        if (check.notes) contentLines.push(`   Notes: ${check.notes}`);
        if (check.findings) {
          const findings = typeof check.findings === 'string' ? check.findings : JSON.stringify(check.findings);
          contentLines.push(`   Findings: ${findings.substring(0, 200)}`);
        }
      });
    }
  } else if (data.summary && data.all_checklists) {
    // Quality checklist format
    contentLines.push('=== SUMMARY ===');
    contentLines.push(`Total Checklists: ${data.summary.total_checklists}`);
    contentLines.push(`Completed: ${data.summary.completed_count}`);
    contentLines.push(`In Progress: ${data.summary.in_progress_count}`);
    contentLines.push(`Total Items: ${data.summary.total_items}`);
    contentLines.push(`Passed Items: ${data.summary.passed_items}`);
    contentLines.push(`Failed Items: ${data.summary.failed_items}`);
    contentLines.push(`Pending Items: ${data.summary.pending_items}`);
    contentLines.push('');
    
    // Add detailed checklists with items
    if (data.all_checklists && data.all_checklists.length > 0) {
      contentLines.push('=== DETAILED CHECKLISTS ===');
      data.all_checklists.forEach((checklist: any, idx: number) => {
        contentLines.push('');
        contentLines.push(`${idx + 1}. ${checklist.checklist_name}`);
        contentLines.push(`   Inspection: ${checklist.request_number} - ${checklist.inspection_title}`);
        contentLines.push(`   Location: ${checklist.location || 'N/A'}`);
        contentLines.push(`   Inspector: ${checklist.inspector_name || 'N/A'}`);
        contentLines.push(`   Status: ${checklist.is_completed ? 'Completed' : 'In Progress'}`);
        contentLines.push(`   Items: ${checklist.total_items} (Pass: ${checklist.passed_items}, Fail: ${checklist.failed_items}, Pending: ${checklist.pending_items})`);
        
        // Add checklist items if available
        if (checklist.items && checklist.items.length > 0) {
          contentLines.push('   Checklist Items:');
          checklist.items.forEach((item: any) => {
            contentLines.push(`     - Item ${item.item_number}: ${item.description}`);
            contentLines.push(`       Status: ${item.status} | Compliant: ${item.is_compliant ? 'Yes' : 'No'}`);
            if (item.findings) contentLines.push(`       Findings: ${item.findings}`);
            if (item.corrective_action) contentLines.push(`       Corrective Action: ${item.corrective_action}`);
            if (item.inspector_notes) contentLines.push(`       Notes: ${item.inspector_notes}`);
            if (item.checked_by_name) contentLines.push(`       Checked By: ${item.checked_by_name} at ${new Date(item.checked_at).toLocaleString()}`);
          });
        }
      });
    }
  } else if (Array.isArray(data)) {
    // Handle array data (overdue, compliance reports)
    contentLines.push(`=== ${data.length} RECORDS ===`);
    data.forEach((item: any, idx: number) => {
      contentLines.push('');
      contentLines.push(`${idx + 1}. ${item.title || item.name || item.request_number || 'Record'}`);
      
      // Add all available fields
      Object.keys(item).forEach(key => {
        if (key !== 'title' && key !== 'name' && item[key] != null) {
          const value = typeof item[key] === 'object' ? JSON.stringify(item[key]) : item[key];
          contentLines.push(`   ${key}: ${value}`);
        }
      });
    });
  } else {
    contentLines.push(`Report Data: ${JSON.stringify(data, null, 2)}`);
  }
  
  // Build PDF with multiple pages if needed
  const pdfLines: string[] = ['%PDF-1.4'];
  const pageHeight = 720; // Points available for content
  const lineHeight = 12; // Points per line
  const linesPerPage = Math.floor(pageHeight / lineHeight);
  
  // Split content into pages
  const pages: string[][] = [];
  for (let i = 0; i < contentLines.length; i += linesPerPage) {
    pages.push(contentLines.slice(i, i + linesPerPage));
  }
  
  // Create PDF structure for first page
  let objNum = 1;
  pdfLines.push(`${objNum} 0 obj`);
  pdfLines.push('<<');
  pdfLines.push('/Type /Catalog');
  pdfLines.push(`/Pages ${++objNum} 0 R`);
  pdfLines.push('>>');
  pdfLines.push('endobj');
  
  const pagesObjNum = objNum;
  pdfLines.push(`${objNum} 0 obj`);
  pdfLines.push('<<');
  pdfLines.push('/Type /Pages');
  const firstPageObjNum = objNum + 1;
  pdfLines.push(`/Kids [${firstPageObjNum} 0 R]`);
  pdfLines.push('/Count 1');
  pdfLines.push('>>');
  pdfLines.push('endobj');
  
  // Create page
  pdfLines.push(`${++objNum} 0 obj`);
  pdfLines.push('<<');
  pdfLines.push('/Type /Page');
  pdfLines.push(`/Parent ${pagesObjNum} 0 R`);
  pdfLines.push('/Resources <<');
  pdfLines.push('/Font <<');
  pdfLines.push(`/F1 ${objNum + 1} 0 R`);
  pdfLines.push('>>');
  pdfLines.push('>>');
  pdfLines.push('/MediaBox [0 0 612 792]');
  pdfLines.push(`/Contents ${objNum + 2} 0 R`);
  pdfLines.push('>>');
  pdfLines.push('endobj');
  
  // Font
  pdfLines.push(`${++objNum} 0 obj`);
  pdfLines.push('<<');
  pdfLines.push('/Type /Font');
  pdfLines.push('/Subtype /Type1');
  pdfLines.push('/BaseFont /Courier');
  pdfLines.push('>>');
  pdfLines.push('endobj');
  
  // Content stream - use first page of content
  const pageContent = pages[0] || contentLines.slice(0, linesPerPage);
  let streamContent = 'BT\n/F1 9 Tf\n50 750 Td\n';
  
  pageContent.forEach(line => {
    // Escape special PDF characters and limit line length
    const sanitized = line.substring(0, 80).replace(/[()\\]/g, '\\$&');
    streamContent += `(${sanitized}) Tj\n0 -${lineHeight} Td\n`;
  });
  
  streamContent += 'ET';
  
  pdfLines.push(`${++objNum} 0 obj`);
  pdfLines.push('<<');
  pdfLines.push(`/Length ${streamContent.length}`);
  pdfLines.push('>>');
  pdfLines.push('stream');
  pdfLines.push(streamContent);
  pdfLines.push('endstream');
  pdfLines.push('endobj');
  
  // Cross-reference table
  pdfLines.push('xref');
  pdfLines.push(`0 ${objNum + 1}`);
  pdfLines.push('0000000000 65535 f');
  for (let i = 1; i <= objNum; i++) {
    pdfLines.push('0000000009 00000 n');
  }
  
  // Trailer
  pdfLines.push('trailer');
  pdfLines.push('<<');
  pdfLines.push(`/Size ${objNum + 1}`);
  pdfLines.push('/Root 1 0 R');
  pdfLines.push('>>');
  pdfLines.push('startxref');
  pdfLines.push('492');
  pdfLines.push('%%EOF');
  
  return pdfLines.join('\n');
}

function generateWordHtml(title: string, data: any, filters: any): string {
  const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmtDate = (v: any) => {
    if (!v) return '—';
    try {
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    } catch { return '—'; }
  };
  const statusLabels: Record<string, string> = {
    draft: 'Draft', pending: 'Pending', pending_request_approval: 'Pending Forward',
    request_approved: 'Forwarded', assigned: 'Assigned', in_progress: 'In Progress',
    inspection_completed: 'Inspection Done', completed: 'Completed',
    approved: 'Approved', rejected: 'Rejected', closed: 'Closed',
  };
  const fmtStatus = (s: string) => statusLabels[s] || (s || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  let body = '';

  if (data.summary && data.all_requests) {
    body += `<h2 style="color:#1e3a5f;">Summary</h2>`;
    body += `<table><tr>
      <td><b>Total Requests</b><br/>${data.summary.total_requests}</td>
      <td><b>Completed</b><br/>${data.summary.completed_count}</td>
      <td><b>Pending</b><br/>${data.summary.pending_count}</td>
      <td><b>Rejected</b><br/>${data.summary.rejected_count}</td>
      <td><b>Avg Days</b><br/>${data.summary.avg_completion_days?.toFixed(1) || '—'}</td>
    </tr></table>`;

    if (data.all_requests.length > 0) {
      body += `<h2 style="color:#1e3a5f;">Inspection Requests</h2>`;
      body += `<table>
        <tr style="background:#1e3a5f;color:#fff;">
          <th>Sl</th><th>IR No.</th><th>Title / Item</th><th>Project</th>
          <th>Status</th><th>Initiator</th>
          <th>Inspector</th><th>Request Date</th><th>Due Date</th><th>Completed</th>
        </tr>`;
      data.all_requests.forEach((r: any, i: number) => {
        const bg = i % 2 === 0 ? '#fff' : '#f5f7fa';
        body += `<tr style="background:${bg};">
          <td>${i + 1}</td>
          <td>${esc(r.request_number)}</td>
          <td>${esc(r.title)}${r.item ? `<br/><span style="font-size:9px;color:#666;">${esc(r.item)}</span>` : ''}</td>
          <td>${r.project_name ? esc(r.project_name) : '—'}</td>
          <td>${esc(fmtStatus(r.status))}</td>
          <td>${esc(r.initiator_name || '—')}</td>
          <td>${esc(r.inspector_name || '—')}</td>
          <td>${fmtDate(r.request_date || r.created_at)}</td>
          <td>${fmtDate(r.due_date)}</td>
          <td>${fmtDate(r.completed_date)}</td>
        </tr>`;
      });
      body += `</table>`;
      body += `<p style="font-size:10px;color:#888;">Total: ${data.all_requests.length} records</p>`;
    }
  } else if (Array.isArray(data)) {
    body += `<p>${data.length} records</p>`;
    body += `<table><tr style="background:#1e3a5f;color:#fff;">`;
    if (data.length > 0) {
      Object.keys(data[0]).forEach(k => { body += `<th>${esc(k)}</th>`; });
      body += `</tr>`;
      data.forEach((row: any, i: number) => {
        const bg = i % 2 === 0 ? '#fff' : '#f5f7fa';
        body += `<tr style="background:${bg};">`;
        Object.values(row).forEach(v => { body += `<td>${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</td>`; });
        body += `</tr>`;
      });
    }
    body += `</table>`;
  } else {
    body += `<pre>${esc(JSON.stringify(data, null, 2))}</pre>`;
  }

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<style>
  @page { size: A4 landscape; margin: 1.5cm; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
  h1 { font-size: 18px; color: #1e3a5f; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 13px; margin-top: 16px; margin-bottom: 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  p.sub { font-size: 10px; color: #666; text-align: center; margin-top: 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #bbb; padding: 4px 6px; font-size: 10px; vertical-align: top; }
  th { font-weight: bold; text-align: left; }
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<p class="sub">Generated: ${new Date().toLocaleString('en-IN')} | Quality Management System — CABS</p>
${body}
</body>
</html>`;
}

function generateExcelFile(title: string, data: any): Buffer {
  const fmtDate = (v: any) => {
    if (!v) return '';
    try {
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    } catch { return ''; }
  };
  const statusLabels: Record<string, string> = {
    draft: 'Draft', pending: 'Pending', pending_request_approval: 'Pending Forward',
    request_approved: 'Forwarded', assigned: 'Assigned', in_progress: 'In Progress',
    inspection_completed: 'Inspection Done', completed: 'Completed',
    approved: 'Approved', rejected: 'Rejected', closed: 'Closed',
  };
  const fmtStatus = (s: string) => statusLabels[s] || (s || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const wb = XLSX.utils.book_new();

  if (data.summary && data.all_requests) {
    const summaryRows = [
      ['Metric', 'Value'],
      ['Total Requests', data.summary.total_requests],
      ['Completed', data.summary.completed_count],
      ['Pending', data.summary.pending_count],
      ['Rejected', data.summary.rejected_count],
      ['Avg Completion Days', parseFloat(data.summary.avg_completion_days?.toFixed(2)) || 0],
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    summaryWs['!cols'] = [{ wch: 22 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    const header = [
      'Sl No.', 'IR No.', 'Title', 'Item', 'Project', 'Status',
      'Initiator', 'Inspector', 'Request Date', 'Due Date',
      'Completed Date', 'Location', 'Inspection Type',
    ];
    const rows = data.all_requests.map((r: any, i: number) => [
      i + 1,
      r.request_number || '',
      r.title || '',
      r.item || '',
      r.project_name || '',
      fmtStatus(r.status),
      r.initiator_name || '',
      r.inspector_name || '',
      fmtDate(r.request_date || r.created_at),
      fmtDate(r.due_date),
      fmtDate(r.completed_date),
      r.location || '',
      r.inspection_type || '',
    ]);
    const dataWs = XLSX.utils.aoa_to_sheet([header, ...rows]);
    dataWs['!cols'] = [
      { wch: 7 }, { wch: 16 }, { wch: 30 }, { wch: 20 }, { wch: 16 },
      { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 16 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, dataWs, 'Inspection Requests');
  } else if (Array.isArray(data) && data.length > 0) {
    const keys = Object.keys(data[0]);
    const rows = data.map((row: any) => keys.map(k => row[k] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([keys, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
  }

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

