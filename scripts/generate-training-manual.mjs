/**
 * Generate CABS QMS Training Manual as Word (.docx).
 * Usage: node scripts/generate-training-manual.mjs
 * Output: docs/QMS_Training_Manual.docx
 * Source reference: docs/QMS_Training_Manual.md
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
const OUT_PATH = path.join(ROOT, 'docs', 'QMS_Training_Manual.docx');
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
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
        shading: { fill: 'D6E4F0' },
      })
  );
  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({ children: [new Paragraph({ text: String(cell) })] })
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

const roleTracks = [
  ['Role', 'Start with', 'Then complete'],
  ['All users', 'Module 1 — Orientation', 'Module 2 — Navigation & security'],
  ['Initiator / Designer', 'Module 3', 'Exercise 3.1'],
  ['Request Approver', 'Module 4', 'Exercise 4.1'],
  ['QA Head', 'Module 5', 'Exercise 5.1'],
  ['Team Head — QA', 'Module 6', 'Exercise 6.1'],
  ['Inspector / QA Rep', 'Module 7', 'Exercise 7.1'],
  ['ORDAQA users', 'Module 8', 'Exercise 8.1'],
  ['Administrator', 'Module 9', 'Exercise 9.1'],
  ['Full team', 'Module 10 — End-to-end', 'Assessment checklist'],
];

const statuses = [
  ['Status', 'Meaning'],
  ['Draft', 'Saved, not yet submitted'],
  ['Pending request approval', 'Waiting for Request Approver'],
  ['Forwarded', 'Sent to QA Head for Part II'],
  ['Returned to designer', 'Part I needs correction'],
  ['Assigned', 'Inspector(s) nominated'],
  ['In progress', 'Inspection work started'],
  ['Inspection completed', 'Ready for Team Head review'],
  ['Completed / Closed', 'Final state; read-only'],
  ['Rejected', 'Workflow ended with reason'],
];

const approverActions = [
  ['Button', 'When to use', 'Result'],
  ['Forward Request', 'Part I is acceptable', 'Request goes to QA Head'],
  ['Send back', 'Part I can be corrected', 'Returned to designer with comment'],
  ['Reject', 'Request must not continue', 'Rejected with reason; workflow ends'],
];

const endToEnd = [
  ['#', 'Role', 'Action', 'Verify'],
  ['1', 'Initiator', 'Create and submit Part I', 'Pending request approval'],
  ['2', 'Request Approver', 'Forward', 'Forwarded to QA'],
  ['3', 'QA Head', 'Part II + nominate Team Head', 'Nomination saved'],
  ['4', 'Team Head QA', 'Assign inspector(s)', 'Assigned'],
  ['5', 'Team Head QA', 'Start inspection', 'In progress'],
  ['6', 'Inspector', 'Part IV + checklist + attachment', 'Data saved'],
  ['7', 'Team Head QA', 'Complete inspection', 'Inspection completed'],
  ['8', 'Team Head QA', 'Approve & close', 'Closed; read-only'],
  ['9', 'Any', 'Print PDF + generate report', 'Outputs correct'],
];

const quickRef = [
  ['I need to…', 'Go to…', 'Button / tab'],
  ['Create request', 'Dashboard / Inspection Request', 'New IR'],
  ['Fix returned request', 'Request detail', 'Edit Part I → Resubmit'],
  ['Approve Part I', 'Request detail', 'Forward / Send back / Reject'],
  ['Nominate Team Head', 'Request detail', 'Part II'],
  ['Assign inspector', 'Part II', 'Assign inspector(s)'],
  ['Record findings', 'Part IV', 'Save'],
  ['Print official form', 'Request detail', 'Print PDF'],
  ['Run management report', 'Reports', 'Generate'],
  ['Add serial number', 'Projects (admin)', 'LRU → Serial numbers'],
];

const children = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({ text: 'CABS Quality Management System', bold: true, size: 36 }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: 'Training Manual', bold: true, size: 32 })],
  }),
  p(`Version ${VERSION} — ${DATE}`, { italic: true }),
  p('Audience: Trainers, new users, and role-specific trainees'),
  p('Companion: QMS_Training_Presentation.pptx (npm run training:ppt)'),
  p('Reference: docs/COMPLETE_USER_MANUAL.md'),
  pageBreak(),

  h1('How to Use This Manual'),
  p(
    'This manual supports instructor-led training and self-paced onboarding for the CABS QMS web application. Complete Module 1 and Module 2 first, then your role track, then the end-to-end exercise if your organisation runs full-team training.'
  ),
  table(roleTracks[0], roleTracks.slice(1)),
  spacer(),
  ...bullets([
    'Half-day (3–4 hours): Modules 1–2 + one role track + workflow overview',
    'Full day (6–7 hours): All role modules + hands-on end-to-end exercise',
    'Administrator add-on: +2 hours for user and master-data maintenance',
  ]),
  pageBreak(),

  h1('Module 1 — Orientation'),
  h2('Learning objectives'),
  ...bullets([
    'Describe what QMS replaces and the CABS inspection workflow it supports',
    'Name main roles and where each fits in the lifecycle',
    'Explain Send back vs Reject vs Approve & Close',
  ]),
  h2('What is QMS?'),
  p(
    'The CABS Quality Management System digitizes Request for R&QA Inspection/Testing records: Part I (designer), Part II (R&QA office), Part III (ORDAQA when required), Part IV (inspection report), and Part V (ORDAQA clearance). The system provides notifications, printable CABS PDFs, filtered reports, and an audit trail.'
  ),
  h2('Standard workflow'),
  ...bullets([
    'Initiator creates and submits Part I',
    'Request Approver forwards, sends back, or rejects',
    'QA Head completes Part II Step 1 and nominates Team Head — QA',
    'Team Head — QA assigns inspectors and starts inspection',
    'Inspectors record Part IV, checklists, and attachments',
    'Team Head — QA completes inspection and approves & closes',
  ]),
  h2('Roles at a glance'),
  table(
    ['Role', 'Primary responsibility'],
    [
      ['Initiator / Designer', 'Create Part I; correct when returned'],
      ['Request Approver', 'Forward, send back, or reject Part I'],
      ['QA Head', 'Part II Step 1; nominate Team Head — QA; ORDAQA routing'],
      ['Team Head — QA', 'Assign inspectors; start/complete/close'],
      ['Inspector / QA Rep', 'Part IV; checklists; evidence'],
      ['ORDAQA Head / Inspector', 'Part III / Part V when ORDAQA required'],
      ['Administrator', 'Users, projects, inspection types, settings'],
    ]
  ),
  h2('Key statuses'),
  table(statuses[0], statuses.slice(1)),
  pageBreak(),

  h1('Module 2 — Access, Layout, and Security'),
  h2('Signing in'),
  ...bullets([
    'Open the QMS URL from your administrator',
    'Enter Employee ID (normalized to uppercase) and password',
    'Select Sign In',
  ]),
  h2('Application layout'),
  table(
    ['Area', 'Purpose'],
    [
      ['Header', 'Search, theme, notifications, profile'],
      ['Sidebar', 'Dashboard, Inspection Request, Reports, admin menus'],
      ['Main content', 'Current page or form'],
    ]
  ),
  h2('Session timeout'),
  ...bullets([
    '5 minutes of inactivity logs you out automatically',
    'Warning at 4 minutes — select Stay Logged In to continue',
  ]),
  h2('Exercise 2.1 — First login'),
  table(
    ['Step', 'Action', 'Expected result'],
    [
      ['1', 'Sign in with training account', 'Dashboard with your role'],
      ['2', 'Toggle theme', 'Light/dark mode changes'],
      ['3', 'Open notifications', 'Panel opens'],
      ['4', 'Open Profile', 'Employee ID and designation shown'],
      ['5', 'Sign out and in again', 'Successful login'],
    ]
  ),
  pageBreak(),

  h1('Module 3 — Initiator / Designer'),
  h2('Learning objectives'),
  ...bullets([
    'Create Part I inspection request with project hierarchy and documents',
    'Submit for Request Approver approval',
    'Correct and resubmit after send-back',
  ]),
  h2('Create a new inspection request'),
  ...bullets([
    'Select New IR from Dashboard or Inspection Request',
    'Complete programme → subsystem → LRU → SRU and serial numbers',
    'Enter SO details, inspection stage, mode, dates, venue',
    'Fill document rows and confirmation questions',
    'Upload logbook when Log Book Copy Attached = Yes',
    'Select certifying Request Approver and Submit for Approval',
  ]),
  h2('Exercise 3.1 — Submit Part I'),
  table(
    ['Step', 'Action', 'Checkpoint'],
    [
      ['1', 'Create IR with required fields', 'No validation errors'],
      ['2', 'Attach logbook if required', 'File in attachments'],
      ['3', 'Select Request Approver', 'Correct reporting chain'],
      ['4', 'Submit', 'Pending request approval'],
      ['5', 'After instructor send-back', 'Returned status visible'],
      ['6', 'Edit and resubmit', 'Pending approval again'],
    ]
  ),
  pageBreak(),

  h1('Module 4 — Request Approver'),
  h2('Learning objectives'),
  ...bullets([
    'Find requests pending forward from Dashboard or Review Now',
    'Forward acceptable requests to QA Head',
    'Send back with comment or reject with reason',
  ]),
  h2('Review checklist'),
  ...bullets([
    'Programme, item, and serial numbers correct',
    'Documents and confirmations complete',
    'Logbook attached when required',
    'Certifying approver correct',
  ]),
  h2('Actions'),
  table(approverActions[0], approverActions.slice(1)),
  h2('Exercise 4.1'),
  table(
    ['Step', 'Action', 'Checkpoint'],
    [
      ['1', 'Open trainee request', 'Part I visible'],
      ['2', 'Send back with comment', 'Returned to designer'],
      ['3', 'Forward after resubmit', 'Forwarded to QA'],
    ]
  ),
  pageBreak(),

  h1('Module 5 — QA Head'),
  h2('Part II Step 1'),
  ...bullets([
    'Open forwarded request → Part II tab or Fill Part II',
    'Enter Head R&QA comments',
    'Set ORDAQA involvement if applicable',
    'Nominate Team Head — QA and save',
  ]),
  h2('Exercise 5.1'),
  table(
    ['Step', 'Action', 'Checkpoint'],
    [
      ['1', 'Open forwarded training request', 'Part II editable'],
      ['2', 'Nominate Team Head', 'Saved'],
      ['3', 'Save Part II', 'Team Head sees request'],
    ]
  ),
  pageBreak(),

  h1('Module 6 — Team Head — QA'),
  h2('Assign through close'),
  ...bullets([
    'Part II: assign one or more Inspector / QA Rep users → Assigned',
    'Start Inspection → In progress',
    'After inspectors complete Part IV: Complete Inspection',
    'Approve & Close → read-only completed request',
  ]),
  h2('Send back before assignment'),
  p(
    'Use Send back when Part I must be corrected before inspectors are assigned. The initiator resubmits and the request passes Request Approver and QA Head again.'
  ),
  h2('Exercise 6.1'),
  table(
    ['Step', 'Action', 'Checkpoint'],
    [
      ['1', 'Assign inspector(s)', 'Assigned'],
      ['2', 'Start inspection', 'In progress'],
      ['3', 'After Part IV complete', 'Ready to complete'],
      ['4', 'Complete and Approve & Close', 'Closed'],
    ]
  ),
  pageBreak(),

  h1('Module 7 — Inspector / QA Rep'),
  h2('Part IV and checklists'),
  ...bullets([
    'Open assigned request; Start Inspection if status is Assigned',
    'Part IV tab: offered/accepted/observations/rejected, remarks, closure dates',
    'Checklists tab: Add Checklist, mark items, Complete when done',
    'Attachments tab: upload evidence within size limits',
  ]),
  h2('Exercise 7.1'),
  table(
    ['Step', 'Action', 'Checkpoint'],
    [
      ['1', 'Enter Part IV data', 'Saves successfully'],
      ['2', 'Add checklist with 3+ items', 'Results recorded'],
      ['3', 'Upload attachment', 'File listed'],
    ]
  ),
  pageBreak(),

  h1('Module 8 — ORDAQA (when applicable)'),
  ...bullets([
    'QA Head sets ORDAQA involvement in Part II',
    'ORDAQA Inspector completes Part III',
    'ORDAQA Head reviews clearance per deployment rules',
    'Send back to designer re-enters full approval chain',
  ]),
  pageBreak(),

  h1('Module 9 — Reports and Printable Output'),
  h2('Print PDF'),
  ...bullets([
    'Open request → Print PDF → review in new tab → browser Print or Save as PDF',
    'Signatures appear when uploaded in User Management',
  ]),
  h2('Reports module'),
  ...bullets([
    'Reports sidebar → Inspection Requests (or configured type)',
    'Choose View on screen, PDF, Word, or Excel',
    'Filter by project, designer, status group, date range → Generate',
  ]),
  pageBreak(),

  h1('Module 10 — Administrator'),
  h2('User management'),
  ...bullets([
    'Users → New User: Employee ID, role, Reports To, designation, signature',
    'Active users can sign in; inactive users cannot',
  ]),
  h2('Project hierarchy'),
  p('Projects → Subsystem → LRU → SRU → serial numbers. This drives inspection form dropdowns.'),
  h2('Inspection types'),
  p('Configure categories and active items for inspection stage dropdowns.'),
  h2('Exercise 10.1'),
  table(
    ['Step', 'Action', 'Checkpoint'],
    [
      ['1', 'Create test initiator user', 'Can sign in'],
      ['2', 'Add serial under training LRU', 'Appears on new IR'],
      ['3', 'Upload user signature', 'Shows on Print PDF'],
    ]
  ),
  pageBreak(),

  h1('Module 11 — End-to-End Exercise'),
  p('Walk one request through every role using training accounts or TRAIN-WF-* sample data.'),
  table(endToEnd[0], endToEnd.slice(1)),
  pageBreak(),

  h1('Assessment — Competency Checklist'),
  h2('All users'),
  ...bullets([
    'Sign in/out; explain session timeout',
    'Use notifications; change password',
  ]),
  h2('Role-specific (trainer sign-off)'),
  ...bullets([
    'Initiator: create, submit, resubmit after send-back',
    'Request Approver: forward, send back, reject',
    'QA Head: Part II and Team Head nomination',
    'Team Head QA: assign, start, complete, close',
    'Inspector: Part IV, checklist, attachment',
    'Administrator: user, serial, inspection type',
  ]),
  pageBreak(),

  h1('Trainer Guide'),
  h2('Before the session'),
  ...bullets([
    'Confirm QMS URL and training accounts',
    'Optional: npm run training:seed-workflow for demo requests',
    'Generate slides: npm run training:ppt (dev server required)',
    'Distribute this manual; regenerate Word: npm run docs:training',
  ]),
  h2('Full-day agenda (sample)'),
  table(
    ['Time', 'Content'],
    [
      ['09:00–09:45', 'Module 1 — Orientation'],
      ['09:45–10:30', 'Module 2 — Access & layout'],
      ['10:30–12:00', 'Role tracks (split or demo)'],
      ['13:00–14:30', 'Hands-on exercises by role'],
      ['14:30–15:15', 'Reports & PDF'],
      ['15:15–16:30', 'End-to-end + assessment'],
    ]
  ),
  pageBreak(),

  h1('Quick Reference'),
  table(quickRef[0], quickRef.slice(1)),
  spacer(),
  h2('Related documentation'),
  ...bullets([
    'QMS_Training_Presentation.pptx — npm run training:ppt',
    'COMPLETE_USER_MANUAL.md — detailed screen reference',
    'QMS_Technical_Documentation.docx — npm run docs:technical',
    'QMS_Deployment_and_Configuration_Guide.docx — npm run docs:deployment',
  ]),
  p('For access, master data, or workflow questions: contact your QMS administrator.'),
];

const doc = new Document({
  title: 'CABS QMS Training Manual',
  creator: 'QMS',
  description: 'Instructor-led and self-paced training for CABS Quality Management System',
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 22 },
      },
    },
  },
  sections: [{ properties: {}, children }],
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
