import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { canUpdateInspectionRequest } from '@/lib/permissions';
import {
  notifyInspectionRequestSubmitted,
  notifyRequestApproversPendingForward,
  notifyInitiatorPart1EditedByCertifier,
} from '@/lib/notifications';
import {
  userCanAccessInspectionRequest,
  collectInspectorIds,
  fetchAssignedInspectorsByIds,
} from '@/lib/inspection-access';
import { canNominatedCertifierEditPart1 } from '@/lib/request-certifier';
import {
  buildPart1CertifierEditSummary,
  diffPart1Fields,
  formatPart1ChangesSummary,
} from '@/lib/part1-field-diff';

async function ensurePart1CertifierEditSummaryColumn(): Promise<void> {
  await query(
    `ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS part1_certifier_edit_summary TEXT`
  );
}
import {
  getPart1AdvanceNoticeValidationError,
  normalizeInspectionDateTimeFields,
  parsePart1RequestSubmissionDate,
  toDateTimeLocalValue,
  toPart1RequestDateYmd,
  validatePart1DocumentDetailsForward,
} from '@/lib/inspection-display';
import { ensurePart1SoInvolvementColumns, parsePart1Bool } from '@/lib/part1-so-fields-server';
import { PART1_APPROVER_EMPLOYEE_ID } from '@/lib/part1-approver';
import { normalizeEmployeeId } from '@/lib/employee-id';

async function ensurePart1ApprovedByColumn(): Promise<void> {
  await query(
    `ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS part1_approved_by INTEGER`
  );
  await query(
    `ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS part1_approved_at TIMESTAMPTZ`
  );
}

// GET single inspection request
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const requestId = id;

    await ensurePart1ApprovedByColumn();

    const srusCheck = await query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'srus') as exists`
    );
    const hasSrus = srusCheck.rows[0]?.exists;
    const part1EmployeeId = normalizeEmployeeId(PART1_APPROVER_EMPLOYEE_ID).replace(/'/g, "''");

    const result = await query(
      `SELECT
        ir.*,
        initiator.name as initiator_name,
        initiator.email as initiator_email,
        initiator.phone as initiator_phone,
        initiator.employee_id as initiator_employee_id,
        initiator.designation as initiator_designation,
        initiator.scientist_rank as initiator_scientist_rank,
        initiator.signature_path as initiator_signature_path,
        inspector.name as inspector_name,
        (
          SELECT string_agg(u2.name, ', ' ORDER BY s.ord)
          FROM jsonb_array_elements_text(COALESCE(ir.inspector_ids, '[]')::jsonb) WITH ORDINALITY AS s(id_txt, ord)
          JOIN users u2 ON u2.id = s.id_txt::int
        ) as inspector_names,
        inspector.email as inspector_email,
        inspector.phone as inspector_phone,
        inspector.employee_id as inspector_employee_id,
        inspector.designation as inspector_designation,
        inspector.signature_path as inspector_signature_path,
        approver.name as approver_name,
        approved_by_user.name as approved_by_name,
        req_approver.name as request_approver_name,
        req_approver.designation as request_approver_designation,
        req_approver.signature_path as request_approver_signature_path,
        nominated_ra.name as nominated_request_approver_name,
        COALESCE(
          part1_approved_by_user.name,
          CASE
            WHEN ir.status IN (
              'pending', 'draft', 'pending_request_approval',
              'returned_to_designer', 'pending_part1_approval', 'rejected'
            ) THEN NULL
            ELSE (
              SELECT u_act.name
              FROM inspection_activities a
              JOIN users u_act ON u_act.id = a.user_id
              WHERE a.inspection_request_id = ir.id
                AND a.activity_type = 'part1_approved'
              ORDER BY a.created_at DESC
              LIMIT 1
            )
          END
        ) as part1_approved_by_name,
        (
          SELECT u_p1.name
          FROM users u_p1
          WHERE UPPER(TRIM(COALESCE(u_p1.employee_id, ''))) = '${part1EmployeeId}'
          ORDER BY CASE WHEN COALESCE(u_p1.status, 'active') = 'active' THEN 0 ELSE 1 END, u_p1.id
          LIMIT 1
        ) as part1_approver_name,
        qa_approver_user.name as qa_approver_name,
        qa_approver_user.designation as qa_approver_designation,
        qa_approver_user.signature_path as qa_approver_signature_path,
        ordaqa_inspector_user.name as ordaqa_inspector_name,
        ordaqa_inspector_user.designation as ordaqa_inspector_designation,
        ordaqa_inspector_user.employee_id as ordaqa_inspector_employee_id,
        final_qa_user.name as final_qa_approver_name,
        final_qa_user.designation as final_qa_approver_designation,
        final_qa_user.signature_path as final_qa_approver_signature_path,
        ordaqa_approver_user.name as ordaqa_approver_name,
        ordaqa_approver_user.designation as ordaqa_approver_designation,
        part3_user.name as part3_completed_by_name,
        part3_user.signature_path as part3_completed_by_signature_path,
        part4_user.name as part4_completed_by_name,
        nominated_th.name as nominated_team_head_name,
        nominated_th.employee_id as nominated_team_head_employee_id,
        nominated_th.signature_path as nominated_team_head_signature_path,
        (
          SELECT string_agg(u_qh.name, ', ' ORDER BY u_qh.name)
          FROM users u_qh
          WHERE u_qh.role = 'qa_head' AND COALESCE(u_qh.status, 'active') = 'active'
        ) as qa_head_names,
        (
          SELECT string_agg(u_oh.name, ', ' ORDER BY u_oh.name)
          FROM users u_oh
          WHERE u_oh.role = 'ordaqa_head' AND COALESCE(u_oh.status, 'active') = 'active'
        ) as ordaqa_head_names,
        p.name as project_name,
        p.code as project_code,
        ss.name as subsystem_name,
        ss.code as subsystem_code,
        l.name as lru_name,
        l.code as lru_code,
        l.part_number as lru_part_number
        ${hasSrus ? ", sr.name as sru_name, sr.code as sru_code, sr.part_number as sru_part_number" : ""}
      FROM inspection_requests ir
      LEFT JOIN users initiator ON ir.initiator_id = initiator.id
      LEFT JOIN users inspector ON ir.inspector_id = inspector.id
      LEFT JOIN users approver ON ir.approver_id = approver.id
      LEFT JOIN users approved_by_user ON ir.approved_by = approved_by_user.id
      LEFT JOIN users req_approver ON ir.request_approver_id = req_approver.id
      LEFT JOIN users nominated_ra ON ir.nominated_request_approver_id = nominated_ra.id
      LEFT JOIN users part1_approved_by_user ON ir.part1_approved_by = part1_approved_by_user.id
      LEFT JOIN users qa_approver_user ON ir.qa_approver_id = qa_approver_user.id
      LEFT JOIN users ordaqa_inspector_user ON ir.ordaqa_inspector_id = ordaqa_inspector_user.id
      LEFT JOIN users final_qa_user ON ir.final_qa_approver_id = final_qa_user.id
      LEFT JOIN users ordaqa_approver_user ON ir.ordaqa_approver_id = ordaqa_approver_user.id
      LEFT JOIN users part3_user ON ir.part3_completed_by = part3_user.id
      LEFT JOIN users part4_user ON ir.part4_completed_by = part4_user.id
      LEFT JOIN users nominated_th ON ir.nominated_team_head_id = nominated_th.id
      LEFT JOIN projects p ON ir.project_id = p.id
      LEFT JOIN subsystems ss ON ir.subsystem_id = ss.id
      LEFT JOIN lrus l ON ir.lru_id = l.id
      ${hasSrus ? "LEFT JOIN srus sr ON ir.sru_id = sr.id" : ""}
      WHERE ir.id = $1`,
      [requestId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Inspection request not found' }, { status: 404 });
    }

    const userRole = (session.user as any).role;
    const userId = Number.parseInt(String((session.user as any)?.id ?? ''), 10);
    const employeeId = (session.user as any).employee_id as string | undefined;
    const designation = (session.user as any).designation as string | undefined;
    const irRow = result.rows[0];
    const canRead = await userCanAccessInspectionRequest(userRole, userId, irRow, employeeId, designation);
    if (!canRead) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get checklists
    const checklistsResult = await query(
      `SELECT * FROM inspection_checklists WHERE inspection_request_id = $1 ORDER BY created_at`,
      [requestId]
    );

    // Get attachments
    const attachmentsResult = await query(
      `SELECT 
        a.*,
        u.name as uploaded_by_name
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.entity_type = 'inspection_request' AND a.entity_id = $1
      ORDER BY a.created_at DESC`,
      [requestId]
    );

    // Get activities
    const activitiesResult = await query(
      `SELECT 
        ia.*,
        u.name as user_name
      FROM inspection_activities ia
      LEFT JOIN users u ON ia.user_id = u.id
      WHERE ia.inspection_request_id = $1
      ORDER BY ia.created_at DESC`,
      [requestId]
    );

    const inspectorIdList = collectInspectorIds(irRow);
    const assignedInspectors = await fetchAssignedInspectorsByIds(inspectorIdList);

    // Backfill Part IV Team Head approver display fields for older approvals
    let part4DataOut = irRow.part4_data;
    try {
      const p4Raw =
        typeof part4DataOut === 'string'
          ? JSON.parse(part4DataOut)
          : part4DataOut && typeof part4DataOut === 'object'
            ? { ...(part4DataOut as Record<string, unknown>) }
            : null;
      if (
        p4Raw &&
        typeof p4Raw === 'object' &&
        String(p4Raw.team_head_approval_status || '') === 'approved' &&
        p4Raw.part4_team_head_approver_id &&
        !String(p4Raw.part4_team_head_approver_name || '').trim()
      ) {
        const thId = Number(p4Raw.part4_team_head_approver_id);
        if (Number.isFinite(thId) && thId > 0) {
          const thRes = await query(
            `SELECT name, designation, signature_path FROM users WHERE id = $1`,
            [thId]
          );
          const th = thRes.rows[0] as
            | { name?: string; designation?: string; signature_path?: string | null }
            | undefined;
          if (th?.name) {
            p4Raw.part4_team_head_approver_name = String(th.name).trim();
            if (!String(p4Raw.part4_team_head_approver_designation || '').trim() && th.designation) {
              p4Raw.part4_team_head_approver_designation = String(th.designation).trim();
            }
            if (!p4Raw.part4_team_head_approver_signature_path && th.signature_path) {
              p4Raw.part4_team_head_approver_signature_path = String(th.signature_path);
            }
            part4DataOut = p4Raw;
          }
        }
      }
    } catch {
      /* keep original part4_data */
    }

    const canSeePart1CertifierEdits =
      userRole === 'administrator' ||
      (irRow.initiator_id != null && Number(irRow.initiator_id) === userId);

    const activitiesForClient = canSeePart1CertifierEdits
      ? activitiesResult.rows
      : activitiesResult.rows.map((a: { activity_type?: string; description?: string }) =>
          a.activity_type === 'part1_edited'
            ? { ...a, description: 'Part I was updated by Request Approver.' }
            : a
        );

    const inspectionRequest = normalizeInspectionDateTimeFields({
      ...irRow,
      part4_data: part4DataOut,
      // Field-level certifier edit summary is only for Initiator/Designer (and admin)
      part1_certifier_edit_summary: canSeePart1CertifierEdits
        ? irRow.part1_certifier_edit_summary
        : null,
      assigned_inspectors: assignedInspectors,
      checklists: checklistsResult.rows,
      attachments: attachmentsResult.rows,
      activities: activitiesForClient,
    });

    return NextResponse.json({ request: inspectionRequest });
  } catch (error) {
    console.error('Error fetching inspection request:', error);
    return NextResponse.json({ error: 'Failed to fetch inspection request' }, { status: 500 });
  }
}

// PUT update inspection request
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const requestId = id;
    const userRole = (session.user as any).role;
    const userId = parseInt((session.user as any).id);
    const designation = (session.user as any).designation as string | undefined;
    const editorName =
      (session.user as any).name?.trim() ||
      (session.user as any).employee_id ||
      'Request Approver';

    // Get existing request
    const existingResult = await query(
      `SELECT * FROM inspection_requests WHERE id = $1`,
      [requestId]
    );

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Inspection request not found' }, { status: 404 });
    }

    const existingRequest = existingResult.rows[0];

    // Check permissions
    if (!canUpdateInspectionRequest(userRole, userId, existingRequest, designation)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const saveAsDraft = body.save_as_draft === true;
    const submitFinal = body.submit === true;
    const {
      title,
      description,
      location,
      item,
      inspection_type,
      due_date,
      scheduled_date,
      request_date,
      project_id,
      subsystem_id,
      lru_id,
      sru_id,
      item_pertains_to,
      test_type,
      item_pertains_to_other,
      test_type_other,
      so_details,
      delivery_period,
      source,
      oem_name,
      lru_nomenclature,
      criticality,
      part_number,
      serial_number,
      quantity,
      quantity_per_set,
      previous_stage_cleared,
      logbook_attached,
      inspection_stage,
      inspection_mode,
      inspection_datetime,
      inspection_date_from,
      inspection_date_to,
      venue,
      document_details,
      confirmations,
      designer_rep_name,
      designer_rep_designation,
      designer_rep_contact,
      design_coordinator_name,
      certified_by_name,
      certified_by_designation,
      nominated_request_approver_id: bodyNominatedRa,
      so_involves_dgaqa: bodySoInvolvesDgaqa,
      so_involves_rqa: bodySoInvolvesRqa,
    } = body;

    const initiatorPart1Editable =
      existingRequest.initiator_id === userId &&
      ['draft', 'pending', 'returned_to_designer'].includes(existingRequest.status);
    const adminPart1Editable =
      userRole === 'administrator' &&
      ['draft', 'pending', 'returned_to_designer'].includes(existingRequest.status);
    const certifierPart1Editable = canNominatedCertifierEditPart1(
      userId,
      userRole,
      designation,
      existingRequest
    );
    const canFullPart1 = initiatorPart1Editable || adminPart1Editable || certifierPart1Editable;

    const part1PayloadPresent =
      saveAsDraft ||
      submitFinal ||
      project_id !== undefined ||
      subsystem_id !== undefined ||
      lru_id !== undefined;

    if (part1PayloadPresent) {
      if (!saveAsDraft && !canFullPart1) {
        return NextResponse.json(
          { error: 'Full Part I update is not allowed for this status or role' },
          { status: 400 }
        );
      }
      if (saveAsDraft && existingRequest.initiator_id !== userId && userRole !== 'administrator') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (saveAsDraft && !['draft', 'pending', 'returned_to_designer'].includes(existingRequest.status)) {
        return NextResponse.json(
          { error: 'Auto-save is only allowed for draft or editable Part I requests' },
          { status: 400 }
        );
      }
      const srusCheck = await query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'srus') as exists`
      );
      const hasSrus = srusCheck.rows[0]?.exists;

      const autoTitle = title || `Inspection - ${lru_nomenclature || 'LRU'}`;
      const autoLocation = venue || '';
      const autoItem = lru_nomenclature || '';
      const autoInspectionType = inspection_type || inspection_stage || '';

      const dueResolved =
        due_date ||
        inspection_date_to ||
        inspection_date_from ||
        request_date ||
        existingRequest.due_date;

      let nominatedResolved: number | null =
        existingRequest.nominated_request_approver_id != null
          ? Number(existingRequest.nominated_request_approver_id)
          : null;
      if (bodyNominatedRa !== undefined) {
        if (bodyNominatedRa === null || bodyNominatedRa === '') {
          nominatedResolved = null;
        } else {
          const nid = parseInt(String(bodyNominatedRa), 10);
          if (!Number.isFinite(nid) || nid < 1) {
            return NextResponse.json({ error: 'Invalid nominated Request Approver' }, { status: 400 });
          }
          const appr = await query(
            `SELECT id FROM users u
             WHERE u.id = $1
               AND COALESCE(u.status, 'active') = 'active'
               AND (
                 u.role = 'request_approver'
                 OR (
                   u.role = 'initiator'
                   AND UPPER(TRIM(COALESCE(u.designation, ''))) = 'DH'
                 )
               )`,
            [nid]
          );
          if (appr.rows.length === 0) {
            return NextResponse.json(
              {
                error:
                  'Nominated Request Approver must be an active Request Approver, or Initiator/Designer with designation DH',
              },
              { status: 400 }
            );
          }
          nominatedResolved = nid;
        }
      }

      if (!saveAsDraft) {
        if (nominatedResolved == null) {
          return NextResponse.json(
            { error: '21. Designer DH/GD/TH Name (Certifier) is required' },
            { status: 400 }
          );
        }
        const designationResolved = String(
          certified_by_designation !== undefined && certified_by_designation !== null
            ? certified_by_designation
            : (existingRequest.certified_by_designation || '')
        ).trim();
        if (!designationResolved) {
          return NextResponse.json(
            { error: '21. Designation is required' },
            { status: 400 }
          );
        }
        if (submitFinal || existingRequest.status !== 'draft') {
          if (!project_id || !subsystem_id) {
            return NextResponse.json(
              { error: 'Programme/Project and Subsystem are required' },
              { status: 400 }
            );
          }
        }

        const venueResolved = venue !== undefined ? venue : existingRequest.venue;
        const inspectionFromResolved =
          inspection_date_from !== undefined
            ? inspection_date_from
            : inspection_datetime !== undefined
              ? inspection_datetime
              : existingRequest.inspection_date_from || existingRequest.inspection_datetime;
        const submissionDate = parsePart1RequestSubmissionDate(existingRequest.created_at);
        const advanceNoticeError = getPart1AdvanceNoticeValidationError(
          venueResolved,
          inspectionFromResolved,
          submissionDate,
          toDateTimeLocalValue(existingRequest.created_at),
        );
        if (advanceNoticeError) {
          return NextResponse.json({ error: advanceNoticeError }, { status: 400 });
        }

        const docsResolved =
          document_details !== undefined
            ? document_details
            : typeof existingRequest.document_details === 'string'
              ? (() => {
                  try {
                    return JSON.parse(existingRequest.document_details);
                  } catch {
                    return existingRequest.document_details;
                  }
                })()
              : existingRequest.document_details;
        const documentDetailsError = validatePart1DocumentDetailsForward(docsResolved);
        if (documentDetailsError) {
          return NextResponse.json({ error: documentDetailsError }, { status: 400 });
        }

        const soInvolvesDgaqaCheck =
          bodySoInvolvesDgaqa !== undefined
            ? parsePart1Bool(bodySoInvolvesDgaqa)
            : parsePart1Bool(existingRequest.so_involves_dgaqa);
        const soInvolvesRqaCheck =
          bodySoInvolvesRqa !== undefined
            ? parsePart1Bool(bodySoInvolvesRqa)
            : parsePart1Bool(existingRequest.so_involves_rqa);
        if (!soInvolvesDgaqaCheck && !soInvolvesRqaCheck) {
          return NextResponse.json(
            { error: 'Involvement in this inspection is required — select DGAQA and/or R&QA' },
            { status: 400 }
          );
        }
      }

      const designationResolved = String(
        certified_by_designation !== undefined && certified_by_designation !== null
          ? certified_by_designation
          : (existingRequest.certified_by_designation || '')
      ).trim();

      // Section 20 (Designer Rep) is the initiator snapshot — Request Approver / nominated
      // certifier must not overwrite it with their own profile designation/name/contact.
      const preserveDesignerRepSnapshot =
        certifierPart1Editable &&
        existingRequest.initiator_id != null &&
        Number(existingRequest.initiator_id) !== userId;
      const designerRepNameSave = preserveDesignerRepSnapshot
        ? existingRequest.designer_rep_name ?? null
        : designer_rep_name ?? null;
      const designerRepDesignationSave = preserveDesignerRepSnapshot
        ? existingRequest.designer_rep_designation ?? null
        : designer_rep_designation ?? null;
      const designerRepContactSave = preserveDesignerRepSnapshot
        ? existingRequest.designer_rep_contact ?? null
        : designer_rep_contact ?? null;

      const nextStatus =
        !saveAsDraft &&
        (submitFinal ||
          existingRequest.status === 'draft' ||
          existingRequest.status === 'returned_to_designer' ||
          existingRequest.status === 'pending')
          ? 'pending_request_approval'
          : existingRequest.status;

      await ensurePart1SoInvolvementColumns();
      const soInvolvesDgaqa =
        bodySoInvolvesDgaqa !== undefined
          ? parsePart1Bool(bodySoInvolvesDgaqa)
          : parsePart1Bool(existingRequest.so_involves_dgaqa);
      const soInvolvesRqa =
        bodySoInvolvesRqa !== undefined
          ? parsePart1Bool(bodySoInvolvesRqa)
          : parsePart1Bool(existingRequest.so_involves_rqa);

      const updateResult = hasSrus
        ? await query(
            `UPDATE inspection_requests SET
               title = $1, description = $2, location = $3, item = $4, inspection_type = $5,
               due_date = $6, scheduled_date = $7, request_date = $8,
               project_id = $9, subsystem_id = $10, lru_id = $11, sru_id = $12,
               item_pertains_to = $13, test_type = $14,
               item_pertains_to_other = $15, test_type_other = $16,
               so_details = $17, delivery_period = $18, source = $19, oem_name = $20,
               lru_nomenclature = $21, criticality = $22, part_number = $23, serial_number = $24,
               quantity = $25, quantity_per_set = $26,
               previous_stage_cleared = $27, logbook_attached = $28, inspection_stage = $29, inspection_mode = $30,
               inspection_datetime = $31, inspection_date_from = $32, inspection_date_to = $33, venue = $34,
               document_details = $35, confirmations = $36,
               designer_rep_name = $37, designer_rep_designation = $38, designer_rep_contact = $39, design_coordinator_name = $40,
               certified_by_name = $41, certified_by_designation = $42,
               nominated_request_approver_id = $43,
               status = $44,
               updated_at = CURRENT_TIMESTAMP
             WHERE id = $45
             RETURNING *`,
            [
              autoTitle,
              description ?? null,
              autoLocation,
              autoItem,
              autoInspectionType,
              dueResolved,
              scheduled_date ?? null,
              request_date != null
                ? toPart1RequestDateYmd(request_date)
                : existingRequest.request_date,
              project_id || null,
              subsystem_id || null,
              lru_id || null,
              sru_id ?? null,
              item_pertains_to ? JSON.stringify(item_pertains_to) : null,
              test_type ? JSON.stringify(test_type) : null,
              typeof item_pertains_to_other === 'string' ? item_pertains_to_other.trim() || null : null,
              typeof test_type_other === 'string' ? test_type_other.trim() || null : null,
              so_details ?? null,
              delivery_period ?? null,
              source ?? null,
              oem_name ?? null,
              lru_nomenclature ?? null,
              criticality ? JSON.stringify(criticality) : null,
              part_number ?? null,
              serial_number ?? null,
              quantity ?? null,
              quantity_per_set ?? null,
              previous_stage_cleared ?? null,
              logbook_attached ?? null,
              inspection_stage ?? null,
              inspection_mode ?? null,
              inspection_datetime ?? inspection_date_from ?? null,
              inspection_date_from ?? null,
              inspection_date_to ?? null,
              venue ?? null,
              document_details ? JSON.stringify(document_details) : null,
              confirmations ? JSON.stringify(confirmations) : null,
              designerRepNameSave,
              designerRepDesignationSave,
              designerRepContactSave,
              design_coordinator_name ?? null,
              certified_by_name ?? null,
              designationResolved || null,
              nominatedResolved,
              nextStatus,
              requestId,
            ]
          )
        : await query(
            `UPDATE inspection_requests SET
               title = $1, description = $2, location = $3, item = $4, inspection_type = $5,
               due_date = $6, scheduled_date = $7, request_date = $8,
               project_id = $9, subsystem_id = $10, lru_id = $11,
               item_pertains_to = $12, test_type = $13,
               item_pertains_to_other = $14, test_type_other = $15,
               so_details = $16, delivery_period = $17, source = $18, oem_name = $19,
               lru_nomenclature = $20, criticality = $21, part_number = $22, serial_number = $23,
               quantity = $24, quantity_per_set = $25,
               previous_stage_cleared = $26, logbook_attached = $27, inspection_stage = $28, inspection_mode = $29,
               inspection_datetime = $30, inspection_date_from = $31, inspection_date_to = $32, venue = $33,
               document_details = $34, confirmations = $35,
               designer_rep_name = $36, designer_rep_designation = $37, designer_rep_contact = $38, design_coordinator_name = $39,
               certified_by_name = $40, certified_by_designation = $41,
               nominated_request_approver_id = $42,
               status = $43,
               updated_at = CURRENT_TIMESTAMP
             WHERE id = $44
             RETURNING *`,
            [
              autoTitle,
              description ?? null,
              autoLocation,
              autoItem,
              autoInspectionType,
              dueResolved,
              scheduled_date ?? null,
              request_date != null
                ? toPart1RequestDateYmd(request_date)
                : existingRequest.request_date,
              project_id || null,
              subsystem_id || null,
              lru_id || null,
              item_pertains_to ? JSON.stringify(item_pertains_to) : null,
              test_type ? JSON.stringify(test_type) : null,
              typeof item_pertains_to_other === 'string' ? item_pertains_to_other.trim() || null : null,
              typeof test_type_other === 'string' ? test_type_other.trim() || null : null,
              so_details ?? null,
              delivery_period ?? null,
              source ?? null,
              oem_name ?? null,
              lru_nomenclature ?? null,
              criticality ? JSON.stringify(criticality) : null,
              part_number ?? null,
              serial_number ?? null,
              quantity ?? null,
              quantity_per_set ?? null,
              previous_stage_cleared ?? null,
              logbook_attached ?? null,
              inspection_stage ?? null,
              inspection_mode ?? null,
              inspection_datetime ?? inspection_date_from ?? null,
              inspection_date_from ?? null,
              inspection_date_to ?? null,
              venue ?? null,
              document_details ? JSON.stringify(document_details) : null,
              confirmations ? JSON.stringify(confirmations) : null,
              designerRepNameSave,
              designerRepDesignationSave,
              designerRepContactSave,
              design_coordinator_name ?? null,
              certified_by_name ?? null,
              designationResolved || null,
              nominatedResolved,
              nextStatus,
              requestId,
            ]
          );

      const updatedRow = updateResult.rows[0];
      await query(
        `UPDATE inspection_requests SET so_involves_dgaqa = $1, so_involves_rqa = $2 WHERE id = $3`,
        [soInvolvesDgaqa, soInvolvesRqa, requestId]
      );
      updatedRow.so_involves_dgaqa = soInvolvesDgaqa;
      updatedRow.so_involves_rqa = soInvolvesRqa;

      if (!saveAsDraft) {
        await query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            'UPDATE',
            'inspection_request',
            requestId,
            JSON.stringify(existingRequest),
            JSON.stringify(updatedRow),
          ]
        );
      }

      const becamePendingApproval =
        !saveAsDraft &&
        updatedRow.status === 'pending_request_approval' &&
        existingRequest.status !== 'pending_request_approval';

      if (becamePendingApproval && nominatedResolved != null) {
        const fromDraft = existingRequest.status === 'draft';
        if (fromDraft) {
          await notifyInspectionRequestSubmitted(
            updatedRow.id,
            updatedRow.request_number,
            userId,
            nominatedResolved
          );
          await query(
            `INSERT INTO inspection_activities (inspection_request_id, activity_type, description, user_id) VALUES ($1, $2, $3, $4)`,
            [
              requestId,
              'created',
              `Inspection Request ${updatedRow.request_number} submitted for Request Approver forward`,
              userId,
            ]
          );
        } else {
          await notifyRequestApproversPendingForward(
            updatedRow.id,
            updatedRow.request_number,
            existingRequest.initiator_id ?? userId,
            nominatedResolved
          );
          await query(
            `INSERT INTO inspection_activities (inspection_request_id, activity_type, description, user_id) VALUES ($1, $2, $3, $4)`,
            [
              requestId,
              'submitted',
              `Resubmitted for Request Approver forward`,
              userId,
            ]
          );
        }
      } else if (
        !saveAsDraft &&
        certifierPart1Editable &&
        existingRequest.initiator_id != null &&
        Number(existingRequest.initiator_id) !== userId &&
        ['pending', 'pending_request_approval'].includes(String(existingRequest.status || ''))
      ) {
        // Nominated DH / Request Approver edited Part I — field-level summary for initiator
        const DESIGNER_REP_SNAPSHOT_KEYS = new Set([
          'designer_rep_name',
          'designer_rep_designation',
          'designer_rep_contact',
        ]);
        const changes = diffPart1Fields(existingRequest, updatedRow).filter(
          (c) => !DESIGNER_REP_SNAPSHOT_KEYS.has(c.key)
        );
        const fieldsSummary = formatPart1ChangesSummary(changes);
        const summaryPayload = buildPart1CertifierEditSummary(editorName, userId, changes);
        try {
          await ensurePart1CertifierEditSummaryColumn();
          await query(
            `UPDATE inspection_requests SET part1_certifier_edit_summary = $2 WHERE id = $1`,
            [requestId, JSON.stringify(summaryPayload)]
          );
          updatedRow.part1_certifier_edit_summary = JSON.stringify(summaryPayload);
        } catch (e) {
          console.error('Failed to store Part I certifier edit summary:', e);
        }
        const activityDesc =
          changes.length > 0
            ? `Part I updated by Request Approver (${editorName}). Changed fields:\n${fieldsSummary}`
            : `Part I saved by Request Approver (${editorName}) with no field value changes.`;
        await query(
          `INSERT INTO inspection_activities (inspection_request_id, activity_type, description, user_id) VALUES ($1, $2, $3, $4)`,
          [requestId, 'part1_edited', activityDesc, userId]
        );
        try {
          await notifyInitiatorPart1EditedByCertifier(
            Number(requestId),
            String(updatedRow.request_number || existingRequest.request_number || ''),
            existingRequest.initiator_id,
            userId,
            editorName,
            fieldsSummary
          );
        } catch (e) {
          console.error('Initiator Part I edit notification:', e);
        }
      }

      return NextResponse.json({ request: updatedRow });
    }

    const updateResult = await query(
      `UPDATE inspection_requests 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           location = COALESCE($3, location),
           item = COALESCE($4, item),
           inspection_type = COALESCE($5, inspection_type),
           due_date = COALESCE($6, due_date),
           scheduled_date = COALESCE($7, scheduled_date),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        title,
        description,
        location,
        item,
        inspection_type,
        due_date,
        scheduled_date,
        requestId,
      ]
    );

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'UPDATE',
        'inspection_request',
        requestId,
        JSON.stringify(existingRequest),
        JSON.stringify(updateResult.rows[0]),
      ]
    );

    return NextResponse.json({ request: updateResult.rows[0] });
  } catch (error) {
    console.error('Error updating inspection request:', error);
    return NextResponse.json({ error: 'Failed to update inspection request' }, { status: 500 });
  }
}

// DELETE inspection request (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const userRole = (session.user as any).role;
    const userId = parseInt((session.user as any).id);
    const requestId = id;

    // Only administrators can delete
    if (userRole !== 'administrator') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Get existing request for audit log
    const existingResult = await query(
      `SELECT * FROM inspection_requests WHERE id = $1`,
      [requestId]
    );

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Inspection request not found' }, { status: 404 });
    }

    // Delete the request (cascade will handle related records)
    await query(`DELETE FROM inspection_requests WHERE id = $1`, [requestId]);

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'DELETE', 'inspection_request', requestId, JSON.stringify(existingResult.rows[0])]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting inspection request:', error);
    return NextResponse.json({ error: 'Failed to delete inspection request' }, { status: 500 });
  }
}

