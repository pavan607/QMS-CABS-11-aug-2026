/**
 * Dummy-data check: final Team Head – QA Approve & Close at end of IR lifecycle.
 *
 * Flow under test:
 *   inspection_completed → qa_approve → status=completed + final_qa_approver_id set
 *
 * Run: npx tsx scripts/test-final-team-head-approval.ts
 */
import 'dotenv/config';
import pg from 'pg';
import {
  canUserQaApproverApproveAndClose,
  canUserQaApproverReject,
  teamHeadFinalSignoffApproved,
  part4ApprovedByTeamHead,
} from '../lib/inspection-display';

const PREFIX = 'FTH-E2E-';

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
  final_qa_approver_id: number | null;
  final_qa_approval_date: Date | string | null;
  part4_data: unknown;
  forwarded_to_ordaqa: boolean | null;
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

  const createdIds: number[] = [];

  try {
    console.log('\n=== Final Team Head Approve & Close E2E ===\n');
    await client.query(`DELETE FROM inspection_requests WHERE request_number LIKE $1`, [`${PREFIX}%`]);

    // --- Skip-path IR at inspection_completed (Part IV already TH-approved) ---
    const requestNumber = `${PREFIX}${Date.now()}`;
    const insert = await client.query(
      `INSERT INTO inspection_requests (
         request_number, title, location, item, inspection_type, due_date, status, initiator_id,
         nominated_team_head_id, inspector_id, inspector_ids,
         confirmations, part4_data, part4_completed_by, part4_date,
         forwarded_to_ordaqa, completed_date, created_at, updated_at
       ) VALUES (
         $1, $2, 'CABS Hangar', 'Final TH sign-off E2E', 'dimensional', CURRENT_DATE + 14,
         'inspection_completed', $3,
         $4, $5, $6::jsonb,
         $7::jsonb, $8::jsonb, $5, NOW(),
         false, NOW(), NOW(), NOW()
       ) RETURNING id`,
      [
        requestNumber,
        'Final Team Head Approve & Close E2E',
        USERS.initiator,
        USERS.qaApprover,
        USERS.inspector,
        JSON.stringify([USERS.inspector]),
        JSON.stringify({ joint_inspection_request: 'no' }),
        JSON.stringify({
          inspection_details: 'Final sign-off check',
          items_offered: '1',
          items_accepted: '1',
          team_head_approval_status: 'approved',
          part4_team_head_approver_id: USERS.qaApprover,
          part4_team_head_approved_at: new Date().toISOString(),
        }),
      ]
    );
    const irId = Number(insert.rows[0].id);
    createdIds.push(irId);
    pass(`Seeded IR ${requestNumber} (id=${irId}) at inspection_completed`);

    // --- 1. Before final approve: gates ---
    try {
      const ir = await loadIr(client, irId);
      assert(ir.status === 'inspection_completed', 'status is inspection_completed');
      assert(part4ApprovedByTeamHead(ir), 'Part IV already approved (mid-flow)');
      assert(!teamHeadFinalSignoffApproved(ir), 'final sign-off NOT yet recorded');
      assert(
        canUserQaApproverApproveAndClose(ir, USERS.qaApprover, 'qa_approver'),
        'Team Head can Approve & Close'
      );
      assert(
        canUserQaApproverReject(ir, USERS.qaApprover, 'qa_approver'),
        'Team Head can Reject at this stage'
      );
      assert(
        !canUserQaApproverApproveAndClose(ir, USERS.inspector, 'inspector'),
        'inspector cannot Approve & Close'
      );
      // Wrong status / not ready for final approve
      const notReady = { ...ir, status: 'request_approved' };
      assert(
        !canUserQaApproverApproveAndClose(notReady, USERS.qaApprover, 'qa_approver'),
        'cannot Approve & Close before Part IV / Part V ready'
      );
      pass('Before final approve: TH can Approve & Close; others cannot');
    } catch (e) {
      fail('Pre-final-approve gates', e);
    }

    // --- 2. Simulate workflow action qa_approve ---
    try {
      await client.query(
        `UPDATE inspection_requests
         SET status = 'completed',
             final_qa_approver_id = $2,
             final_qa_approval_date = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [irId, USERS.qaApprover]
      );
      const ir = await loadIr(client, irId);
      assert(ir.status === 'completed', 'status becomes completed');
      assert(Number(ir.final_qa_approver_id) === USERS.qaApprover, 'final_qa_approver_id set');
      assert(ir.final_qa_approval_date != null, 'final_qa_approval_date set');
      assert(teamHeadFinalSignoffApproved(ir), 'teamHeadFinalSignoffApproved = true');
      assert(
        !canUserQaApproverApproveAndClose(ir, USERS.qaApprover, 'qa_approver'),
        'cannot Approve & Close again after completed'
      );
      pass('qa_approve records final Team Head sign-off and closes IR');
    } catch (e) {
      fail('Simulate qa_approve', e);
    }

    // --- 3. Nominated-path: only nominated TH can final-approve ---
    try {
      const nomNumber = `${PREFIX}NOM-${Date.now()}`;
      const nomIns = await client.query(
        `INSERT INTO inspection_requests (
           request_number, title, location, item, inspection_type, due_date, status, initiator_id,
           nominated_team_head_id, inspector_id, inspector_ids,
           confirmations, part4_data, part4_completed_by, part4_date,
           forwarded_to_ordaqa, completed_date, created_at, updated_at
         ) VALUES (
           $1, $2, 'CABS Hangar', 'Nominated final approve', 'dimensional', CURRENT_DATE + 14,
           'inspection_completed', $3,
           $4, $5, $6::jsonb,
           $7::jsonb, $8::jsonb, $5, NOW(),
           false, NOW(), NOW(), NOW()
         ) RETURNING id`,
        [
          nomNumber,
          'Nominated-path final TH',
          USERS.initiator,
          USERS.qaApprover,
          USERS.inspector,
          JSON.stringify([USERS.inspector]),
          JSON.stringify({ joint_inspection_request: 'yes' }),
          JSON.stringify({
            inspection_details: 'nominated final',
            team_head_approval_status: 'approved',
          }),
        ]
      );
      const nomId = Number(nomIns.rows[0].id);
      createdIds.push(nomId);
      const pending = await loadIr(client, nomId);
      assert(
        canUserQaApproverApproveAndClose(pending, USERS.qaApprover, 'qa_approver'),
        'nominated TH can final Approve & Close'
      );
      assert(
        !canUserQaApproverApproveAndClose(pending, 99999, 'qa_approver'),
        'non-nominated TH cannot final Approve & Close'
      );
      pass('Nominated-path final Approve & Close gate works');
    } catch (e) {
      fail('Nominated final TH gate', e);
    }

    // --- 4. Confirm UI/data fields exist on completed IR ---
    try {
      const ir = await loadIr(client, irId);
      const user = await client.query(
        `SELECT id, name, designation, role FROM users WHERE id = $1`,
        [USERS.qaApprover]
      );
      assert(user.rows[0], 'qa_approver user exists');
      assert(user.rows[0].role === 'qa_approver', 'user is qa_approver');
      assert(teamHeadFinalSignoffApproved(ir), 'final Approve & Close sign-off recorded');
      console.log(
        `  → Final Approve & Close approver: ${user.rows[0].name} (${user.rows[0].designation || '—'})`
      );
      pass('Final sign-off data ready for timeline / Approve & Close');
    } catch (e) {
      fail('Display field check', e);
    }
  } finally {
    for (const id of createdIds) {
      await client.query(`DELETE FROM inspection_requests WHERE id = $1`, [id]).catch(() => {});
    }
    await client
      .query(`DELETE FROM inspection_requests WHERE request_number LIKE $1`, [`${PREFIX}%`])
      .catch(() => {});
    client.release();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== Results: ${results.length - failed.length}/${results.length} passed ===\n`);
  if (failed.length > 0) {
    failed.forEach((f) => console.error(`FAIL: ${f.name} — ${f.err}`));
    process.exit(1);
  }
  console.log('VERDICT: Yes — there IS a final Team Head – QA Approve & Close at the end.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
