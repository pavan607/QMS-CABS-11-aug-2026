/**
 * End-to-end Part IV Team Head – QA approve / reject / resubmit flow (dummy data).
 *
 * Run: npx tsx scripts/test-part4-team-head-approval.ts
 */
import 'dotenv/config';
import pg from 'pg';
import {
  canUserUpdatePart4,
  canUserApprovePart4,
  canUserRejectPart4,
  canUserStartInspection,
  part4PendingTeamHeadApproval,
  part4ApprovedByTeamHead,
  part4RejectedByTeamHead,
  getPart4TeamHeadRejectComment,
  inspectionReadyToStart,
} from '../lib/inspection-display';

const PREFIX = 'P4TH-E2E-';

const USERS = {
  initiator: 79,
  qaApprover: 164,
  inspector: 166,
};

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

type IrRow = {
  id: number;
  request_number: string;
  status: string;
  confirmations: unknown;
  nominated_team_head_id: number | null;
  inspector_id: number | null;
  inspector_ids: unknown;
  part4_data: unknown;
  part3_data: unknown;
  forwarded_to_ordaqa: boolean | null;
  ordaqa_approver_id: number | null;
  ordaqa_inspector_id: number | null;
};

async function loadIr(client: pg.PoolClient, id: number): Promise<IrRow> {
  const r = await client.query(`SELECT * FROM inspection_requests WHERE id = $1`, [id]);
  assert(r.rows[0], `IR ${id} not found`);
  return r.rows[0] as IrRow;
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const results: Array<{ name: string; ok: boolean; err?: string }> = [];
  const pass = (name: string) => {
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  };
  const fail = (name: string, err: unknown) => {
    results.push({ name, ok: false, err: String(err) });
    console.error(`  ✗ ${name}: ${err}`);
  };

  let irId = 0;

  try {
    console.log('\n=== Part IV Team Head Approval E2E ===\n');
    await client.query(`DELETE FROM inspection_requests WHERE request_number LIKE $1`, [`${PREFIX}%`]);

    const requestNumber = `${PREFIX}${Date.now()}`;
    const insert = await client.query(
      `INSERT INTO inspection_requests (
         request_number, title, location, item, inspection_type, due_date, status, initiator_id,
         nominated_team_head_id, inspector_id, inspector_ids,
         confirmations, forwarded_to_ordaqa,
         created_at, updated_at
       ) VALUES (
         $1, $2, 'CABS Hangar', 'Flange Assy — P4 TH E2E', 'dimensional', CURRENT_DATE + 14, 'assigned', $3,
         $4, $5, $6::jsonb,
         $7::jsonb, false,
         NOW(), NOW()
       ) RETURNING id`,
      [
        requestNumber,
        'Part IV TH approval E2E',
        USERS.initiator,
        USERS.qaApprover,
        USERS.inspector,
        JSON.stringify([USERS.inspector]),
        // Skip Parts II–III so Start Inspection only needs Part IV TH approval
        JSON.stringify({ joint_inspection_request: 'no' }),
      ]
    );
    irId = Number(insert.rows[0].id);
    pass(`Seeded IR ${requestNumber} (id=${irId})`);

    // --- 1. Inspector can edit before submit ---
    try {
      let ir = await loadIr(client, irId);
      assert(
        canUserUpdatePart4(ir, USERS.inspector, 'inspector'),
        'inspector should edit Part IV before submit'
      );
      assert(!canUserApprovePart4(ir, USERS.qaApprover, 'qa_approver'), 'TH cannot approve yet');
      pass('Inspector can edit; TH cannot approve before submit');
    } catch (e) {
      fail('Pre-submit permissions', e);
    }

    // --- 2. Simulate save_part4 → pending ---
    try {
      const part4Payload = {
        inspection_details: 'Dimensional check of flange assembly',
        items_offered: '2',
        items_accepted: '2',
        verification_logbook: 'yes',
        instruments_calibration: 'within cal',
        logbook_copy_attached: 'no',
        inspection_status: 'completed',
        per_guiding_checklist: 'yes',
        part4_remarks: [],
        team_head_approval_status: 'pending',
        part4_return_history: [],
      };
      await client.query(
        `UPDATE inspection_requests
         SET part4_data = $2::jsonb, part4_completed_by = $3, part4_date = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [irId, JSON.stringify(part4Payload), USERS.inspector]
      );
      const ir = await loadIr(client, irId);
      assert(part4PendingTeamHeadApproval(ir), 'status should be pending');
      assert(!part4ApprovedByTeamHead(ir), 'not approved yet');
      assert(
        !canUserUpdatePart4(ir, USERS.inspector, 'inspector'),
        'inspector locked while pending'
      );
      assert(
        canUserApprovePart4(ir, USERS.qaApprover, 'qa_approver'),
        'R&QA TH can approve on skip-path'
      );
      assert(
        canUserRejectPart4(ir, USERS.qaApprover, 'qa_approver'),
        'R&QA TH can reject on skip-path'
      );
      assert(
        !canUserApprovePart4(ir, USERS.inspector, 'inspector'),
        'inspector role cannot approve Part IV'
      );
      assert(!canUserStartInspection(ir, USERS.inspector, 'inspector'), 'cannot start while pending');
      assert(!inspectionReadyToStart(ir), 'not ready to start while pending');
      pass('After submit: pending locks inspector; TH can approve/reject');
    } catch (e) {
      fail('After submit pending state', e);
    }

    // --- 3. Simulate reject_part4 ---
    try {
      const irBefore = await loadIr(client, irId);
      const p4 = typeof irBefore.part4_data === 'string'
        ? JSON.parse(irBefore.part4_data)
        : { ...(irBefore.part4_data as object) };
      const rejectComment = 'Observation table incomplete — add dimensional deviation details.';
      const rejected = {
        ...p4,
        team_head_approval_status: 'rejected',
        part4_team_head_reject_comment: rejectComment,
        part4_team_head_rejected_at: new Date().toISOString(),
        part4_team_head_rejected_by: USERS.qaApprover,
        part4_return_history: [
          {
            at: new Date().toISOString(),
            by_user_id: USERS.qaApprover,
            role: 'reject_part4',
            comments: rejectComment,
          },
        ],
      };
      delete rejected.part4_team_head_approver_id;
      delete rejected.part4_team_head_approved_at;
      await client.query(
        `UPDATE inspection_requests SET part4_data = $2::jsonb, updated_at = NOW() WHERE id = $1`,
        [irId, JSON.stringify(rejected)]
      );
      const ir = await loadIr(client, irId);
      assert(part4RejectedByTeamHead(ir), 'should be rejected');
      assert(!part4PendingTeamHeadApproval(ir), 'not pending after reject');
      assert(!part4ApprovedByTeamHead(ir), 'not approved after reject');
      assert(getPart4TeamHeadRejectComment(ir) === rejectComment, 'reject comment stored');
      assert(
        canUserUpdatePart4(ir, USERS.inspector, 'inspector'),
        'inspector can edit after reject'
      );
      assert(
        !canUserApprovePart4(ir, USERS.qaApprover, 'qa_approver'),
        'TH cannot approve while rejected (must wait for resubmit)'
      );
      pass('Reject unlocks inspector and stores comments');
    } catch (e) {
      fail('Reject Part IV', e);
    }

    // --- 4. Resubmit → pending again ---
    try {
      const irBefore = await loadIr(client, irId);
      const p4 = typeof irBefore.part4_data === 'string'
        ? JSON.parse(irBefore.part4_data)
        : { ...(irBefore.part4_data as object) };
      const history = Array.isArray(p4.part4_return_history) ? p4.part4_return_history : [];
      const resubmitted = {
        ...p4,
        inspection_details: 'Dimensional check — revised with deviation details',
        team_head_approval_status: 'pending',
        part4_return_history: history,
      };
      delete resubmitted.part4_team_head_reject_comment;
      delete resubmitted.part4_team_head_rejected_at;
      delete resubmitted.part4_team_head_rejected_by;
      await client.query(
        `UPDATE inspection_requests
         SET part4_data = $2::jsonb, part4_completed_by = $3, part4_date = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [irId, JSON.stringify(resubmitted), USERS.inspector]
      );
      const ir = await loadIr(client, irId);
      assert(part4PendingTeamHeadApproval(ir), 'pending after resubmit');
      assert(
        !canUserUpdatePart4(ir, USERS.inspector, 'inspector'),
        'locked again after resubmit'
      );
      assert(
        canUserApprovePart4(ir, USERS.qaApprover, 'qa_approver'),
        'TH can approve after resubmit'
      );
      pass('Resubmit returns to pending approval');
    } catch (e) {
      fail('Resubmit Part IV', e);
    }

    // --- 5. Approve → ready for start (non-ORDAQA path) ---
    try {
      const irBefore = await loadIr(client, irId);
      const p4 = typeof irBefore.part4_data === 'string'
        ? JSON.parse(irBefore.part4_data)
        : { ...(irBefore.part4_data as object) };
      const approved = {
        ...p4,
        team_head_approval_status: 'approved',
        part4_team_head_approver_id: USERS.qaApprover,
        part4_team_head_approved_at: new Date().toISOString(),
      };
      delete approved.part4_team_head_reject_comment;
      delete approved.part4_team_head_rejected_at;
      delete approved.part4_team_head_rejected_by;
      await client.query(
        `UPDATE inspection_requests SET part4_data = $2::jsonb, updated_at = NOW() WHERE id = $1`,
        [irId, JSON.stringify(approved)]
      );
      const ir = await loadIr(client, irId);
      assert(part4ApprovedByTeamHead(ir), 'approved');
      assert(!part4PendingTeamHeadApproval(ir), 'not pending');
      assert(
        !canUserUpdatePart4(ir, USERS.inspector, 'inspector'),
        'locked after approve'
      );
      assert(
        !canUserApprovePart4(ir, USERS.qaApprover, 'qa_approver'),
        'cannot approve twice'
      );
      assert(inspectionReadyToStart(ir), 'ready to start after Part IV TH approval');
      assert(
        canUserStartInspection(ir, USERS.inspector, 'inspector'),
        'inspector can start after TH approval'
      );
      pass('Approve unlocks Start Inspection');
    } catch (e) {
      fail('Approve Part IV', e);
    }

    // --- 6. Legacy IR (no status field) still treated as approved for gates ---
    try {
      const legacyNumber = `${PREFIX}LEGACY-${Date.now()}`;
      const legacyIns = await client.query(
        `INSERT INTO inspection_requests (
           request_number, title, location, item, inspection_type, due_date, status, initiator_id,
           nominated_team_head_id, inspector_id, inspector_ids,
           confirmations, part4_data, part4_completed_by, part4_date,
           forwarded_to_ordaqa, created_at, updated_at
         ) VALUES (
           $1, $2, 'CABS Hangar', 'Legacy item', 'dimensional', CURRENT_DATE + 14, 'assigned', $3,
           $4, $5, $6::jsonb,
           $7::jsonb, $8::jsonb, $5, NOW(),
           false, NOW(), NOW()
         ) RETURNING id`,
        [
          legacyNumber,
          'Legacy Part IV (no TH status)',
          USERS.initiator,
          USERS.qaApprover,
          USERS.inspector,
          JSON.stringify([USERS.inspector]),
          JSON.stringify({ joint_inspection_request: 'no' }),
          JSON.stringify({ inspection_details: 'legacy', items_offered: '1' }),
        ]
      );
      const legacyId = Number(legacyIns.rows[0].id);
      const ir = await loadIr(client, legacyId);
      assert(part4ApprovedByTeamHead(ir), 'legacy without status = approved for gates');
      assert(inspectionReadyToStart(ir), 'legacy ready to start');
      assert(
        canUserUpdatePart4(ir, USERS.inspector, 'inspector'),
        'legacy still editable until explicit approve/pending'
      );
      await client.query(`DELETE FROM inspection_requests WHERE id = $1`, [legacyId]);
      pass('Legacy Part IV without status remains usable');
    } catch (e) {
      fail('Legacy compatibility', e);
    }

    // --- 7. Nominated-path: only nominated TH can approve ---
    try {
      const nomNumber = `${PREFIX}NOM-${Date.now()}`;
      const nomIns = await client.query(
        `INSERT INTO inspection_requests (
           request_number, title, location, item, inspection_type, due_date, status, initiator_id,
           nominated_team_head_id, inspector_id, inspector_ids,
           confirmations, part4_data, part4_completed_by, part4_date,
           forwarded_to_ordaqa, created_at, updated_at
         ) VALUES (
           $1, $2, 'CABS Hangar', 'Nominated path item', 'dimensional', CURRENT_DATE + 14, 'assigned', $3,
           $4, $5, $6::jsonb,
           $7::jsonb, $8::jsonb, $5, NOW(),
           false, NOW(), NOW()
         ) RETURNING id`,
        [
          nomNumber,
          'Nominated TH Part IV gate',
          USERS.initiator,
          USERS.qaApprover,
          USERS.inspector,
          JSON.stringify([USERS.inspector]),
          JSON.stringify({ joint_inspection_request: 'yes' }),
          JSON.stringify({
            inspection_details: 'nominated path',
            team_head_approval_status: 'pending',
          }),
        ]
      );
      const nomId = Number(nomIns.rows[0].id);
      const pending = await loadIr(client, nomId);
      assert(
        canUserApprovePart4(pending, USERS.qaApprover, 'qa_approver'),
        'nominated TH can approve'
      );
      assert(
        !canUserApprovePart4(pending, 99999, 'qa_approver'),
        'non-nominated TH id cannot approve'
      );
      await client.query(`DELETE FROM inspection_requests WHERE id = $1`, [nomId]);
      pass('Nominated-path Team Head gate works');
    } catch (e) {
      fail('Nominated TH gate', e);
    }
  } finally {
    if (irId > 0) {
      await client.query(`DELETE FROM inspection_requests WHERE id = $1`, [irId]).catch(() => {});
    }
    await client.query(`DELETE FROM inspection_requests WHERE request_number LIKE $1`, [`${PREFIX}%`]).catch(() => {});
    client.release();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== Results: ${results.length - failed.length}/${results.length} passed ===\n`);
  if (failed.length > 0) {
    failed.forEach((f) => console.error(`FAIL: ${f.name} — ${f.err}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
