import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { notifyInspectionRequestSubmitted } from '@/lib/notifications';
import { getLocalYmdToday, getPart1AdvanceNoticeValidationError, parsePart1RequestSubmissionDate, toPart1RequestDateYmd } from '@/lib/inspection-display';
import {
  sqlInspectionScopeCondition,
  sqlInspectionScopeNeedsUserId,
  userHasGlobalInspectionAccess,
} from '@/lib/inspection-access';

// GET all inspection requests
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const inspectorId = searchParams.get('inspector_id');
    const initiatorId = searchParams.get('initiator_id');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');

    const srusCheck = await query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'srus') as exists`
    );
    const hasSrus = srusCheck.rows[0]?.exists;

    let sql = `
      SELECT 
        ir.*,
        initiator.name as initiator_name,
        initiator.email as initiator_email,
        inspector.name as inspector_name,
        inspector.email as inspector_email,
        (
          SELECT string_agg(u2.name, ', ' ORDER BY s.ord)
          FROM jsonb_array_elements_text(COALESCE(ir.inspector_ids, '[]')::jsonb) WITH ORDINALITY AS s(id_txt, ord)
          JOIN users u2 ON u2.id = s.id_txt::int
        ) as inspector_names,
        approver.name as approver_name,
        approved_by_user.name as approved_by_name,
        p.name as project_name,
        p.code as project_code,
        ss.name as subsystem_name,
        ss.code as subsystem_code,
        l.name as lru_name
        ${hasSrus ? ", sr.name as sru_name, sr.code as sru_code" : ""},
        (SELECT COUNT(*) FROM inspection_checklists WHERE inspection_request_id = ir.id) as checklist_count,
        (SELECT COUNT(*) FROM attachments WHERE entity_type = 'inspection_request' AND entity_id = ir.id) as attachment_count
      FROM inspection_requests ir
      LEFT JOIN users initiator ON ir.initiator_id = initiator.id
      LEFT JOIN users inspector ON ir.inspector_id = inspector.id
      LEFT JOIN users approver ON ir.approver_id = approver.id
      LEFT JOIN users approved_by_user ON ir.approved_by = approved_by_user.id
      LEFT JOIN projects p ON ir.project_id = p.id
      LEFT JOIN subsystems ss ON ir.subsystem_id = ss.id
      LEFT JOIN lrus l ON ir.lru_id = l.id
      ${hasSrus ? "LEFT JOIN srus sr ON ir.sru_id = sr.id" : ""}
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    const userRole = (session.user as any).role;
    const userId = Number.parseInt(String((session.user as any)?.id ?? ''), 10);
    const employeeId = (session.user as any).employee_id as string | undefined;
    const hasGlobalInspectionScope = userHasGlobalInspectionAccess(userRole, employeeId);

    const needsStrictUserId =
      !hasGlobalInspectionScope &&
      (userRole === 'inspector' ||
        userRole === 'ordaqa_inspector' ||
        userRole === 'qa_approver' ||
        userRole === 'initiator' ||
        userRole === 'request_approver');

    if (needsStrictUserId && (!Number.isFinite(userId) || userId < 1)) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    if (!hasGlobalInspectionScope) {
      if (userRole === 'initiator') {
        sql += ` AND ir.initiator_id = $${paramIndex}`;
        params.push(userId);
        paramIndex++;
      }

      const scopeRoles = ['inspector', 'ordaqa_inspector', 'qa_approver', 'ordaqa_head'] as const;
      if (scopeRoles.includes(userRole as (typeof scopeRoles)[number])) {
        const ph = `$${paramIndex}`;
        const scopeCond = sqlInspectionScopeCondition(userRole, 'ir', ph);
        if (scopeCond) {
          sql += ` AND ${scopeCond}`;
          if (sqlInspectionScopeNeedsUserId(userRole)) {
            params.push(userId);
            paramIndex++;
          }
        }
      }

      if (userRole === 'request_approver') {
        sql += ` AND (
          ir.nominated_request_approver_id = $${paramIndex}
          OR (
            ir.nominated_request_approver_id IS NULL
            AND ir.initiator_id IN (
              WITH RECURSIVE team AS (
                SELECT id FROM users WHERE reporting_to = $${paramIndex}
                UNION ALL
                SELECT u.id FROM users u INNER JOIN team t ON u.reporting_to = t.id
              )
              SELECT id FROM team
            )
          )
        )`;
        params.push(userId);
        paramIndex++;
      }

      if (userRole === 'qa_head') {
        const qaHeadScope = sqlInspectionScopeCondition('qa_head', 'ir', '$1');
        if (qaHeadScope) sql += ` AND ${qaHeadScope}`;
      }
    }
    // administrator, os_director, global employee override — no row filter

    if (status) {
      sql += ` AND ir.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    } else {
      // Auto-save drafts are local-only now; hide legacy DB draft rows from the default list.
      sql += ` AND ir.status != 'draft'`;
    }

    if (inspectorId) {
      sql += ` AND ir.inspector_id = $${paramIndex}`;
      params.push(inspectorId);
      paramIndex++;
    }

    if (initiatorId) {
      sql += ` AND ir.initiator_id = $${paramIndex}`;
      params.push(initiatorId);
      paramIndex++;
    }

    if (type) {
      sql += ` AND ir.inspection_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (search) {
      sql += ` AND (ir.request_number ILIKE $${paramIndex} OR ir.title ILIKE $${paramIndex} OR ir.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (fromDate) {
      sql += ` AND ir.created_at >= $${paramIndex}`;
      params.push(fromDate);
      paramIndex++;
    }

    if (toDate) {
      sql += ` AND ir.created_at <= $${paramIndex}`;
      params.push(toDate);
      paramIndex++;
    }

    sql += ' ORDER BY ir.created_at DESC';

    const result = await query(sql, params);

    return NextResponse.json({ requests: result.rows });
  } catch (error) {
    console.error('Error fetching inspection requests:', error);
    return NextResponse.json({ error: 'Failed to fetch inspection requests' }, { status: 500 });
  }
}

// POST create new inspection request
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userId = parseInt((session.user as any).id);

    if (!hasPermission(userRole, 'inspection_request', 'create')) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const saveAsDraft = body.save_as_draft === true;
    const {
      title, description, inspection_type, due_date, scheduled_date, request_date,
      project_id, subsystem_id, lru_id, sru_id,
      item_pertains_to, test_type,
      item_pertains_to_other, test_type_other,
      so_details, delivery_period, source, oem_name,
      lru_nomenclature, criticality, part_number, serial_number,
      quantity, quantity_per_set,
      previous_stage_cleared, logbook_attached, inspection_stage, inspection_mode,
      inspection_datetime, inspection_date_from, inspection_date_to, venue,
      document_details, confirmations,
      designer_rep_name, designer_rep_designation, designer_rep_contact, design_coordinator_name,
      certified_by_name, certified_by_designation,
      nominated_request_approver_id: bodyNominatedRa,
    } = body;

    let nominatedRequestApproverId: number | null = null;
    if (bodyNominatedRa != null && bodyNominatedRa !== '') {
      const nid = parseInt(String(bodyNominatedRa), 10);
      if (!Number.isFinite(nid) || nid < 1) {
        return NextResponse.json({ error: 'Invalid nominated Request Approver' }, { status: 400 });
      }
      const appr = await query(
        `SELECT id FROM users WHERE id = $1 AND role = 'request_approver' AND COALESCE(status, 'active') = 'active'`,
        [nid]
      );
      if (appr.rows.length === 0) {
        return NextResponse.json(
          { error: 'Nominated Request Approver must be an active user with the Request Approver role' },
          { status: 400 }
        );
      }
      nominatedRequestApproverId = nid;
    }

    if (!saveAsDraft) {
      if (nominatedRequestApproverId == null) {
        return NextResponse.json(
          { error: '21. Designer DH/GD/TH Name (Certifier) is required' },
          { status: 400 }
        );
      }

      if (typeof certified_by_designation !== 'string' || !String(certified_by_designation).trim()) {
        return NextResponse.json(
          { error: '21. Designation is required' },
          { status: 400 }
        );
      }

      if (!project_id || !subsystem_id) {
        return NextResponse.json(
          { error: 'Programme/Project and Subsystem are required' },
          { status: 400 }
        );
      }

      const submissionDate = parsePart1RequestSubmissionDate(request_date);
      const advanceNoticeError = getPart1AdvanceNoticeValidationError(
        venue,
        inspection_date_from || inspection_datetime,
        submissionDate,
        request_date,
      );
      if (advanceNoticeError) {
        return NextResponse.json({ error: advanceNoticeError }, { status: 400 });
      }
    }

    if (saveAsDraft) {
      const existingDraft = await query(
        `SELECT id FROM inspection_requests WHERE initiator_id = $1 AND status = 'draft' ORDER BY updated_at DESC LIMIT 1`,
        [userId]
      );
      if (existingDraft.rows[0]?.id) {
        return NextResponse.json(
          {
            error: 'Draft already exists',
            draft_id: existingDraft.rows[0].id,
            use_put: true,
          },
          { status: 409 }
        );
      }
    }

    const srusPostCheck = await query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'srus') as exists`
    );
    const hasSrusPost = srusPostCheck.rows[0]?.exists;

    const requestNumberResult = await query('SELECT generate_inspection_request_number() as request_number');
    const requestNumber = requestNumberResult.rows[0].request_number;

    const autoTitle =
      title ||
      (saveAsDraft
        ? `Draft — ${lru_nomenclature || 'Inspection Request'}`
        : `Inspection - ${lru_nomenclature || 'LRU'}`);
    const autoLocation = venue || '';
    const autoItem = lru_nomenclature || '';
    const autoInspectionType = inspection_type || inspection_stage || '';
    const insertStatus = saveAsDraft ? 'draft' : 'pending';

    const insertColumns = `request_number, title, description, location, item, inspection_type, due_date,
        scheduled_date, request_date, initiator_id, status,
        project_id, subsystem_id, lru_id${hasSrusPost ? ', sru_id' : ''},
        item_pertains_to, test_type, item_pertains_to_other, test_type_other,
        so_details, delivery_period, source, oem_name,
        lru_nomenclature, criticality, part_number, serial_number,
        quantity, quantity_per_set,
        previous_stage_cleared, logbook_attached, inspection_stage, inspection_mode,
        inspection_datetime, inspection_date_from, inspection_date_to, venue,
        document_details, confirmations,
        designer_rep_name, designer_rep_designation, designer_rep_contact, design_coordinator_name,
        certified_by_name, certified_by_designation, nominated_request_approver_id`;

    const insertValues = hasSrusPost
      ? '$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46'
      : '$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45';

    const insertParams: any[] = [
      requestNumber, autoTitle, description || null, autoLocation, autoItem,
      autoInspectionType, due_date || null,
      scheduled_date || null, toPart1RequestDateYmd(request_date),
      userId, insertStatus,
      project_id || null, subsystem_id || null, lru_id || null,
    ];
    if (hasSrusPost) insertParams.push(sru_id || null);
    insertParams.push(
      item_pertains_to ? JSON.stringify(item_pertains_to) : null,
      test_type ? JSON.stringify(test_type) : null,
      typeof item_pertains_to_other === 'string' ? item_pertains_to_other.trim() || null : null,
      typeof test_type_other === 'string' ? test_type_other.trim() || null : null,
      so_details || null, delivery_period || null, source || null, oem_name || null,
      lru_nomenclature || null,
      criticality ? JSON.stringify(criticality) : null,
      part_number || null, serial_number || null,
      quantity || null, quantity_per_set || null,
      previous_stage_cleared || null, logbook_attached || null,
      inspection_stage || null, inspection_mode || null,
      inspection_datetime || null, inspection_date_from || null, inspection_date_to || null, venue || null,
      document_details ? JSON.stringify(document_details) : null,
      confirmations ? JSON.stringify(confirmations) : null,
      designer_rep_name || null, designer_rep_designation || null,
      designer_rep_contact || null, design_coordinator_name || null,
      certified_by_name || null, certified_by_designation || null,
      nominatedRequestApproverId,
    );

    const result = await query(
      `INSERT INTO inspection_requests (${insertColumns}) VALUES (${insertValues}) RETURNING *`,
      insertParams
    );

    const newRequest = result.rows[0];

    if (!saveAsDraft) {
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'CREATE', 'inspection_request', newRequest.id, JSON.stringify(newRequest)]
      );

      await notifyInspectionRequestSubmitted(
        newRequest.id,
        newRequest.request_number,
        userId,
        nominatedRequestApproverId!
      );

      await query(
        `INSERT INTO inspection_activities (inspection_request_id, activity_type, description, user_id) VALUES ($1, $2, $3, $4)`,
        [newRequest.id, 'created', `Inspection Request ${newRequest.request_number} created`, userId]
      );
    } else {
      await query(
        `INSERT INTO inspection_activities (inspection_request_id, activity_type, description, user_id) VALUES ($1, $2, $3, $4)`,
        [newRequest.id, 'draft_saved', `Draft ${newRequest.request_number} started`, userId]
      );
    }

    return NextResponse.json({ request: newRequest }, { status: 201 });
  } catch (error) {
    console.error('Error creating inspection request:', error);
    return NextResponse.json({ error: 'Failed to create inspection request' }, { status: 500 });
  }
}
