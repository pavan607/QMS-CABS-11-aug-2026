/**
 * Backfill observation threads for IRs that have remarks but empty chat_id /
 * missing sent threads (e.g. IR-JUL-007).
 *
 * Run: npx tsx scripts/backfill-observation-chats.ts
 */
import 'dotenv/config';
import pg from 'pg';
import {
  autoSendObservationsFromRemarks,
  ensureObservationChatTables,
} from '../lib/observation-chats';

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await ensureObservationChatTables();

  const irs = await pool.query(`
    SELECT id, request_number, part4_data, part3_data,
           COALESCE(part4_completed_by, inspector_id, initiator_id) AS sender_guess,
           ordaqa_inspector_id
    FROM inspection_requests
    WHERE part4_data IS NOT NULL OR part3_data IS NOT NULL
    ORDER BY id
  `);

  let fixed = 0;
  for (const ir of irs.rows) {
    const irId = Number(ir.id);
    const p4 = typeof ir.part4_data === 'string' ? JSON.parse(ir.part4_data) : ir.part4_data;
    const p3 = typeof ir.part3_data === 'string' ? JSON.parse(ir.part3_data) : ir.part3_data;

    if (p4 && Array.isArray(p4.part4_remarks) && p4.part4_remarks.some((r: any) => String(r?.observation || '').trim())) {
      const senderId = Number(ir.sender_guess) || 0;
      if (senderId > 0) {
        const { sent, remarks } = await autoSendObservationsFromRemarks({
          inspectionRequestId: irId,
          part: 'part4',
          remarks: p4.part4_remarks,
          senderId,
        });
        // Persist generated chat_ids
        const next = { ...p4, part4_remarks: remarks };
        await pool.query(`UPDATE inspection_requests SET part4_data = $2, updated_at = NOW() WHERE id = $1`, [
          irId,
          JSON.stringify(next),
        ]);
        if (sent.length > 0) {
          console.log(`  ${ir.request_number}: auto-sent ${sent.length} Part IV observation(s)`);
          fixed += sent.length;
        }
      }
    }

    if (p3 && Array.isArray(p3.inspection_remarks) && p3.inspection_remarks.some((r: any) => String(r?.observation || '').trim())) {
      const senderId = Number(ir.ordaqa_inspector_id || ir.sender_guess) || 0;
      if (senderId > 0) {
        const { sent, remarks } = await autoSendObservationsFromRemarks({
          inspectionRequestId: irId,
          part: 'part5',
          remarks: p3.inspection_remarks,
          senderId,
        });
        const next = { ...p3, inspection_remarks: remarks };
        await pool.query(`UPDATE inspection_requests SET part3_data = $2, updated_at = NOW() WHERE id = $1`, [
          irId,
          JSON.stringify(next),
        ]);
        if (sent.length > 0) {
          console.log(`  ${ir.request_number}: auto-sent ${sent.length} Part V observation(s)`);
          fixed += sent.length;
        }
      }
    }
  }

  console.log(`\nBackfill complete. Newly sent: ${fixed}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
