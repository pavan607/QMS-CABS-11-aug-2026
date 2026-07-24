'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  formatItemPertainsToDisplay,
  formatTestTypeDisplayWithOther,
  formatReceivedDateTimeDisplay,
  formatCalendarDateDisplay,
  parseYmdLocal,
  formatInspectionStageItemLabel,
  parsePreviousStageCleared,
  ordaqaRepReportDisplay,
  effectiveOrdqaPart5Data,
  teamHeadFinalSignoffApproved,
  formatAssignedInspectorsDisplay,
  resolveAssignedInspectorsForDisplay,
} from '@/lib/inspection-display';

interface IR { [key: string]: any; }

export default function PrintInspectionReport() {
  const params = useParams();
  const [ir, setIr] = useState<IR | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/inspection-requests/${params.id}`)
      .then(res => res.json())
      .then(data => { setIr(data.request || data.inspectionRequest || data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (ir && !loading) {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
  }, [ir, loading]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif', fontSize: 14 }}>Loading report...</div>;
  if (!ir) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif', fontSize: 14 }}>Inspection request not found.</div>;

  const fmt = (val: any) => (val === null || val === undefined || val === '') ? '—' : String(val);
  const fmtDate = (val: any) => formatCalendarDateDisplay(val);
  const fmtDateLong = (val: any) => (val ? formatCalendarDateDisplay(val) : 'DD-MM-YYYY');
  const fmtDateTime = (val: any) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val).replace('T', ' ');
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${dd}-${mm}-${yyyy} ${hh}:${mi}`;
    } catch { return String(val).replace('T', ' '); }
  };
  const fmtArr = (val: any) => {
    if (!val) return '—';
    if (Array.isArray(val)) return val.length ? val.join(', ') : '—';
    try { const p = JSON.parse(val); return Array.isArray(p) && p.length ? p.join(', ') : String(val); } catch { return String(val); }
  };
  const fmtCriticality = (val: any) => {
    if (!val) return '—';
    const arr = Array.isArray(val) ? val : (() => { try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; } })();
    if (!arr.length) return '—';
    const labels: Record<string, string> = { mission: 'Mission Critical', flight: 'Flight Critical', safety: 'Safety Critical', non_critical: 'Non Critical' };
    return arr.map((c: string) => labels[c] || c).join(', ');
  };
  const parseJson = (val: any) => {
    if (!val) return null;
    try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return null; }
  };
  const yn = (val: any) => val === 'yes' || val === true ? 'Yes' : val === 'no' || val === false ? 'No' : val === 'na' ? 'NA' : fmt(val);
  const fmtPreviousStageCleared = (val: any) => {
    const psc = parsePreviousStageCleared(val);
    if (!psc.answer) return '—';
    if (psc.answer === 'no') return 'No';
    const stages = psc.stages.map((s) => formatInspectionStageItemLabel(s)).filter(Boolean);
    return stages.length ? `Yes — ${stages.join(', ')}` : 'Yes';
  };

  const docDetails = parseJson(ir.document_details);
  const confirmations = parseJson(ir.confirmations);
  const p2 = parseJson(ir.part2_data);
  const p3 = parseJson(ir.part3_data);
  const p4 = parseJson(ir.part4_data);
  const p5e = effectiveOrdqaPart5Data(ir);
  const part2InspectorRows = resolveAssignedInspectorsForDisplay(ir);
  const apiInspectors: any[] = ir.assigned_inspectors || [];
  const rep1Insp =
    apiInspectors[0] ??
    (part2InspectorRows[0]
      ? { ...part2InspectorRows[0], signature_path: ir.inspector_signature_path }
      : null);
  const rep2Insp = apiInspectors[1] ?? part2InspectorRows[1] ?? null;
  const p5OrdaqaSig =
    (p5e.ordaqa_sections_24_25_signature_path as string) || ir.part3_completed_by_signature_path;
  const p3OrdqaRepReport = ordaqaRepReportDisplay(
    { ...p5e, delegation_type: p3?.delegation_type, assigned_delegated_to: p3?.assigned_delegated_to },
    ir.ordaqa_inspector_name
  );

  const designerRepDesignation = String(ir.initiator_scientist_rank || ir.designer_rep_designation || '').trim();
  const controlNo = ir.request_number ? `CABS/INSP/${ir.request_number} dt ${fmtDate(ir.request_date || ir.created_at)}` : 'CABS/INSP/XXX';

  const docOrder = ['ts', 'qap', 'sop_mdi', 'qtp_lqtp_softp', 'ftp_atp', 'pc_ta_other'];
  const docLabels: Record<string, string> = {
    ts: 'TS:', qap: 'QAP:', sop_mdi: 'SOP/MDI:', qtp_lqtp_softp: 'QTP/LQTP/SOFTP:',
    ftp_atp: 'FTP/ATP:', pc_ta_other: 'PC/TA/ other Doc:',
  };

  const confirmLabels: Record<string, string> = {
    approved_docs_available: 'a) Approved copies of the above documents are available with Industry Partner before start of QA coverage for LRU.',
    logbook_updated: 'b) R&QA controlled Log book with template are updated.',
    previous_observations_status: 'c) Status of the previous observations/NCs.',
    cocs_available: 'd) CoCs, Certificates, Test Reports, Datasheets, verified Industry partner QC Reports etc. are available for offered stage.',
    instruments_available: 'e) Applicable measuring instruments/Testing facilities are available with valid calibration certificates.',
    joint_inspection_request: 'f) Request for Joint Inspection with ORDAQA as per approved QAP.',
  };

  const PageHeader = () => (
    <div className="page-header">
      <div className="ph-row">
        <div className="ph-logo"><img src="/logo.png" alt="CABS Logo" style={{ width: 56, height: 56, objectFit: 'contain' }} /></div>
        <div className="ph-center">
          <div className="ph-control"><b>R&amp;QA Control No: {controlNo}</b></div>
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
          @page { size: A4; margin: 8mm 10mm; }
          .no-print { display: none !important; }
          .print-page { padding: 0; max-width: none; box-shadow: none; page-break-after: always; display: flex; flex-direction: column; min-height: calc(297mm - 16mm); }
          .print-page:last-child { page-break-after: auto; }
          .page-content { flex: 1; }
        }
        @media screen {
          body { background: #e0e0e0; }
          .print-page { max-width: 210mm; margin: 20px auto; padding: 12mm 14mm; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.15); min-height: 297mm; display: flex; flex-direction: column; }
          .page-content { flex: 1; }
        }

        .no-print { background: #1e3a5f; padding: 12px 0; text-align: center; position: sticky; top: 0; z-index: 10; }
        .no-print button { padding: 10px 32px; font-size: 14px; font-weight: 600; background: #fff; color: #1e3a5f; border: none; border-radius: 6px; cursor: pointer; margin: 0 6px; }
        .no-print button:hover { background: #e8eef5; }

        /* Page Header - matches CABS document */
        .page-header { border: 1.5px solid #000; margin-bottom: 0; }
        .ph-row { display: flex; align-items: stretch; }
        .ph-logo { width: 74px; display: flex; align-items: center; justify-content: center; border-right: 1px solid #000; padding: 4px; }
        .ph-center { flex: 1; padding: 6px 10px; display: flex; flex-direction: column; justify-content: center; border-right: 1px solid #000; }
        .ph-control { font-size: 11px; margin-bottom: 1px; }
        .ph-note { font-size: 9px; color: #333; }
        .ph-right { width: 200px; padding: 6px 10px; display: flex; flex-direction: column; justify-content: center; font-size: 9px; line-height: 1.6; }
        .ph-right b { margin-right: 3px; }

        /* Form Title */
        .form-title { text-align: center; font-weight: bold; font-size: 13px; padding: 6px 0 2px; letter-spacing: 0.3px; border: 1.5px solid #000; border-top: none; }
        .form-subtitle { text-align: center; font-weight: bold; font-size: 10px; padding: 0 0 5px; border: 1.5px solid #000; border-top: none; }

        /* Part Title */
        .part-title { background: #1e3a5f; color: #fff; font-weight: bold; font-size: 11px; padding: 5px 10px; margin-top: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #000; padding: 3px 5px; vertical-align: top; font-size: 10.5px; line-height: 1.4; }
        .sno { width: 26px; text-align: center; font-weight: bold; background: #f5f5f5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .label { width: 35%; font-weight: 600; background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .value { width: auto; }
        .sub-label { padding-left: 14px; font-weight: normal; }
        .center { text-align: center; }
        .sign-row td { height: 60px; vertical-align: bottom; }
        .doc-th { background: #f0f0f0; font-weight: bold; font-size: 9.5px; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .remark-th { background: #f0f0f0; font-weight: bold; font-size: 9.5px; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .section-head { background: #e8e8e8; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page-footer { margin-top: auto; padding-top: 6px; }
        .footer { text-align: center; font-size: 8px; color: #999; border-top: 1px solid #ccc; padding-top: 4px; }
        .page-num { text-align: right; font-size: 9px; font-weight: bold; margin-bottom: 2px; }
        .cert-text { font-size: 9.5px; padding: 4px 8px; line-height: 1.5; }
      `}</style>

      <div className="no-print">
        <button onClick={() => window.print()}>Print / Save as PDF</button>
        <button onClick={() => window.close()}>Close</button>
      </div>

      {/* ==================== PAGE 1 ==================== */}
      <div className="print-page">
        <PageHeader />
        <div className="form-title">REQUEST FOR R&amp;QA INSPECTION/TESTING</div>
        <div className="form-subtitle">(Electrical / Mechanical / System-level Test / others)</div>
        <div className="page-content">
        <div className="part-title">Part –I Details of item(s) to be inspected</div>

        <table>
          <tbody>
            <Row n="1" label="Programme / Project" value={ir.project_name ? (ir.project_code ? `${ir.project_name} — ${ir.project_code}` : fmt(ir.project_name)) : '—'} />
            <Row n="2" label="Subsystem" value={ir.subsystem_name ? (ir.subsystem_code ? `${ir.subsystem_name} — ${ir.subsystem_code}` : fmt(ir.subsystem_name)) : '—'} />
            <tr>
              <td className="sno" rowSpan={2}>3</td>
              <td className="label">Item Pertains to</td>
              <td className="value">{formatItemPertainsToDisplay(ir.item_pertains_to)}</td>
            </tr>
            <tr>
              <td className="label sub-label">Test Type</td>
              <td className="value">{formatTestTypeDisplayWithOther(ir.test_type, ir.test_type_other)}</td>
            </tr>
            <tr>
              <td className="sno" rowSpan={2}>4</td>
              <td className="label">SO Details with Delivery Period</td>
              <td className="value">{fmt(ir.so_details)}</td>
            </tr>
            <tr>
              <td className="label sub-label">Delivery Period</td>
              <td className="value">{fmtDate(ir.delivery_period)}</td>
            </tr>
            <tr>
              <td className="sno" rowSpan={2}>5</td>
              <td className="label">Source</td>
              <td className="value">{fmt(ir.source)}</td>
            </tr>
            <tr>
              <td className="label sub-label">OEM Name</td>
              <td className="value">{fmt(ir.oem_name)}</td>
            </tr>
            <Row n="6" label="LRU / SRU Nomenclature" value={fmt(ir.lru_nomenclature || ir.item)} />
            <Row n="7" label="Criticality of Store" value={fmtCriticality(ir.criticality)} />
            <Row n="8" label="Part Number" value={fmt(ir.part_number || ir.lru_part_number)} />
            <Row n="9" label="Serial Number" value={fmt(ir.serial_number)} />
            <Row
              n="10"
              label="No. of sets — Qty/set"
              value={
                ir.quantity != null && ir.quantity_per_set != null
                  ? `${ir.quantity} — ${ir.quantity_per_set}`
                  : '—'
              }
            />
            <Row
              n="11"
              label="Qty"
              value={
                ir.quantity != null && ir.quantity_per_set == null ? String(ir.quantity) : '—'
              }
            />
            <Row n="12" label="Previous Stage Cleared" value={fmtPreviousStageCleared(ir.previous_stage_cleared)} />
            <Row n="13" label="Log Book Copy Attached" value={yn(ir.logbook_attached)} />
            <Row n="14" label="Inspection Stage Offered Now" value={fmt(ir.inspection_stage)} />
            <Row n="15" label="Mode of Inspection" value={({'physical':'Physical','vc':'VC','hybrid':'Through Hybrid','physical_vc':'Physical VC'} as Record<string,string>)[ir.inspection_mode || ''] || fmt(ir.inspection_mode)} />
            <Row n="16" label="Venue" value={fmt(ir.venue || ir.location)} />
            <Row n="17" label="Inspection date & time" value={(() => {
              const from = ir.inspection_date_from || ir.inspection_datetime;
              const to = ir.inspection_date_to;
              if (!from) return '—';
              const fmtD = (d: string) => formatReceivedDateTimeDisplay(d, '—');
              let result = `From: ${fmtD(from)}`;
              if (to) {
                const a = parseYmdLocal(String(from).slice(0, 10));
                const b = parseYmdLocal(String(to).slice(0, 10));
                const days = a && b ? Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 0;
                result += `  To: ${fmtD(to)}  (${days} day${days !== 1 ? 's' : ''})`;
              }
              return result;
            })()} />
          </tbody>
        </table>

        {/* Section 18 - Document Details */}
        <table>
          <tbody>
            <tr>
              <td className="sno">18</td>
              <td colSpan={4} style={{ fontWeight: 600 }}>The available Document Details</td>
            </tr>
          </tbody>
        </table>
        <table>
          <thead>
            <tr>
              <td className="doc-th" style={{ width: '20%' }}>Type</td>
              <td className="doc-th" style={{ width: '14%' }}>Approval Status</td>
              <td className="doc-th" style={{ width: '22%' }}>Controlled Document No.</td>
              <td className="doc-th" style={{ width: '10%' }}>Amd No.</td>
              <td className="doc-th" style={{ width: '10%' }}>Rev. No</td>
              <td className="doc-th" style={{ width: '18%' }}>Date</td>
            </tr>
          </thead>
          <tbody>
            {docDetails && Object.keys(docDetails).length > 0 ? docOrder.filter(k => docDetails[k]).map(k => [k, docDetails[k]] as [string, any]).map(([key, val]: [string, any]) => (
              <tr key={key}>
                <td style={{ fontWeight: 600, fontSize: 10 }}>{docLabels[key] || key}</td>
                <td className="center" style={{ fontSize: 10 }}>{val?.approved === 'yes' ? 'Yes' : val?.approved === 'no' ? 'No' : val?.approved === 'na' ? 'NA' : val?.approved === 'draft' ? 'Draft' : '—'}</td>
                <td className="center" style={{ fontSize: 10 }}>{val?.doc_no || '—'}</td>
                <td className="center" style={{ fontSize: 10 }}>{val?.amd_no || '—'}</td>
                <td className="center" style={{ fontSize: 10 }}>{val?.rev_no || '—'}</td>
                <td className="center" style={{ fontSize: 10 }}>{val?.date ? fmtDate(val.date) : '—'}</td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="center" style={{ fontSize: 10, padding: 6 }}>No document details available</td></tr>
            )}
          </tbody>
        </table>

        {/* Section 19 - Confirmations */}
        <table>
          <tbody>
            <tr>
              <td className="sno">19</td>
              <td style={{ fontWeight: 600 }}>Please confirm the following details.</td>
              <td style={{ fontWeight: 600, textAlign: 'center', width: 80 }}>Remarks</td>
            </tr>
            {Object.entries(confirmLabels).map(([key, lbl]) => (
              <tr key={key}>
                <td className="sno"></td>
                <td style={{ fontSize: 10 }}>{lbl}</td>
                <td className="center" style={{ fontSize: 10 }}>
                  {confirmations?.[key] === 'yes' ? 'Yes' : confirmations?.[key] === 'no' ? 'No' : confirmations?.[key] === 'na' ? 'NA' : fmt(confirmations?.[key])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Section 20 */}
        <table>
          <tbody>
            <tr>
              <td className="sno" rowSpan={4}>20</td>
              <td colSpan={2} style={{ fontWeight: 600 }}>It is confirmed that the above details are correct.</td>
            </tr>
            <tr>
              <td className="label">Designer Rep Name</td>
              <td className="value">{fmt(ir.designer_rep_name)}{designerRepDesignation ? ` — ${designerRepDesignation}` : ''}</td>
            </tr>
            <tr>
              <td className="label sub-label">Contact Number</td>
              <td className="value">{fmt(ir.designer_rep_contact)}</td>
            </tr>
            <tr>
              <td className="label">Design Coordinator Name &amp; Signature</td>
              <td className="value">{fmt(ir.design_coordinator_name)}</td>
            </tr>
          </tbody>
        </table>

        {/* Section 21 */}
        <table>
          <tbody>
            <tr>
              <td className="sno" rowSpan={3}>21</td>
              <td colSpan={2} style={{ fontWeight: 600, fontSize: 10 }}>It is certified that the above LRU/SRU/Assembly/Part/material is ready for Inspection / Testing.</td>
            </tr>
            <tr>
              <td className="label">Designer DH/GD/TH Signature, Name &amp; Designation</td>
              <td className="value">
                <span>{fmt(ir.request_approver_name || ir.certified_by_name || ir.nominated_request_approver_name)}{ir.certified_by_designation || ir.request_approver_designation ? ` — ${ir.certified_by_designation || ir.request_approver_designation}` : ''}</span>
                {ir.request_approver_signature_path && (
                  <img src={ir.request_approver_signature_path} alt="" style={{ height: 30, marginTop: 2, objectFit: 'contain' }} />
                )}
              </td>
            </tr>
            <tr>
              <td className="label sub-label">Date &amp; Time</td>
              <td className="value">{fmtDateTime(ir.request_approval_date)}</td>
            </tr>
          </tbody>
        </table>

        </div>
        <div className="page-footer">
          <div className="page-num">Page 1 of 3</div>
          <div className="footer">Generated from QMS — {fmtDateTime(new Date())}</div>
        </div>
      </div>

      {/* ==================== PAGE 2 ==================== */}
      <div className="print-page">
        <PageHeader />
        <div className="page-content">
        <div className="part-title">Part –II R&amp;QA Office Use</div>
        <table>
          <tbody>
            <tr>
              <td className="sno" rowSpan={8}>22</td>
              <td className="section-head" colSpan={2}>Head R&amp;QA Comments</td>
            </tr>
            <tr><td className="label">Inspection Request to be</td><td className="value">{fmt(p2?.head_rqa_comments || ir.part2_notes)}</td></tr>
            <tr><td className="label sub-label">Return to Designer</td><td className="value">{p2?.return_to_designer === 'yes' ? 'Yes' : 'No'}</td></tr>
            <tr><td className="label sub-label">Forward to ORDAQA for Joint Inspection</td><td className="value">{ir.forwarded_to_ordaqa ? 'Yes' : 'No'}</td></tr>
            <tr><td className="label">Nominated Officer/Staff — Team Head</td><td className="value">{fmt(p2?.nominated_team_head)}</td></tr>
            <tr><td className="label sub-label">R&amp;QA Rep</td><td className="value">{formatAssignedInspectorsDisplay(ir)}</td></tr>
            <tr><td className="label sub-label">Third Party Inspection Agency</td><td className="value">{fmt(p2?.third_party_agency)}</td></tr>
            <tr>
              <td className="label">Head R&amp;QA Name/Seal &amp; Signature with Date</td>
              <td className="value">
                <span>{fmt(ir.qa_approver_name)}{ir.qa_approver_designation ? ` (${ir.qa_approver_designation})` : ''}{ir.part2_date ? ` — ${fmtDateTime(ir.part2_date)}` : ''}</span>
                {ir.qa_approver_signature_path && (
                  <img src={ir.qa_approver_signature_path} alt="" style={{ height: 30, marginTop: 2, objectFit: 'contain' }} />
                )}
              </td>
            </tr>
          </tbody>
        </table>
        {p2?.outstation_inspection && (
          <table>
            <tbody>
              <tr>
                <td className="sno"></td>
                <td className="label">In case of Outstation Inspection — Email Sent</td>
                <td className="value">{p2?.email_sent ? 'Yes' : 'No'}{p2?.email_sent_by ? ` — Name: ${p2.email_sent_by}` : ''}{p2?.email_sent_date ? ` — Date: ${p2.email_sent_date}` : ''}</td>
              </tr>
            </tbody>
          </table>
        )}

        {/* ==================== PART III ==================== */}
        <div className="part-title">Part –III ORDAQA (CABS Cell) Office Use</div>
        <table>
          <tbody>
            <tr>
              <td className="sno" rowSpan={5}>23</td>
              <td className="section-head" colSpan={2}>ORDAQA Comments</td>
            </tr>
            <tr><td className="label">Received Date &amp; Time</td><td className="value">{formatReceivedDateTimeDisplay(p3?.received_date_time)}</td></tr>
            <tr><td className="label">Memo to be Returned</td><td className="value">{fmt(p3?.memo_returned)}</td></tr>
            <tr><td className="label">{p3?.delegation_type === 'assigned' ? 'Assigned to' : p3?.delegation_type === 'delegated' ? 'Delegated to' : 'Assigned / Delegated to'}</td><td className="value">{fmt(p3?.assigned_delegated_to)}</td></tr>
            <tr><td className="label">Name &amp; Sign of Oi/c ORDAQA CABS Cell</td><td className="value">{fmt(p3?.oic_ordaqa_name || ir.part3_completed_by_name)}</td></tr>
          </tbody>
        </table>

        </div>
        <div className="page-footer">
          <div className="page-num">Page 2 of 3</div>
          <div className="footer">Generated from QMS — {fmtDateTime(new Date())}</div>
        </div>
      </div>

      {/* ==================== PAGE 3 ==================== */}
      <div className="print-page">
        <PageHeader />
        <div className="page-content">
        <div className="part-title">Part –IV CABS R&amp;QA INSPECTION REPORT (to be filled by R&amp;QA Division)</div>

        <table>
          <tbody>
            <tr>
              <td className="sno" rowSpan={3}>26</td>
              <td className="label">Details of Inspection / Test Completed</td>
              <td className="value">{fmt(p4?.inspection_details)}</td>
            </tr>
            <tr><td className="label sub-label">Inspection / Test Start Date</td><td className="value">{p4?.start_date ? fmtDate(p4.start_date) : '—'}</td></tr>
            <tr><td className="label sub-label">Inspection / Test Completion Date</td><td className="value">{p4?.completion_date ? fmtDate(p4.completion_date) : '—'}</td></tr>
          </tbody>
        </table>

        {/* Section 27 */}
        <table>
          <thead>
            <tr>
              <td className="sno">27</td>
              <td className="doc-th">No. of Items Offered for Inspection</td>
              <td className="doc-th">Accepted</td>
              <td className="doc-th">No. of Observations</td>
              <td className="doc-th">Rejected</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="sno"></td>
              <td className="center">{fmt(p4?.items_offered)}</td>
              <td className="center">{fmt(p4?.items_accepted)}</td>
              <td className="center">{fmt(p4?.observations_count)}</td>
              <td className="center">{fmt(p4?.items_rejected)}</td>
            </tr>
          </tbody>
        </table>

        {/* Section 28 */}
        <table>
          <tbody>
            <tr><td className="sno" rowSpan={7}>28</td><td className="section-head" colSpan={2}>Remarks / Observations by Inspector (R&amp;QA Staff/Officer)</td></tr>
            <tr><td className="label sub-label">a. Verification of observations in log book from previous stages</td><td className="value">{yn(p4?.verification_logbook)}</td></tr>
            <tr><td className="label sub-label">b. Instruments/Test Facilities Calibration details mentioned in log book</td><td className="value">{yn(p4?.instruments_calibration)}</td></tr>
            <tr><td className="label sub-label">c. Copy of log book entries attached</td><td className="value">{(() => {
              const logAtt = (ir.attachments || []).find((a: { id: number }) => Number(a.id) === Number(p4?.logbook_copy_attachment_id));
              const base = yn(p4?.logbook_copy_attached);
              if (p4?.logbook_copy_attached === 'yes' && logAtt?.file_name) return `${base} (${logAtt.file_name})`;
              if (p4?.logbook_copy_attached === 'yes' && p4?.logbook_copy_file_name) return `${base} (${p4.logbook_copy_file_name})`;
              return base;
            })()}</td></tr>
            <tr><td className="label sub-label">d. Status of inspection carried out</td><td className="value">{fmt(p4?.inspection_status)}</td></tr>
            <tr><td className="label sub-label">e. Inspection carried out as per guiding checklist</td><td className="value">{yn(p4?.per_guiding_checklist)}</td></tr>
            <tr><td className="label sub-label">f. Remarks</td><td className="value">{fmt(p4?.remarks)}</td></tr>
          </tbody>
        </table>

        {/* Section 29 — Inspection Remarks */}
        <table>
          <tbody>
            <tr>
              <td className="sno">29</td>
              <td className="section-head" colSpan={4}>Inspection Remarks (Mechanical / Electrical / Other)</td>
            </tr>
          </tbody>
        </table>
        <table>
          <thead>
            <tr>
              <td className="remark-th" style={{ width: '7%' }}>Sl. No</td>
              <td className="remark-th" style={{ width: '46%' }}>Observation</td>
              <td className="remark-th" style={{ width: '47%' }}>Action Required</td>
            </tr>
          </thead>
          <tbody>
            {p4?.part4_remarks && Array.isArray(p4.part4_remarks) && p4.part4_remarks.length > 0 ? (
              p4.part4_remarks.map((r: any, i: number) => (
                <tr key={i}>
                  <td className="center" style={{ fontSize: 10 }}>{r.sl_no || i + 1}</td>
                  <td style={{ textAlign: 'left', fontSize: 10, padding: '2px 4px' }}>{r.observation || '—'}</td>
                  <td style={{ textAlign: 'left', fontSize: 10, padding: '2px 4px' }}>{r.action_required || '—'}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={3} className="center" style={{ fontSize: 10, padding: '6px 4px', fontStyle: 'italic', color: '#888' }}>—</td></tr>
            )}
          </tbody>
        </table>

        {/* Section 30 — immediately after Section 29 */}
        <table>
          <tbody>
            <tr>
              <td className="sno">30</td>
              <td className="section-head" colSpan={3}>Inspector Name/Seal &amp; Signature with Date</td>
            </tr>
            <tr>
              <td className="sno"></td>
              <td className="doc-th" style={{ width: '33%' }}>Rep 1</td>
              <td className="doc-th" style={{ width: '33%' }}>Rep 2</td>
              <td className="doc-th" style={{ width: '33%' }}>Signature/Seal of Team Head</td>
            </tr>
            <tr className="sign-row">
              <td className="sno"></td>
              <td className="center" style={{ verticalAlign: 'bottom', padding: '4px 6px' }}>
                {rep1Insp?.signature_path && (
                  <img src={rep1Insp.signature_path} alt="" style={{ height: 32, margin: '0 auto 2px', display: 'block', objectFit: 'contain' }} />
                )}
                <div style={{ fontSize: 9 }}>
                  {rep1Insp
                    ? `${rep1Insp.name}${rep1Insp.employee_id ? ` (${rep1Insp.employee_id})` : ''}`
                    : fmt(p4?.inspector_rep1_name)}
                </div>
                <div style={{ fontSize: 8, color: '#555', marginTop: 2 }}>{fmtDateTime(ir.part4_date)}</div>
              </td>
              <td className="center" style={{ verticalAlign: 'bottom', padding: '4px 6px' }}>
                {rep2Insp?.signature_path && (
                  <img src={rep2Insp.signature_path} alt="" style={{ height: 32, margin: '0 auto 2px', display: 'block', objectFit: 'contain' }} />
                )}
                <div style={{ fontSize: 9 }}>
                  {rep2Insp
                    ? `${rep2Insp.name}${rep2Insp.employee_id ? ` (${rep2Insp.employee_id})` : ''}`
                    : fmt(p4?.inspector_rep2_name)}
                </div>
                {(rep2Insp || p4?.inspector_rep2_name) && (
                  <div style={{ fontSize: 8, color: '#555', marginTop: 2 }}>{fmtDateTime(ir.part4_date)}</div>
                )}
              </td>
              <td className="center" style={{ verticalAlign: 'bottom', padding: '4px 6px' }}>
                {teamHeadFinalSignoffApproved(ir) && ir.final_qa_approver_name ? (
                  <>
                    {ir.final_qa_approver_signature_path && (
                      <img src={ir.final_qa_approver_signature_path} alt="" style={{ height: 32, margin: '0 auto 2px', display: 'block', objectFit: 'contain' }} />
                    )}
                    <div style={{ fontSize: 9 }}>
                      {ir.final_qa_approver_name}
                      {ir.final_qa_approver_designation ? ` (${ir.final_qa_approver_designation})` : ''}
                    </div>
                    <div style={{ fontSize: 8, color: '#555', marginTop: 2 }}>
                      {fmtDateTime(ir.final_qa_approval_date)}
                    </div>
                  </>
                ) : (
                  <span style={{ fontSize: 9, color: '#888', fontStyle: 'italic' }}>—</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {ir.forwarded_to_ordaqa && (
          <>
            <div className="part-title">Part –V ORDAQA (Sections 24–25)</div>
            <table>
              <tbody>
                <tr>
                  <td className="sno">24</td>
                  <td className="section-head" colSpan={5}>Inspection Remarks (Mechanical / Electrical / Other)</td>
                </tr>
              </tbody>
            </table>
            <table>
              <thead>
                <tr>
                  <td className="remark-th" style={{ width: '7%' }}>Sl. No</td>
                  <td className="remark-th" style={{ width: '30%' }}>Observation</td>
                  <td className="remark-th" style={{ width: '30%' }}>Action Required</td>
                  <td className="remark-th" style={{ width: '15%' }}>Closed On</td>
                  <td className="remark-th" style={{ width: '18%' }}>Signature</td>
                </tr>
              </thead>
              <tbody>
                {p5e.inspection_remarks && Array.isArray(p5e.inspection_remarks) && p5e.inspection_remarks.length > 0 ? (
                  (p5e.inspection_remarks as any[]).map((r: any, i: number) => (
                    <tr key={i}>
                      <td className="center" style={{ fontSize: 10 }}>{r.sl_no || i + 1}</td>
                      <td style={{ textAlign: 'left', fontSize: 10 }}>{r.observation || '—'}</td>
                      <td style={{ textAlign: 'left', fontSize: 10 }}>{r.action_required || '—'}</td>
                      <td className="center" style={{ fontSize: 10 }}>{r.closed_on ? fmtDate(r.closed_on) : '—'}</td>
                      <td className="center" style={{ fontSize: 10 }}>{r.signature || ir.part3_completed_by_name || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td className="center" colSpan={5} style={{ height: 24, fontSize: 10 }}>No remarks recorded</td></tr>
                )}
              </tbody>
            </table>
            <table>
              <tbody>
                <tr>
                  <td className="sno" rowSpan={3}>25</td>
                  <td className="section-head" colSpan={2}>Clearance Status</td>
                </tr>
                <tr>
                  <td colSpan={2} className="value" style={{ fontSize: 10 }}>
                    {(() => {
                      const cs = p5e.clearance_status as string | undefined;
                      if (cs === 'accepted') return '☑ Accepted and Cleared   ☐ Open   ☐ Rework';
                      if (cs === 'open') return '☐ Accepted and Cleared   ☑ Open   ☐ Rework';
                      if (cs === 'rework') return '☐ Accepted and Cleared   ☐ Open   ☑ Rework';
                      return '☐ Accepted and Cleared   ☐ Open   ☐ Rework';
                    })()}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="cert-text">
                    I hereby certify that material/part/installation/assembly/operation/stage has been fully inspected, tested and confirmed to the approved drawing/ATP and all technology requirements stipulated in relevant approved schedule. The stage is hereby recommended/not recommended for your further clearance/acceptance.
                  </td>
                </tr>
              </tbody>
            </table>
            <table>
              <tbody>
                <tr>
                  <td className="sno"></td>
                  <td className="label">ORDAQA Approved Inspector Name &amp; Seal</td>
                  <td className="value">{fmt(p5e.dgaqa_inspector_name)}</td>
                </tr>
                <tr>
                  <td className="sno"></td>
                  <td className="label">(In case of delegation to R&amp;QA) ORDAQA Rep</td>
                  <td className="value">{fmt(p3OrdqaRepReport)}</td>
                </tr>
                {p5OrdaqaSig && (
                  <tr>
                    <td className="sno"></td>
                    <td className="label">Electronic signature (Sections 24–25)</td>
                    <td className="value" style={{ verticalAlign: 'middle' }}>
                      <img src={p5OrdaqaSig} alt="" style={{ height: 36, maxWidth: 200, objectFit: 'contain', display: 'block' }} />
                      <span style={{ fontSize: 9, display: 'block', marginTop: 4 }}>
                        {ir.part3_completed_by_name ? `Signed by: ${ir.part3_completed_by_name}` : ''}
                        {ir.part3_date
                          ? `${ir.part3_completed_by_name ? ' — ' : ''}Date: ${fmtDate(ir.part3_date)}`
                          : ''}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}


        {/* Final Approvals (app-specific) */}
        {(ir.final_qa_approver_name || ir.ordaqa_approver_name) && (
          <table style={{ marginTop: 8 }}>
            <tbody>
              <tr><td className="section-head" colSpan={3}>Final Approvals</td></tr>
              {ir.final_qa_approver_name && (
                <tr>
                  <td className="label" style={{ width: '40%' }}>QA Approver (R&amp;QA)</td>
                  <td className="value">
                    <span>{ir.final_qa_approver_name}{ir.final_qa_approver_designation ? ` (${ir.final_qa_approver_designation})` : ''}</span>
                    {ir.final_qa_approver_signature_path && (
                      <img src={ir.final_qa_approver_signature_path} alt="" style={{ height: 28, marginTop: 2, objectFit: 'contain' }} />
                    )}
                  </td>
                  <td className="center" style={{ width: 90 }}>{fmtDate(ir.final_qa_approval_date)}</td>
                </tr>
              )}
              {ir.ordaqa_approver_name && (
                <tr>
                  <td className="label">ORDAQA Head (Part V approval)</td>
                  <td className="value">{ir.ordaqa_approver_name}{ir.ordaqa_approver_designation ? ` (${ir.ordaqa_approver_designation})` : ''}</td>
                  <td className="center" style={{ width: 90 }}>{fmtDate(ir.ordaqa_approval_date)}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        </div>
        <div className="page-footer">
          <div className="page-num">Page 3 of 3</div>
          <div className="footer">Generated from QMS — {fmtDateTime(new Date())}</div>
        </div>
      </div>
    </div>
  );
}

function Row({ n, label, value }: { n: string; label: string; value: string }) {
  return (
    <tr>
      <td className="sno">{n}</td>
      <td className="label">{label}</td>
      <td className="value">{value}</td>
    </tr>
  );
}
