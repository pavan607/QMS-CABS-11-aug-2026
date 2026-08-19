'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { formatCalendarDateDisplay, formatDateTimeDisplay, formatInspectionActivityType, formatInspectionActivityDescription } from '@/lib/inspection-display';
import { usePermissions } from '@/lib/hooks/usePermissions';

interface ActivityRow {
  id: number;
  activity_type?: string;
  description?: string;
  user_name?: string;
  created_at?: string;
}

interface IR {
  id?: number;
  request_number?: string;
  title?: string;
  status?: string;
  initiator_id?: number | null;
  initiator_name?: string;
  created_at?: string;
  request_date?: string;
  activities?: ActivityRow[];
  [key: string]: unknown;
}

export default function PrintInspectionActivityLog() {
  const params = useParams();
  const permissions = usePermissions();
  const [ir, setIr] = useState<IR | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/inspection-requests/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setIr(data.request || data.inspectionRequest || data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (ir && !loading) {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
  }, [ir, loading]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif', fontSize: 14 }}>
        Loading activity log...
      </div>
    );
  }
  if (!ir) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif', fontSize: 14 }}>
        Inspection request not found.
      </div>
    );
  }

  const fmtDate = (val: unknown) => formatCalendarDateDisplay(val);
  const fmtDateTime = (val: unknown) => formatDateTimeDisplay(val);
  const canSeePart1CertifierEdits =
    Number(ir.initiator_id) === Number(permissions.userId) || permissions.isAdmin();
  const activities = Array.isArray(ir.activities) ? ir.activities : [];
  const controlNo = ir.request_number
    ? `CABS/INSP/${ir.request_number} dt ${fmtDate(ir.request_date || ir.created_at)}`
    : 'CABS/INSP/XXX';

  return (
    <div id="print-root">
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        #print-root { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; background: #fff; }

        @media print {
          html, body, #print-root { margin: 0; padding: 0; }
          @page { size: A4; margin: 8mm 10mm; }
          .no-print { display: none !important; }
          .print-page { padding: 0; max-width: none; box-shadow: none; }
        }

        .no-print { display: flex; gap: 8px; padding: 12px 16px; background: #f3f4f6; border-bottom: 1px solid #ddd; }
        .no-print button { padding: 6px 12px; font-size: 13px; cursor: pointer; }
        .print-page { max-width: 210mm; margin: 0 auto; padding: 12px 16px 24px; }
        .page-header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
        .ph-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .ph-center { text-align: center; flex: 1; }
        .ph-control { font-size: 12px; }
        .ph-right { font-size: 9px; text-align: right; line-height: 1.4; }
        .form-title { text-align: center; font-size: 14px; font-weight: bold; margin: 8px 0 2px; }
        .form-subtitle { text-align: center; font-size: 11px; margin-bottom: 12px; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: 10.5px; margin-bottom: 12px; }
        .meta b { display: inline-block; min-width: 88px; }
        table.act { width: 100%; border-collapse: collapse; }
        table.act th, table.act td { border: 1px solid #333; padding: 6px 7px; vertical-align: top; }
        table.act th {
          background: #f0f0f0; font-size: 9.5px; text-align: left;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        table.act td { font-size: 10px; }
        .sno { width: 7%; text-align: center; }
        .when { width: 18%; }
        .who { width: 18%; }
        .type { width: 16%; }
        .desc { white-space: pre-wrap; }
        .empty { text-align: center; padding: 20px; color: #555; }
        .footer { text-align: center; font-size: 8px; color: #999; border-top: 1px solid #ccc; padding-top: 4px; margin-top: 16px; }
      `}</style>

      <div className="no-print">
        <button type="button" onClick={() => window.print()}>Print / Save as PDF</button>
        <button type="button" onClick={() => window.close()}>Close</button>
      </div>

      <div className="print-page">
        <div className="page-header">
          <div className="ph-row">
            <div>
              <img src="/logo.png" alt="CABS Logo" style={{ width: 56, height: 56, objectFit: 'contain' }} />
            </div>
            <div className="ph-center">
              <div className="ph-control"><b>R&amp;QA Control No: {controlNo}</b></div>
            </div>
            <div className="ph-right">
              <div><b>Form No.</b>: CABS/R&amp;QA/FF/INSP/001</div>
              <div><b>Rev. No &amp; Date</b>: 04 dt: 25/11/2025</div>
            </div>
          </div>
        </div>

        <div className="form-title">ACTIVITY TIMELINE</div>
        <div className="form-subtitle">Inspection request activity log</div>

        <div className="meta">
          <div><b>IR No:</b> {ir.request_number || '—'}</div>
          <div><b>Status:</b> {String(ir.status || '—').replace(/_/g, ' ')}</div>
          <div><b>Title:</b> {ir.title || '—'}</div>
          <div><b>Initiated by:</b> {ir.initiator_name || '—'}</div>
          <div><b>IR date:</b> {fmtDate(ir.request_date || ir.created_at)}</div>
          <div><b>Printed:</b> {fmtDateTime(new Date().toISOString())}</div>
        </div>

        {activities.length === 0 ? (
          <div className="empty">No activity recorded yet.</div>
        ) : (
          <table className="act">
            <thead>
              <tr>
                <th className="sno">Sl.</th>
                <th className="when">Date &amp; time</th>
                <th className="who">User</th>
                <th className="type">Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity, i) => {
                const isPart1Edit = activity.activity_type === 'part1_edited';
                const description =
                  isPart1Edit && !canSeePart1CertifierEdits
                    ? 'Part I was updated by Request Approver.'
                    : formatInspectionActivityDescription(
                        activity.activity_type,
                        activity.description
                      );
                return (
                  <tr key={activity.id ?? i}>
                    <td className="sno">{i + 1}</td>
                    <td className="when">{fmtDateTime(activity.created_at)}</td>
                    <td className="who">{activity.user_name || '—'}</td>
                    <td className="type">{formatInspectionActivityType(activity.activity_type)}</td>
                    <td className="desc">{description}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="footer">Printed from QMS — Activity Timeline — {ir.request_number || ''}</div>
      </div>
    </div>
  );
}
