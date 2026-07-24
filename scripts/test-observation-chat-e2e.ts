/**
 * Seed an end-to-end observation-chat test IR and exercise auto-send,
 * visibility, reply permissions, and close.
 *
 * Run: npx tsx scripts/test-observation-chat-e2e.ts
 */
import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'crypto';
import {
  ensureObservationChatTables,
  autoSendObservationsFromRemarks,
  listObservationThreadsForUser,
  canAccessObservationChat,
  canReplyObservationChat,
  canCloseObservationChat,
  sendObservationMessage,
  closeObservationThread,
  fetchInspectionForChatAccess,
  getObservationMessages,
} from '../lib/observation-chats';

const PREFIX = 'OBS-E2E-';

const USERS = {
  initiator: 79,
  requestApprover: 78,
  qaHead: 163,
  qaApprover: 164,
  inspector: 166,
  ordaqaHead: 234,
  ordaqaInspector: 235,
};

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

  try {
    console.log('\n=== Observation Chat E2E ===\n');
    await ensureObservationChatTables();
    await client.query(`DELETE FROM inspection_requests WHERE request_number LIKE $1`, [`${PREFIX}%`]);

    const part4ChatId = randomUUID();
    const part5ChatId = randomUUID();
    const requestNumber = `${PREFIX}${Date.now()}`;

    const part4Remarks = [
      {
        sl_no: '1',
        observation: 'E2E Part IV observation — dimensional deviation on flange',
        action_required: 'Rework and re-offer for inspection',
        chat_id: part4ChatId,
      },
    ];
    const part5Remarks = [
      {
        sl_no: '1',
        observation: 'E2E Part V observation — documentation incomplete',
        action_required: 'Submit missing CoC copies',
        chat_id: part5ChatId,
      },
    ];

    const insert = await client.query(
      `INSERT INTO inspection_requests (
         request_number, title, location, item, inspection_type, due_date, status, initiator_id,
         nominated_request_approver_id, request_approver_id,
         nominated_team_head_id, final_qa_approver_id,
         inspector_id, inspector_ids,
         forwarded_to_ordaqa, ordaqa_inspector_id,
         confirmations, part4_data, part3_data,
         part4_completed_by, part4_date, part3_completed_by, part3_date
       ) VALUES (
         $1, $2, 'CABS Hangar', 'Flange Assy — E2E', 'dimensional', CURRENT_DATE + 14, 'assigned', $3,
         $4, $4,
         $5, $5,
         $6, $7,
         true, $8,
         $9::jsonb, $10::jsonb, $11::jsonb,
         $6, NOW(), $8, NOW()
       ) RETURNING id, request_number`,
      [
        requestNumber,
        'E2E Observation Chat Test IR',
        USERS.initiator,
        USERS.requestApprover,
        USERS.qaApprover,
        USERS.inspector,
        JSON.stringify([USERS.inspector]),
        USERS.ordaqaInspector,
        JSON.stringify({
          cocs_available: 'yes',
          logbook_updated: 'yes',
          instruments_available: 'yes',
          approved_docs_available: 'yes',
          joint_inspection_request: 'yes',
          previous_observations_status: 'closed',
        }),
        JSON.stringify({ part4_remarks: part4Remarks }),
        JSON.stringify({
          inspection_remarks: part5Remarks,
          ordaqa_sections_24_25_submitted: true,
        }),
      ]
    );

    const irId = Number(insert.rows[0].id);
    console.log(`Seeded IR ${insert.rows[0].request_number} (id=${irId})\n`);

    try {
      const sent4 = await autoSendObservationsFromRemarks({
        inspectionRequestId: irId,
        part: 'part4',
        remarks: part4Remarks,
        senderId: USERS.inspector,
      });
      assert(sent4.sent.length === 1, `expected 1 part4 sent, got ${sent4.sent.length}`);
      assert(sent4.sent[0].thread.sent_to_initiator_at, 'part4 thread should be marked sent');
      pass('Part IV auto-send creates and sends observation');
    } catch (e) {
      fail('Part IV auto-send creates and sends observation', e);
    }

    try {
      const again = await autoSendObservationsFromRemarks({
        inspectionRequestId: irId,
        part: 'part4',
        remarks: part4Remarks,
        senderId: USERS.inspector,
      });
      assert(again.sent.length === 0, 're-save should not re-send');
      pass('Part IV re-save is idempotent (no duplicate send)');
    } catch (e) {
      fail('Part IV re-save is idempotent (no duplicate send)', e);
    }

    try {
      const sent5 = await autoSendObservationsFromRemarks({
        inspectionRequestId: irId,
        part: 'part5',
        remarks: part5Remarks,
        senderId: USERS.ordaqaInspector,
      });
      assert(sent5.sent.length === 1, `expected 1 part5 sent, got ${sent5.sent.length}`);
      pass('Part V auto-send creates and sends observation');
    } catch (e) {
      fail('Part V auto-send creates and sends observation', e);
    }

    const ir = await fetchInspectionForChatAccess(irId);
    assert(ir, 'IR loaded');

    const visibilityChecks: Array<[string, number, string]> = [
      ['initiator', USERS.initiator, 'initiator'],
      ['request_approver', USERS.requestApprover, 'request_approver'],
      ['qa_approver', USERS.qaApprover, 'qa_approver'],
      ['qa_head', USERS.qaHead, 'qa_head'],
      ['inspector', USERS.inspector, 'inspector'],
      ['ordaqa_inspector', USERS.ordaqaInspector, 'ordaqa_inspector'],
      ['ordaqa_head', USERS.ordaqaHead, 'ordaqa_head'],
    ];

    for (const [label, userId, role] of visibilityChecks) {
      try {
        const allowed = await canAccessObservationChat(userId, role, ir);
        assert(allowed, `${label} should access`);
        const threads = await listObservationThreadsForUser(userId, role, { excludeClosed: true });
        const mine = threads.filter((t) => Number(t.inspection_request_id) === irId);
        assert(mine.length >= 2, `${label} should see both threads, saw ${mine.length}`);
        pass(`${label} can view observation chats on dashboard`);
      } catch (e) {
        fail(`${label} can view observation chats on dashboard`, e);
      }
    }

    try {
      const otherInitiator = 80;
      const threads = await listObservationThreadsForUser(otherInitiator, 'initiator', {
        excludeClosed: true,
      });
      const mine = threads.filter((t) => Number(t.inspection_request_id) === irId);
      assert(mine.length === 0, 'unrelated initiator must not see threads');
      pass('Unrelated initiator cannot see observation chats');
    } catch (e) {
      fail('Unrelated initiator cannot see observation chats', e);
    }

    try {
      const part4Thread = (
        await listObservationThreadsForUser(USERS.initiator, 'initiator')
      ).find((t) => t.observation_key === part4ChatId);
      assert(part4Thread, 'part4 thread found');

      assert(
        await canReplyObservationChat(USERS.initiator, 'initiator', 'part4', ir),
        'initiator can reply'
      );
      assert(
        await canReplyObservationChat(USERS.inspector, 'inspector', 'part4', ir),
        'R&QA inspector can reply part4'
      );
      assert(
        !(await canReplyObservationChat(USERS.requestApprover, 'request_approver', 'part4', ir)),
        'request approver cannot reply'
      );
      assert(
        !(await canReplyObservationChat(USERS.qaApprover, 'qa_approver', 'part4', ir)),
        'qa approver cannot reply'
      );
      assert(
        !(await canReplyObservationChat(USERS.qaHead, 'qa_head', 'part4', ir)),
        'qa head cannot reply'
      );
      assert(
        await canReplyObservationChat(USERS.ordaqaInspector, 'ordaqa_inspector', 'part5', ir),
        'DGAQA inspector can reply part5'
      );
      assert(
        !(await canReplyObservationChat(USERS.ordaqaInspector, 'ordaqa_inspector', 'part4', ir)),
        'DGAQA inspector cannot reply to part4'
      );
      pass('Reply permissions: initiator + inspectors only; others read-only');

      await sendObservationMessage(
        part4Thread.id,
        USERS.initiator,
        'Initiator reply: rework planned for Friday'
      );
      await sendObservationMessage(
        part4Thread.id,
        USERS.inspector,
        'R&QA reply: please attach photos after rework'
      );
      const msgs = await getObservationMessages(part4Thread.id);
      assert(msgs.length >= 3, `expected opening + 2 replies, got ${msgs.length}`);
      pass('Initiator and R&QA inspector can exchange replies');
    } catch (e) {
      fail('Reply flow', e);
    }

    try {
      const part4Thread = (
        await listObservationThreadsForUser(USERS.inspector, 'inspector')
      ).find((t) => t.observation_key === part4ChatId);
      assert(part4Thread, 'part4 thread for close');
      assert(
        await canCloseObservationChat(USERS.inspector, 'inspector', 'part4', ir),
        'inspector can close'
      );
      assert(
        !(await canCloseObservationChat(USERS.initiator, 'initiator', 'part4', ir)),
        'initiator cannot close'
      );
      const closed = await closeObservationThread(part4Thread.id, USERS.inspector);
      assert(closed.is_closed, 'thread closed');
      let blocked = false;
      try {
        await sendObservationMessage(part4Thread.id, USERS.initiator, 'should fail');
      } catch {
        blocked = true;
      }
      assert(blocked, 'message after close should throw');
      pass('Inspector can close; chat locked after close');
    } catch (e) {
      fail('Inspector can close; chat locked after close', e);
    }

    const failed = results.filter((r) => !r.ok);
    console.log(`\n=== Results: ${results.length - failed.length}/${results.length} passed ===\n`);
    if (failed.length) process.exitCode = 1;
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
