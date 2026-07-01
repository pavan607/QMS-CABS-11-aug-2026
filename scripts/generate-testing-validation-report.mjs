/**
 * Generate QMS Testing and Validation Report as a Word (.docx) file.
 * Usage: node scripts/generate-testing-validation-report.mjs
 * Output: docs/QMS_Testing_and_Validation_Report.docx
 */
import fs from 'fs';
import path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  PageBreak,
  BorderStyle,
} from 'docx';

const ROOT = process.cwd();
const OUT_PATH = path.join(ROOT, 'docs', 'QMS_Testing_and_Validation_Report.docx');
const VERSION = '1.0';
const DATE = new Date().toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function h1(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 } });
}

function h2(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 160 } });
}

function h3(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 120 } });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    alignment: opts.align,
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italic })],
  });
}

function bullet(text) {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 80 } });
}

function bullets(items) {
  return items.map((t) => bullet(t));
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function spacer() {
  return new Paragraph({ spacing: { after: 80 } });
}

function table(headers, rows) {
  const headerCells = headers.map(
    (h) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })],
        shading: { fill: 'E8EEF4' },
      })
  );
  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: String(cell), size: 18 })],
                }),
              ],
            })
        ),
      })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    },
    rows: [new TableRow({ children: headerCells }), ...dataRows],
  });
}

/** Test case row: id, description, steps, expected, result (blank), remarks (blank) */
function tc(id, description, steps, expected) {
  return [id, description, steps, expected, '', ''];
}

const testEnv = [
  ['Item', 'Specification'],
  ['Application', 'Quality Management System (QMS) — CABS Request for R&QA Inspection/Testing'],
  ['Version under test', '0.1.0 (Next.js 15 / React 19)'],
  ['Database', 'PostgreSQL 14+'],
  ['Browser(s)', 'Chrome (latest), Edge (latest), Firefox (latest)'],
  ['OS (client)', 'Windows 10/11, Linux (optional)'],
  ['OS (server)', 'Windows Server / Linux with Node.js 20+'],
  ['Network', 'Intranet / LAN (0.0.0.0 binding supported)'],
  ['Test data', 'Seeded users per role; sample inspection requests via UI or training seed script'],
];

const rolesUnderTest = [
  ['Role', 'Test account (Employee ID)', 'Validation focus'],
  ['initiator', 'As provisioned', 'Part I creation, submit, send-back corrections'],
  ['request_approver', 'As provisioned', 'Part I review, forward to QA, send back'],
  ['qa_head', 'As provisioned', 'Part II nomination, inspector assignment'],
  ['qa_approver', 'As provisioned', 'QA pipeline, quality checks, final approval'],
  ['inspector', 'As provisioned', 'Part III/IV, checklists, attachments'],
  ['ordaqa_head', 'As provisioned', 'Part V clearance approval'],
  ['ordaqa_inspector', 'As provisioned', 'Part IV/V ORDAQA data entry'],
  ['os_director', 'As provisioned', 'Organisation-wide read-only visibility'],
  ['administrator', 'Default admin after db:init', 'Full CRUD, users, settings, overrides'],
];

const authTests = [
  tc(
    'AUTH-001',
    'Valid login with Employee ID and password',
    '1. Open /login. 2. Enter valid Employee ID and password. 3. Click Sign In.',
    'User is authenticated; redirected to /dashboard; session cookie set.'
  ),
  tc(
    'AUTH-002',
    'Invalid password rejected',
    '1. Enter valid Employee ID with wrong password. 2. Submit.',
    'Login fails; error message displayed; no session created.'
  ),
  tc(
    'AUTH-003',
    'Inactive user blocked',
    '1. Set user status to inactive in database. 2. Attempt login.',
    'Login rejected or session marked inactive; user redirected to login.'
  ),
  tc(
    'AUTH-004',
    'Unauthenticated access to dashboard blocked',
    '1. Clear cookies. 2. Navigate directly to /dashboard.',
    'Redirect to /login; no dashboard data exposed.'
  ),
  tc(
    'AUTH-005',
    'Session idle timeout',
    '1. Login. 2. Remain idle for 4+ minutes without interaction.',
    'Warning at ~4 min; automatic logout at ~5 min of inactivity.'
  ),
  tc(
    'AUTH-006',
    'Password change (authenticated)',
    '1. Login. 2. Profile → Change Password. 3. Enter current and new password.',
    'Password updated; can login with new password; old password rejected.'
  ),
  tc(
    'AUTH-007',
    'Password reset flow',
    '1. Request reset via API/UI. 2. Use token to set new password.',
    'Token accepted once; password updated; token invalidated.'
  ),
  tc(
    'AUTH-008',
    'Logout',
    '1. Login. 2. Sign out from header/menu.',
    'Session cleared; redirect to login; protected routes inaccessible.'
  ),
];

const rbacTests = [
  tc(
    'RBAC-001',
    'Initiator can create inspection request',
    'Login as initiator → Inspections → New Request → fill mandatory fields → Create.',
    'Request created in draft or pending state; visible in initiator list.'
  ),
  tc(
    'RBAC-002',
    'Initiator cannot assign inspectors',
    'Login as initiator → open request detail → verify action buttons.',
    'Assign / workflow actions for QA roles not available to initiator.'
  ),
  tc(
    'RBAC-003',
    'Inspector sees only assigned requests',
    'Login as inspector → Inspections list.',
    'List filtered to assigned requests only; unassigned requests not visible.'
  ),
  tc(
    'RBAC-004',
    'Request approver can forward Part I',
    'Login as request_approver → open pending request → Forward to QA.',
    'Status advances; notification sent; initiator cannot perform this action.'
  ),
  tc(
    'RBAC-005',
    'QA Head can assign multiple inspectors',
    'Login as qa_head → Part II → assign two inspectors.',
    'inspector_ids updated; both inspectors notified and see request.'
  ),
  tc(
    'RBAC-006',
    'Administrator full access',
    'Login as administrator → Users, Settings, all inspections.',
    'All menu items accessible; delete and override actions available.'
  ),
  tc(
    'RBAC-007',
    'API returns 403 for unauthorised role',
    'Call PUT /api/inspection-requests/[id]/approve as initiator (via browser devtools or API client).',
    'HTTP 403 Forbidden; no state change in database.'
  ),
  tc(
    'RBAC-008',
    'OS Director read-only visibility',
    'Login as os_director → browse inspections and reports.',
    'Can view organisation data; cannot perform workflow mutations unless permitted.'
  ),
];

const workflowTests = [
  tc(
    'WF-001',
    'End-to-end CABS workflow (happy path)',
    'Initiator creates & submits → Approver forwards → QA assigns → Inspector completes Parts III–IV → ORDAQA clearance → QA approves → Close.',
    'Request reaches Completed/Approved/Closed; audit trail complete; printable form reflects all parts.'
  ),
  tc(
    'WF-002',
    'Request approver send-back to initiator',
    'Approver sends back with comment → initiator edits Part I → resubmits.',
    'Status returns to initiator; comment visible; resubmission re-enters approval queue.'
  ),
  tc(
    'WF-003',
    'QA send-back to designer/initiator',
    'QA Head sends back from Part II with comment.',
    'Request returned; correction notes stored in qa_approver_send_back_comment or equivalent field.'
  ),
  tc(
    'WF-004',
    'Auto-generated request number',
    'Create two requests in same year.',
    'Numbers follow IR-YYYY-NNNNN format; sequential within year.'
  ),
  tc(
    'WF-005',
    'Draft save and resume',
    'Create request → save as draft → logout → login → edit draft → submit.',
    'Draft persisted; only initiator can edit draft; submit transitions status.'
  ),
  tc(
    'WF-006',
    'Part III joint inspection fields',
    'Inspector enters received date/time and joint inspection data in Part III.',
    'Data saved in part3_data JSONB; displayed on detail and print view.'
  ),
  tc(
    'WF-007',
    'Part IV observations and quantities',
    'Inspector completes Part IV memo fields and quantities.',
    'part4_data persisted; validation prevents incomplete forward if required fields missing.'
  ),
  tc(
    'WF-008',
    'Part V ORDAQA clearance',
    'ORDAQA Inspector saves clearance → ORDAQA Head approves or sends back.',
    'Clearance stored in part3_data/part5 workflow; status reflects ORDAQA stage.'
  ),
  tc(
    'WF-009',
    'Reject inspection with reason',
    'QA Approver rejects completed inspection with reason.',
    'Status set to rejected; reason recorded; notifications sent.'
  ),
  tc(
    'WF-010',
    'Activity timeline updates',
    'Perform workflow action → open Activity tab.',
    'New activity entry appears; auto-refresh shows event with actor and timestamp.'
  ),
];

const checklistTests = [
  tc(
    'CHK-001',
    'Create digital checklist on assigned inspection',
    'Inspector opens assigned request → Checklists → Add checklist with items.',
    'Checklist and items created; visible to authorised roles.'
  ),
  tc(
    'CHK-002',
    'Mark items Pass / Fail / N/A',
    'Update each checklist item status.',
    'Statuses saved; summary reflects counts; initiator read-only.'
  ),
  tc(
    'CHK-003',
    'Initiator read-only on checklists',
    'Login as initiator → view checklist on own request.',
    'Can view items; create/update/delete controls hidden or API returns 403.'
  ),
  tc(
    'CHK-004',
    'Delete checklist item',
    'Inspector deletes a checklist item.',
    'Item removed; audit log entry if configured.'
  ),
];

const attachmentTests = [
  tc(
    'ATT-001',
    'Upload evidence file (< 10 MB)',
    'Attach PDF/image to inspection request.',
    'File stored under public/uploads/; metadata in attachments table; download works.'
  ),
  tc(
    'ATT-002',
    'Reject oversized file (> 10 MB)',
    'Attempt upload of file exceeding 10 MB.',
    'Upload rejected with clear error; no partial file stored.'
  ),
  tc(
    'ATT-003',
    'Upload user signature (PNG)',
    'Profile → upload signature via signature pad or file.',
    'signature_path updated; signature appears on printable CABS form.'
  ),
  tc(
    'ATT-004',
    'Delete own attachment',
    'Uploader deletes attachment from detail page.',
    'Record removed; file deleted or orphaned per implementation.'
  ),
];

const notificationTests = [
  tc(
    'NOT-001',
    'In-app notification on assignment',
    'Assign inspector to request.',
    'Inspector receives notification; unread badge increments.'
  ),
  tc(
    'NOT-002',
    'Mark notification as read',
    'Open notification dropdown → click notification.',
    'Marked read; badge count decreases.'
  ),
  tc(
    'NOT-003',
    'Clear all notifications',
    'Use clear/delete all action.',
    'All user notifications removed or marked read per API behaviour.'
  ),
  tc(
    'NOT-004',
    'Cron overdue alert (CRON_SECRET)',
    'Call GET /api/cron/check-alerts with valid Bearer token.',
    'HTTP 200; overdue/pending alerts created for eligible requests.'
  ),
  tc(
    'NOT-005',
    'Cron rejects missing secret',
    'Call /api/cron/check-alerts without Authorization header.',
    'HTTP 401/403; no alerts created.'
  ),
];

const reportTests = [
  tc(
    'RPT-001',
    'Generate Inspection Summary report',
    'Reports → select Inspection Summary → date range → Generate.',
    'Report data returned; table/chart displays; export available.'
  ),
  tc(
    'RPT-002',
    'Export report as CSV',
    'Generate report → Export CSV.',
    'CSV downloads; opens correctly in Excel; columns match filters.'
  ),
  tc(
    'RPT-003',
    'Overdue Inspections report',
    'Generate with requests past due date.',
    'Overdue items listed; counts match dashboard stats.'
  ),
  tc(
    'RPT-004',
    'Compliance report filters',
    'Apply status and inspector filters.',
    'Results scoped to filters only.'
  ),
  tc(
    'RPT-005',
    'Print report view',
    'Open /print/report → browser Print Preview.',
    'Layout suitable for A4; headers and data not clipped.'
  ),
];

const userAdminTests = [
  tc(
    'USR-001',
    'Create user (admin)',
    'Users → Add user with role, Employee ID, department.',
    'User created; can login with assigned role permissions.'
  ),
  tc(
    'USR-002',
    'Edit user role',
    'Change role from inspector to qa_approver.',
    'Permissions update on next login; menu items reflect new role.'
  ),
  tc(
    'USR-003',
    'Deactivate user',
    'Set status inactive.',
    'User cannot login or session terminated within re-check interval.'
  ),
  tc(
    'USR-004',
    'Non-admin cannot access user management',
    'Login as initiator → navigate to /dashboard/users.',
    'Page blocked or menu hidden; API returns 403.'
  ),
];

const projectTests = [
  tc(
    'PRJ-001',
    'Create project hierarchy',
    'Admin → Projects → create Project, Subsystem, LRU, SRU.',
    'Hierarchy saved; selectable on inspection forms where applicable.'
  ),
  tc(
    'PRJ-002',
    'Edit and delete hierarchy node',
    'Modify name; delete leaf node without dependencies.',
    'Changes persisted; referential integrity maintained.'
  ),
];

const settingsTests = [
  tc(
    'SET-001',
    'View and update system settings',
    'Admin → Settings → change a key-value setting → Save.',
    'Setting persisted in settings table; reflected on reload.'
  ),
  tc(
    'SET-002',
    'Non-admin denied settings write',
    'Attempt PUT /api/settings as non-admin.',
    'HTTP 403; no change.'
  ),
];

const printTests = [
  tc(
    'PRT-001',
    'Print CABS inspection form',
    'Open /print/inspection/[id] for completed request → Print Preview.',
    'All Parts I–V data rendered; signatures and tables formatted correctly.'
  ),
  tc(
    'PRT-002',
    'Print incomplete request',
    'Print request still in draft.',
    'Available fields shown; empty sections handled gracefully.'
  ),
];

const securityTests = [
  tc(
    'SEC-001',
    'SQL injection attempt on login',
    'Enter Employee ID: \' OR 1=1 --',
    'Login fails; no database error exposed to user.'
  ),
  tc(
    'SEC-002',
    'XSS in text fields',
    'Enter <script>alert(1)</script> in request title; save and view.',
    'Script not executed; content escaped in UI.'
  ),
  tc(
    'SEC-003',
    'Direct object reference',
    'User A accesses /api/inspection-requests/[id] for User B unassigned request.',
    'HTTP 403 or 404; no data leak.'
  ),
  tc(
    'SEC-004',
    'Password stored hashed',
    'Query users.password_hash in database.',
    'Bcrypt hash present; plaintext password not stored.'
  ),
  tc(
    'SEC-005',
    'Audit log on sensitive mutation',
    'Approve or assign request; query audit_logs.',
    'Entry with user, action, old/new JSONB values.'
  ),
];

const dbTests = [
  tc(
    'DB-001',
    'Database connectivity',
    'Run npm run db:test.',
    'Connection successful; no errors.'
  ),
  tc(
    'DB-002',
    'Schema initialization',
    'Run npm run db:init on clean database.',
    'All tables created; default admin seeded.'
  ),
  tc(
    'DB-003',
    'Migrations apply cleanly',
    'Run npm run db:migrate.',
    'All migrations in database/migrations/ applied without error.'
  ),
  tc(
    'DB-004',
    'Login verification script',
    'Run npm run db:test-login with known credentials.',
    'Script reports successful authentication.'
  ),
  tc(
    'DB-005',
    'Quality check integrity',
    'Run npm run db:verify-qc.',
    'No orphaned or invalid quality_check records reported.'
  ),
];

const deploymentTests = [
  tc(
    'DEP-001',
    'Production build',
    'Run npm run build.',
    'Build completes; standalone output generated.'
  ),
  tc(
    'DEP-002',
    'Production server start',
    'Run npm start after build.',
    'Application serves on configured port; login works.'
  ),
  tc(
    'DEP-003',
    'LAN access (0.0.0.0)',
    'Access app from second machine on intranet using host IP.',
    'Pages load; login and API functional.'
  ),
  tc(
    'DEP-004',
    'Docker Compose deployment',
    'Deploy via docker-compose.yml with .env and PostgreSQL.',
    'Container healthy; uploads volume mounted; AUTH_TRUST_HOST effective.'
  ),
  tc(
    'DEP-005',
    'Offline install path',
    'Run npm run setup:offline from vendored cache (air-gap scenario).',
    'Dependencies install; app builds and runs without internet.'
  ),
];

const uatScenarios = [
  ['#', 'UAT Scenario', 'Business outcome', 'Accepted (Y/N)', 'Sign-off name', 'Date'],
  ['1', 'Initiator submits CABS Part I for real equipment item', 'Paperless request entry', '', '', ''],
  ['2', 'Request Approver reviews and forwards within SLA', 'Timely Part I approval', '', '', ''],
  ['3', 'QA Head assigns inspection team', 'Correct inspector nomination', '', '', ''],
  ['4', 'Inspector completes field inspection with photos', 'Evidence captured digitally', '', '', ''],
  ['5', 'ORDAQA clearance and head approval', 'Regulatory clearance recorded', '', '', ''],
  ['6', 'Final QA approval and closure', 'Inspection formally closed', '', '', ''],
  ['7', 'Management report for monthly review', 'Exportable management data', '', '', ''],
  ['8', 'Print official CABS form for records', 'Audit-ready hard copy', '', '', ''],
];

const defectLog = [
  ['Defect ID', 'Severity', 'Module', 'Description', 'Steps to reproduce', 'Status', 'Fixed in'],
  ['DEF-001', 'High / Medium / Low', '', '', '', 'Open / Fixed / Deferred', ''],
  ['DEF-002', '', '', '', '', '', ''],
  ['DEF-003', '', '', '', '', '', ''],
];

const testSummary = [
  ['Category', 'Total cases', 'Pass', 'Fail', 'Not run', 'Blocked'],
  ['Authentication (AUTH)', String(authTests.length), '', '', '', ''],
  ['RBAC (RBAC)', String(rbacTests.length), '', '', '', ''],
  ['CABS Workflow (WF)', String(workflowTests.length), '', '', '', ''],
  ['Checklists (CHK)', String(checklistTests.length), '', '', '', ''],
  ['Attachments (ATT)', String(attachmentTests.length), '', '', '', ''],
  ['Notifications (NOT)', String(notificationTests.length), '', '', '', ''],
  ['Reports (RPT)', String(reportTests.length), '', '', '', ''],
  ['User admin (USR)', String(userAdminTests.length), '', '', '', ''],
  ['Projects (PRJ)', String(projectTests.length), '', '', '', ''],
  ['Settings (SET)', String(settingsTests.length), '', '', '', ''],
  ['Print (PRT)', String(printTests.length), '', '', '', ''],
  ['Security (SEC)', String(securityTests.length), '', '', '', ''],
  ['Database (DB)', String(dbTests.length), '', '', '', ''],
  ['Deployment (DEP)', String(deploymentTests.length), '', '', '', ''],
];

const tcHeaders = ['TC ID', 'Test case', 'Test steps', 'Expected result', 'Result', 'Remarks'];

function testSection(title, tests) {
  return [h2(title), table(tcHeaders, tests), spacer()];
}

const sections = [
  // Cover
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: 'Quality Management System (QMS)', bold: true, size: 48 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: 'Testing and Validation Report', bold: true, size: 36 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [
      new TextRun({ text: `Document version ${VERSION}  |  Generated ${DATE}`, size: 22 }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'CABS Request for R&QA Inspection/Testing', italics: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    children: [new TextRun({ text: 'TechFLUENT Solutions Pvt Ltd', size: 22 })],
  }),

  pageBreak(),

  h1('Document control'),
  table(
    ['Field', 'Value'],
    [
      ['Document title', 'QMS Testing and Validation Report'],
      ['Document ID', 'QMS-TVR-001'],
      ['Version', VERSION],
      ['Date', DATE],
      ['Prepared by', ''],
      ['Reviewed by', ''],
      ['Approved by', ''],
      ['Classification', 'Internal / Customer deliverable'],
    ]
  ),
  spacer(),

  h1('1. Purpose'),
  p(
    'This document records the testing and validation activities performed on the Quality Management System (QMS). It provides structured test cases, acceptance criteria, and sign-off templates for functional, security, database, deployment, and user acceptance validation of the CABS Request for R&QA Inspection/Testing application.'
  ),
  p(
    'Testers should execute each case, record Pass, Fail, or Not Run in the Result column, and log defects in Section 12. User Acceptance Testing (UAT) sign-off is captured in Section 13.'
  ),

  h1('2. Scope'),
  h2('2.1 In scope'),
  ...bullets([
    'Employee ID authentication and session management',
    'Multi-role RBAC across initiator, approver, QA, inspector, ORDAQA, OS Director, and administrator roles',
    'CABS multi-part inspection workflow (Parts I–V)',
    'Digital checklists, attachments, notifications, and reporting',
    'User and project administration, system settings',
    'Printable CABS forms and report export (JSON/CSV)',
    'Security controls, audit logging, and database integrity',
    'Production build, LAN deployment, Docker, and offline install validation',
  ]),
  h2('2.2 Out of scope'),
  ...bullets([
    'Third-party email provider (SendGrid) production load testing unless configured',
    'Penetration testing by external security firm',
    'Hardware-specific performance benchmarking beyond agreed response-time targets',
  ]),

  h1('3. References'),
  ...bullets([
    'docs/QMS_Technical_Documentation.docx — system architecture (npm run docs:technical)',
    'docs/QMS_Deployment_and_Configuration_Guide.docx — deployment procedures (npm run docs:deployment)',
    'docs/QMS_Complete_User_Manual.docx — end-user procedures',
    'docs/COMPLETE_USER_MANUAL.md — user manual (Markdown)',
    'IMPLEMENTATION_GUIDE.md — API and implementation matrix',
    'database/schema.sql — database design',
    'TEST_CHANGES.md — sample functional test procedures',
  ]),

  h1('4. Test approach'),
  p(
    'Validation follows a risk-based approach prioritising the CABS inspection workflow, role isolation, and data integrity. Testing levels include:'
  ),
  ...bullets([
    'Unit / component verification — database scripts (db:test, db:verify-qc) and API smoke checks',
    'Integration testing — workflow transitions, notifications, and attachment storage',
    'System testing — end-to-end scenarios across all roles using the test cases in Sections 6–10',
    'Security testing — authentication, RBAC, injection, and audit trail verification',
    'Deployment testing — build, LAN access, Docker, and air-gapped install',
    'User Acceptance Testing (UAT) — business scenarios with customer representatives (Section 13)',
  ]),
  p('Entry criteria: application deployed to test environment; database initialised (db:init, db:migrate); test users provisioned for each role.'),
  p('Exit criteria: all critical/high test cases Pass or accepted with documented waiver; no open Critical defects; UAT sign-off obtained.'),

  pageBreak(),

  h1('5. Test environment'),
  table(testEnv[0], testEnv.slice(1)),
  spacer(),
  h2('5.1 Test roles and accounts'),
  p('Provision one account per role before executing RBAC and workflow tests. Change default administrator password before shared testing.'),
  table(rolesUnderTest[0], rolesUnderTest.slice(1)),
  spacer(),
  h2('5.2 Recommended setup commands'),
  ...bullets([
    'npm install',
    'Copy env.template to .env.local and configure DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL',
    'npm run db:init && npm run db:migrate',
    'npm run dev (development) or npm run build && npm start (production validation)',
    'Optional: npm run training:seed-workflow — seed sample workflow data for training/UAT',
  ]),

  h1('6. Test summary'),
  p('Complete this summary after executing all test cases.'),
  table(testSummary[0], testSummary.slice(1)),

  pageBreak(),

  h1('7. Functional test cases'),
  p('Record Pass, Fail, Not Run, or Blocked in the Result column. Add defect ID in Remarks when Fail.'),
  ...testSection('7.1 Authentication and session', authTests),
  ...testSection('7.2 Role-based access control', rbacTests),
  ...testSection('7.3 CABS inspection workflow', workflowTests),
  ...testSection('7.4 Digital checklists', checklistTests),
  ...testSection('7.5 Attachments and file upload', attachmentTests),
  ...testSection('7.6 Notifications and alerts', notificationTests),
  ...testSection('7.7 Reports and export', reportTests),
  ...testSection('7.8 User administration', userAdminTests),
  ...testSection('7.9 Projects and hierarchy', projectTests),
  ...testSection('7.10 System settings', settingsTests),
  ...testSection('7.11 Printable outputs', printTests),

  pageBreak(),

  h1('8. Security validation'),
  ...testSection('8.1 Security test cases', securityTests),

  h1('9. Database validation'),
  ...testSection('9.1 Database test cases', dbTests),

  h1('10. Deployment validation'),
  ...testSection('10.1 Deployment test cases', deploymentTests),

  pageBreak(),

  h1('11. Validation criteria'),
  h2('11.1 Functional acceptance criteria'),
  table(
    ['Criterion', 'Target', 'Met (Y/N)'],
    [
      ['CABS Parts I–V workflow completable end-to-end', '100% of UAT scenarios', ''],
      ['Role isolation — users access only permitted data', 'Zero unauthorised data exposure in RBAC tests', ''],
      ['Request number uniqueness', 'IR-YYYY-NNNNN unique per request', ''],
      ['Attachment size limit enforced', '10 MB maximum per file', ''],
      ['Audit trail for approve/assign/reject actions', 'Logged in audit_logs', ''],
      ['Report export (JSON/CSV)', 'All four report types generate', ''],
      ['Printable CABS form matches on-screen data', 'Visual comparison Pass', ''],
    ]
  ),
  spacer(),
  h2('11.2 Non-functional criteria'),
  table(
    ['Criterion', 'Target', 'Met (Y/N)'],
    [
      ['Page load (dashboard, list)', '< 3 seconds on LAN', ''],
      ['API response (typical GET list)', '< 2 seconds on LAN', ''],
      ['Concurrent users (smoke)', '10 simultaneous sessions without error', ''],
      ['Browser compatibility', 'Chrome, Edge, Firefox latest', ''],
      ['Session security', 'HttpOnly cookie; idle timeout active', ''],
    ]
  ),

  h1('12. Defect log'),
  p('Log all failures here. Link defect ID to Remarks column in test case tables.'),
  table(defectLog[0], defectLog.slice(1)),

  pageBreak(),

  h1('13. User Acceptance Testing (UAT)'),
  p(
    'UAT is performed by customer business users representing each role. Confirm each scenario against real operational procedures before go-live.'
  ),
  table(uatScenarios[0], uatScenarios.slice(1)),
  spacer(),
  h2('13.1 UAT sign-off'),
  table(
    ['Role', 'Name', 'Signature', 'Date'],
    [
      ['QA / R&QA representative', '', '', ''],
      ['IT / System administrator', '', '', ''],
      ['Project authority / Sponsor', '', '', ''],
      ['Vendor (TechFLUENT)', '', '', ''],
    ]
  ),

  h1('14. Conclusion and recommendation'),
  p(
    'Overall validation result:  ☐ Pass   ☐ Pass with conditions   ☐ Fail',
    { bold: true }
  ),
  p('Summary of results:'),
  ...bullets([
    'Total test cases executed: ______ / ______',
    'Critical defects open: ______',
    'Recommendation: ☐ Approved for production   ☐ Approved after fixes   ☐ Not approved',
  ]),
  p('Conditions / waivers (if any):'),
  p('_______________________________________________________________________________'),
  p('_______________________________________________________________________________'),

  spacer(),
  p(`— End of document. Generated ${DATE}.`, { italic: true }),
];

const doc = new Document({
  creator: 'QMS',
  title: 'QMS Testing and Validation Report',
  description: 'Testing and validation report for the Quality Management System',
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 22 },
      },
    },
  },
  sections: [{ properties: {}, children: sections }],
});

async function main() {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUT_PATH, buffer);
  console.log(`Written: ${OUT_PATH}`);
  console.log(`Size: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
