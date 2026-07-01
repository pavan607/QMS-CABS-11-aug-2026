'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatCalendarDateDisplay } from '@/lib/inspection-display';
import {
  resolveInspectorNames,
  resolveStartCompleteInspectorName,
  shouldHighlightInspectorName,
} from '@/lib/report-inspector-display';

interface IR {
  id: number;
  request_number: string;
  title: string;
  item?: string;
  description?: string;
  location?: string;
  inspection_type?: string;
  status: string;
  due_date?: string;
  request_date?: string;
  completed_date?: string;
  created_at: string;
  initiator_name?: string;
  inspector_name?: string;
  inspector_names?: string;
  inspection_started_by_name?: string;
  inspection_completed_by_name?: string;
  part4_completed_by_name?: string;
  approver_name?: string;
  project_name?: string;
  project_code?: string;
  checklist_count?: number;
  duration_days?: number;
}

interface ReportData {
  summary: {
    total_requests: number;
    completed_count: number;
    pending_count: number;
    rejected_count: number;
    avg_completion_days: number;
  };
  all_requests: IR[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending',
  pending_request_approval: 'Pending Forward',
  request_approved: 'Forwarded',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  inspection_completed: 'Inspection Done',
  completed: 'Completed',
  approved: 'Approved',
  rejected: 'Rejected',
  closed: 'Closed',
};

function fmtDate(val: any): string {
  return formatCalendarDateDisplay(val);
}

function fmtDateTime(val: any): string {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return String(val); }
}

function fmtStatus(s: string): string {
  return STATUS_LABELS[s] || s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function PrintReportContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportTitle, setReportTitle] = useState('Inspection Requests Report');
  const [filterDesc, setFilterDesc] = useState('');

  useEffect(() => {
    const reportType = searchParams.get('type') || 'inspection_requests';
    const status = searchParams.get('status') || '';
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const initiatorId = searchParams.get('initiator_id') || '';
    const projectId = searchParams.get('project_id') || '';

    if (reportType === 'inspection_summary') setReportTitle('Inspection Summary Report');

    const parts: string[] = [];
    if (status) parts.push(`Status: ${status.split(',').map(s => fmtStatus(s.trim())).join(', ')}`);
    if (startDate) parts.push(`From: ${fmtDate(startDate)}`);
    if (endDate) parts.push(`To: ${fmtDate(endDate)}`);
    setFilterDesc(parts.join(' | '));

    const filters: any = {};
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;
    if (status) filters.status = status;
    if (initiatorId) filters.initiator_id = parseInt(initiatorId);
    if (projectId) filters.project_id = parseInt(projectId);

    fetch('/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_type: reportType, format: 'json', filters }),
    })
      .then(res => res.json())
      .then(json => {
        setData(json.report?.data || null);
        if (json.report?.name) setReportTitle(json.report.name);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    if (data && !loading) {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
  }, [data, loading]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif', fontSize: 14 }}>Loading report...</div>;
  if (!data) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif', fontSize: 14 }}>No report data found.</div>;

  const now = fmtDateTime(new Date().toISOString());
  const ROWS_PER_PAGE = 25;
  const allRows = data.all_requests || [];
  const pages: IR[][] = [];
  for (let i = 0; i < allRows.length; i += ROWS_PER_PAGE) {
    pages.push(allRows.slice(i, i + ROWS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  const PageHeader = () => (
    <div className="page-header">
      <div className="ph-row">
        <div className="ph-logo"><img src="/logo.png" alt="CABS Logo" style={{ width: 56, height: 56, objectFit: 'contain' }} /></div>
        <div className="ph-center">
          <div className="ph-title"><b>{reportTitle}</b></div>
          <div className="ph-sub">Quality Management System — CABS</div>
        </div>
        <div className="ph-right">
          <div><b>Form No.</b>: CABS/R&amp;QA/FF/INSP/001</div>
          <div><b>Rev. No &amp; Date</b>: 04 dt: 25/11/2025</div>
        </div>
      </div>
    </div>
  );

  return (
    <div id="print-root">
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        #print-root { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; background: #fff; }

        @media print {
          html, body, #print-root { margin: 0; padding: 0; }
          @page { size: A4 landscape; margin: 8mm 10mm; }
          .no-print { display: none !important; }
          .print-page { padding: 0; max-width: none; box-shadow: none; page-break-after: always; display: flex; flex-direction: column; min-height: calc(210mm - 16mm); }
          .print-page:last-child { page-break-after: auto; }
          .page-content { flex: 1; }
        }
        @media screen {
          body { background: #e0e0e0; }
          .print-page { max-width: 297mm; margin: 20px auto; padding: 10mm 12mm; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.15); min-height: 210mm; display: flex; flex-direction: column; }
          .page-content { flex: 1; }
        }

        .no-print { background: #1e3a5f; padding: 12px 0; text-align: center; position: sticky; top: 0; z-index: 10; }
        .no-print button { padding: 10px 32px; font-size: 14px; font-weight: 600; background: #fff; color: #1e3a5f; border: none; border-radius: 6px; cursor: pointer; margin: 0 6px; }
        .no-print button:hover { background: #e8eef5; }

        .page-header { border: 1.5px solid #000; margin-bottom: 0; }
        .ph-row { display: flex; align-items: stretch; }
        .ph-logo { width: 74px; display: flex; align-items: center; justify-content: center; border-right: 1px solid #000; padding: 4px; }
        .ph-center { flex: 1; padding: 6px 10px; display: flex; flex-direction: column; justify-content: center; align-items: center; border-right: 1px solid #000; }
        .ph-title { font-size: 13px; }
        .ph-sub { font-size: 9px; color: #444; margin-top: 2px; }
        .ph-right { width: 200px; padding: 6px 10px; display: flex; flex-direction: column; justify-content: center; font-size: 9px; line-height: 1.6; }
        .ph-right b { margin-right: 3px; }

        .filter-bar { border: 1px solid #000; border-top: none; padding: 4px 10px; font-size: 9px; color: #333; display: flex; justify-content: space-between; background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

        .summary-row { display: flex; border: 1px solid #000; border-top: none; }
        .summary-cell { flex: 1; text-align: center; padding: 6px 4px; border-right: 1px solid #000; }
        .summary-cell:last-child { border-right: none; }
        .summary-val { font-size: 16px; font-weight: bold; color: #1e3a5f; }
        .summary-lbl { font-size: 8px; color: #666; text-transform: uppercase; margin-top: 2px; }

        table.report-table { width: 100%; border-collapse: collapse; margin-top: 0; }
        table.report-table th, table.report-table td { border: 1px solid #000; padding: 3px 5px; font-size: 9px; line-height: 1.35; vertical-align: top; }
        table.report-table thead th { background: #1e3a5f; color: #fff; font-weight: bold; text-align: center; font-size: 8.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        table.report-table tbody td { font-size: 9px; }
        table.report-table tbody tr:nth-child(even) { background: #f7f9fb; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .td-center { text-align: center; }
        .td-right { text-align: right; }
        .td-nowrap { white-space: nowrap; }
        .td-mono { font-family: 'Courier New', monospace; font-size: 8.5px; font-weight: bold; }
        .td-item { font-size: 8px; color: #555; }

        .status-badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 7.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; }
        .st-pending { background: #fff3cd; color: #856404; }
        .st-forwarded { background: #d1ecf1; color: #0c5460; }
        .st-assigned { background: #cce5ff; color: #004085; }
        .st-progress { background: #fff3cd; color: #856404; }
        .st-completed { background: #d4edda; color: #155724; }
        .st-closed { background: #e2e3e5; color: #383d41; }
        .st-rejected { background: #f8d7da; color: #721c24; }

        .page-footer { margin-top: auto; padding-top: 6px; }
        .footer { text-align: center; font-size: 8px; color: #999; border-top: 1px solid #ccc; padding-top: 4px; display: flex; justify-content: space-between; }
        .page-num { font-size: 9px; font-weight: bold; }
      `}</style>

      <div className="no-print">
        <button onClick={() => window.print()}>Print / Save as PDF</button>
        <button onClick={() => window.close()}>Close</button>
      </div>

      {pages.map((pageRows, pageIdx) => {
        const startNum = pageIdx * ROWS_PER_PAGE;
        return (
          <div className="print-page" key={pageIdx}>
            <PageHeader />

            {pageIdx === 0 && (
              <>
                <div className="filter-bar">
                  <span>{filterDesc || 'All Records'}</span>
                  <span>Generated: {now}</span>
                </div>
                <div className="summary-row">
                  <div className="summary-cell">
                    <div className="summary-val">{data.summary.total_requests}</div>
                    <div className="summary-lbl">Total Requests</div>
                  </div>
                  <div className="summary-cell">
                    <div className="summary-val">{data.summary.completed_count}</div>
                    <div className="summary-lbl">Completed</div>
                  </div>
                  <div className="summary-cell">
                    <div className="summary-val">{data.summary.pending_count}</div>
                    <div className="summary-lbl">Pending</div>
                  </div>
                  <div className="summary-cell">
                    <div className="summary-val">{data.summary.rejected_count}</div>
                    <div className="summary-lbl">Rejected</div>
                  </div>
                  <div className="summary-cell">
                    <div className="summary-val">{data.summary.avg_completion_days?.toFixed(1) || '—'}</div>
                    <div className="summary-lbl">Avg Days</div>
                  </div>
                </div>
              </>
            )}

            <div className="page-content">
              <table className="report-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}>Sl</th>
                    <th style={{ width: 85 }}>IR No.</th>
                    <th>Title / Item</th>
                    <th style={{ width: 80 }}>Project</th>
                    <th style={{ width: 70 }}>Status</th>
                    <th style={{ width: 80 }}>Initiator</th>
                    <th style={{ width: 80 }}>Inspector</th>
                    <th style={{ width: 65 }}>Request Date</th>
                    <th style={{ width: 65 }}>Due Date</th>
                    <th style={{ width: 65 }}>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr><td colSpan={10} className="td-center" style={{ padding: 20, color: '#888' }}>No records found matching the selected filters.</td></tr>
                  ) : (
                    pageRows.map((r, idx) => {
                      const stClass =
                        ['closed', 'completed', 'approved', 'inspection_completed'].includes(r.status) ? 'st-completed' :
                        r.status === 'rejected' ? 'st-rejected' :
                        r.status === 'assigned' ? 'st-assigned' :
                        ['in_progress'].includes(r.status) ? 'st-progress' :
                        r.status === 'request_approved' ? 'st-forwarded' :
                        'st-pending';
                      return (
                        <tr key={r.id}>
                          <td className="td-center">{startNum + idx + 1}</td>
                          <td className="td-mono td-nowrap">{r.request_number || '—'}</td>
                          <td>
                            {r.title || '—'}
                            {r.item && <div className="td-item">{r.item}</div>}
                          </td>
                          <td>{r.project_name || '—'}</td>
                          <td className="td-center"><span className={`status-badge ${stClass}`}>{fmtStatus(r.status)}</span></td>
                          <td>{r.initiator_name || '—'}</td>
                          <td>
                            {(() => {
                              const names = resolveInspectorNames(r);
                              if (names.length === 0) return '—';
                              const startCompleteInspector = resolveStartCompleteInspectorName(r);
                              return names.map((name, index) => {
                                const highlighted = shouldHighlightInspectorName(name, r, startCompleteInspector);
                                return (
                                  <span key={`${name}-${index}`}>
                                    {index > 0 && ', '}
                                    {highlighted ? (
                                      <span style={{ color: '#155724', fontWeight: 700, background: '#d4edda', padding: '1px 4px', borderRadius: 3 }}>
                                        {name}
                                      </span>
                                    ) : (
                                      name
                                    )}
                                  </span>
                                );
                              });
                            })()}
                          </td>
                          <td className="td-center td-nowrap">{fmtDate(r.request_date || r.created_at)}</td>
                          <td className="td-center td-nowrap">{fmtDate(r.due_date)}</td>
                          <td className="td-center td-nowrap">{fmtDate(r.completed_date)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="page-footer">
              <div className="footer">
                <span>Quality Management System — CABS</span>
                <span>Generated: {now}</span>
                <span className="page-num">Page {pageIdx + 1} of {pages.length}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PrintReportPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif', fontSize: 14 }}>Loading...</div>}>
      <PrintReportContent />
    </Suspense>
  );
}
