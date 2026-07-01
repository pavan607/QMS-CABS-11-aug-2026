/**
 * Seed inspection requests at each workflow stage for training screenshots.
 * Safe to re-run: removes prior TRAIN-WF-* rows first.
 */
import 'dotenv/config';
import pg from 'pg';

const TEMPLATE_ID = 64;
const PREFIX = 'TRAIN-WF-';

const STAGES = [
  {
    suffix: '01-DRAFT',
    label: 'Draft — Submit for Approval',
    status: 'draft',
    overrides: {
      inspector_id: null,
      inspector_ids: null,
      nominated_team_head_id: null,
      nominated_request_approver_id: 78,
    },
  },
  {
    suffix: '02-PENDING-FORWARD',
    label: 'Pending Forward — Request Approver',
    status: 'pending_request_approval',
    overrides: {
      inspector_id: null,
      inspector_ids: null,
      nominated_team_head_id: null,
      nominated_request_approver_id: 78,
    },
  },
  {
    suffix: '03-RETURNED',
    label: 'Returned to Designer',
    status: 'returned_to_designer',
    overrides: {
      inspector_id: null,
      inspector_ids: null,
      nominated_team_head_id: null,
      request_approver_send_back_comment:
        'Training demo: please correct Part I serial numbers and resubmit.',
    },
  },
  {
    suffix: '04-QA-PART2',
    label: 'Forwarded — QA Head Part II',
    status: 'request_approved',
    overrides: {
      inspector_id: null,
      inspector_ids: null,
      nominated_team_head_id: null,
      part2_data: null,
      part2_date: null,
    },
  },
  {
    suffix: '05-ASSIGN',
    label: 'Nominated — Assign Inspectors',
    status: 'request_approved',
    overrides: {
      inspector_id: null,
      inspector_ids: null,
      nominated_team_head_id: 164,
      part2_data: { step1_complete: true, nominated_team_head_id: 164 },
      part2_date: new Date().toISOString().slice(0, 10),
    },
  },
  {
    suffix: '06-ASSIGNED',
    label: 'Assigned — Start Inspection',
    status: 'assigned',
    overrides: {
      inspector_id: 166,
      inspector_ids: [166],
      nominated_team_head_id: 164,
    },
  },
  {
    suffix: '07-IN-PROGRESS',
    label: 'In Progress — Inspector Part IV',
    status: 'in_progress',
    overrides: {
      inspector_id: 166,
      inspector_ids: [166],
      nominated_team_head_id: 164,
    },
  },
];

export async function seedTrainingWorkflow(pool) {
  const client = pool || new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const ownPool = !pool;

  const tpl = await client.query('SELECT * FROM inspection_requests WHERE id = $1', [TEMPLATE_ID]);
  if (!tpl.rows[0]) {
    throw new Error(`Template inspection request id=${TEMPLATE_ID} not found`);
  }
  const base = tpl.rows[0];

  await client.query(`DELETE FROM inspection_requests WHERE request_number LIKE $1`, [`${PREFIX}%`]);

  const ids = {};
  for (const stage of STAGES) {
    const row = { ...base, ...stage.overrides };
    delete row.id;
    delete row.created_at;
    delete row.updated_at;
    row.request_number = `${PREFIX}${stage.suffix}`;
    row.title = `Training: ${stage.label}`;
    row.status = stage.status;
    row.confirmations = JSON.stringify({
      cocs_available: 'yes',
      logbook_updated: 'yes',
      instruments_available: 'yes',
      approved_docs_available: 'yes',
      joint_inspection_request: 'no',
      previous_observations_status: 'closed',
    });
    const jsonCols = [
      'item_pertains_to',
      'test_type',
      'criticality',
      'document_details',
      'part2_data',
      'part3_data',
      'part4_data',
      'inspector_ids',
    ];
    for (const col of jsonCols) {
      const v = row[col];
      if (v == null) continue;
      if (typeof v === 'object') row[col] = JSON.stringify(v);
    }

    const cols = Object.keys(row);
    const vals = cols.map((c) => row[c]);
    const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
    const res = await client.query(
      `INSERT INTO inspection_requests (${cols.join(', ')}) VALUES (${ph}) RETURNING id, request_number, status`,
      vals
    );
    ids[stage.suffix] = res.rows[0].id;
    console.log(`  Seeded ${res.rows[0].request_number} (id=${res.rows[0].id}, ${res.rows[0].status})`);
  }

  if (ownPool) await client.end();
  return ids;
}

import path from 'path';
import { fileURLToPath } from 'url';

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log('Seeding training workflow samples...');
  const ids = await seedTrainingWorkflow();
  console.log('Done.', ids);
}
