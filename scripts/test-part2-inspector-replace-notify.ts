/**
 * Dummy-data check for Part II inspector assign + replace notifications.
 *
 * Run: npx tsx scripts/test-part2-inspector-replace-notify.ts
 */
import 'dotenv/config';
import pg from 'pg';
import {
  notifyInspectorsAssignedPart2,
  notifyInspectorsReassignedPart2,
} from '../lib/notifications';

const PREFIX = 'P2-INSP-NOTIFY-';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
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

  let requestId: number | null = null;
  let requestNumber = '';

  try {
    console.log('\n=== Part II Inspector Assign / Replace Notification E2E ===\n');

    const users = await client.query(
      `SELECT id, name, role FROM users
       WHERE COALESCE(status, 'active') = 'active'
         AND role IN ('inspector', 'initiator', 'qa_approver')
       ORDER BY role, id`
    );

    const inspectors = users.rows.filter((u: { role: string }) => u.role === 'inspector');
    const initiator = users.rows.find((u: { role: string }) => u.role === 'initiator');
    const teamHead = users.rows.find((u: { role: string }) => u.role === 'qa_approver');

    assert(inspectors.length >= 2, 'Need at least 2 active inspectors in DB');
    assert(initiator, 'Need an active initiator in DB');
    assert(teamHead, 'Need an active Team Head (qa_approver) in DB');

    const inspectorA = inspectors[0] as { id: number; name: string };
    const inspectorB = inspectors[1] as { id: number; name: string };
    const initiatorId = (initiator as { id: number }).id;
    const teamHeadName = (teamHead as { name: string }).name || 'Team Head – QA';

    console.log(`  Inspector A: ${inspectorA.name} (#${inspectorA.id})`);
    console.log(`  Inspector B: ${inspectorB.name} (#${inspectorB.id})`);
    console.log(`  Initiator:   #${initiatorId}`);
    console.log(`  Team Head:   ${teamHeadName}\n`);

    await client.query(`DELETE FROM inspection_requests WHERE request_number LIKE $1`, [`${PREFIX}%`]);

    requestNumber = `${PREFIX}${Date.now()}`;
    const insert = await client.query(
      `INSERT INTO inspection_requests (
         request_number, title, location, item, inspection_type, due_date, status,
         initiator_id, nominated_team_head_id,
         confirmations
       ) VALUES (
         $1, $2, 'CABS Hangar', 'Dummy flange — Part II notify test', 'dimensional', CURRENT_DATE + 14,
         'request_approved', $3, $4,
         $5::jsonb
       ) RETURNING id, request_number`,
      [
        requestNumber,
        'Part II inspector replace notification test',
        initiatorId,
        (teamHead as { id: number }).id,
        JSON.stringify({ joint_inspection_request: 'yes' }),
      ]
    );
    requestId = insert.rows[0].id as number;
    requestNumber = insert.rows[0].request_number as string;
    pass(`Seeded dummy IR ${requestNumber} (id=${requestId})`);

    // --- First assign (Complete Part II) ---
    await client.query(
      `UPDATE inspection_requests
       SET status = 'assigned', inspector_id = $2, inspector_ids = $3, updated_at = NOW()
       WHERE id = $1`,
      [requestId, inspectorA.id, JSON.stringify([inspectorA.id])]
    );

    await notifyInspectorsAssignedPart2(
      requestId,
      requestNumber,
      [inspectorA.id],
      initiatorId,
      teamHeadName
    );

    const assignNotifs = await client.query(
      `SELECT user_id, title, message, type
       FROM notifications
       WHERE entity_type = 'inspection_request' AND entity_id = $1
         AND type = 'part2_inspector_assigned'
       ORDER BY id`,
      [requestId]
    );

    try {
      assert(
        assignNotifs.rows.some(
          (n: { user_id: number; type: string }) =>
            n.user_id === inspectorA.id && n.type === 'part2_inspector_assigned'
        ),
        'Inspector A should get part2_inspector_assigned'
      );
      assert(
        assignNotifs.rows.some(
          (n: { user_id: number; message: string }) =>
            n.user_id === initiatorId &&
            String(n.message).includes(inspectorA.name)
        ),
        'Initiator should be notified of initial assignment with inspector name'
      );
      pass('Complete Part II: assign notifications sent to inspector + initiator');
    } catch (e) {
      fail('Complete Part II: assign notifications', e);
    }

    // --- Replace inspector A with inspector B ---
    await client.query(
      `UPDATE inspection_requests
       SET inspector_id = $2, inspector_ids = $3, updated_at = NOW()
       WHERE id = $1`,
      [requestId, inspectorB.id, JSON.stringify([inspectorB.id])]
    );

    await notifyInspectorsReassignedPart2(
      requestId,
      requestNumber,
      [inspectorA.id],
      [inspectorB.id],
      initiatorId,
      teamHeadName
    );

    const replaceNotifs = await client.query(
      `SELECT user_id, title, message, type
       FROM notifications
       WHERE entity_type = 'inspection_request' AND entity_id = $1
         AND type = 'part2_inspector_replaced'
       ORDER BY id`,
      [requestId]
    );

    try {
      const removedNotif = replaceNotifs.rows.find(
        (n: { user_id: number }) => n.user_id === inspectorA.id
      );
      assert(removedNotif, 'Removed inspector A should get replacement notification');
      assert(
        String(removedNotif.message).includes('replaced with') &&
          String(removedNotif.message).includes(inspectorB.name),
        `Removed message should say replaced with ${inspectorB.name}. Got: ${removedNotif.message}`
      );
      pass('Removed inspector notified: replaced with new inspector');
    } catch (e) {
      fail('Removed inspector replacement notification', e);
    }

    try {
      const addedNotif = replaceNotifs.rows.find(
        (n: { user_id: number }) => n.user_id === inspectorB.id
      );
      assert(addedNotif, 'New inspector B should get replacement/assignment notification');
      assert(
        String(addedNotif.message).includes('replaced with you') ||
          String(addedNotif.message).includes(inspectorA.name),
        `New inspector message should mention replacement. Got: ${addedNotif.message}`
      );
      pass('New inspector notified of replacement assignment');
    } catch (e) {
      fail('New inspector replacement notification', e);
    }

    try {
      const initiatorNotif = replaceNotifs.rows.find(
        (n: { user_id: number }) => n.user_id === initiatorId
      );
      assert(initiatorNotif, 'Initiator should get replacement notification');
      assert(
        String(initiatorNotif.message).includes(inspectorA.name) &&
          String(initiatorNotif.message).includes('replaced with') &&
          String(initiatorNotif.message).includes(inspectorB.name),
        `Initiator message should say "${inspectorA.name} has been replaced with ${inspectorB.name}". Got: ${initiatorNotif.message}`
      );
      pass(
        `Initiator notified: ${inspectorA.name} has been replaced with ${inspectorB.name}`
      );
    } catch (e) {
      fail('Initiator replacement notification', e);
    }

    // --- No-op reassignment (same inspector) should create no new replaced notifs ---
    const beforeCount = replaceNotifs.rows.length;
    await notifyInspectorsReassignedPart2(
      requestId,
      requestNumber,
      [inspectorB.id],
      [inspectorB.id],
      initiatorId,
      teamHeadName
    );
    const afterNoop = await client.query(
      `SELECT COUNT(*)::int AS c FROM notifications
       WHERE entity_type = 'inspection_request' AND entity_id = $1
         AND type = 'part2_inspector_replaced'`,
      [requestId]
    );
    try {
      assert(
        afterNoop.rows[0].c === beforeCount,
        'Same-inspector reassignment should not create extra notifications'
      );
      pass('Same-inspector update creates no extra notifications');
    } catch (e) {
      fail('No-op reassignment check', e);
    }

    console.log('\n--- Sample replacement messages ---');
    for (const n of replaceNotifs.rows as Array<{
      user_id: number;
      title: string;
      message: string;
    }>) {
      const who =
        n.user_id === inspectorA.id
          ? 'Inspector A (removed)'
          : n.user_id === inspectorB.id
            ? 'Inspector B (new)'
            : n.user_id === initiatorId
              ? 'Initiator'
              : `user #${n.user_id}`;
      console.log(`  [${who}] ${n.title}`);
      console.log(`    ${n.message}`);
    }
  } finally {
    if (requestId != null) {
      await client.query(`DELETE FROM notifications WHERE entity_type = 'inspection_request' AND entity_id = $1`, [
        requestId,
      ]);
      await client.query(`DELETE FROM inspection_requests WHERE id = $1`, [requestId]);
      console.log(`\n  Cleaned up dummy IR #${requestId} and its notifications`);
    }
    client.release();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== Results: ${results.length - failed.length}/${results.length} passed ===\n`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
