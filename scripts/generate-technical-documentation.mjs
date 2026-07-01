/**
 * Generate QMS Technical Documentation as a Word (.docx) file.
 * Usage: node scripts/generate-technical-documentation.mjs
 * Output: docs/QMS_Technical_Documentation.docx
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
const OUT_PATH = path.join(ROOT, 'docs', 'QMS_Technical_Documentation.docx');
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
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 80 },
  });
}

function bullets(items) {
  return items.map((t) => bullet(t));
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function table(headers, rows) {
  const headerCells = headers.map(
    (h) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
        shading: { fill: 'E8EEF4' },
      })
  );
  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [new Paragraph({ text: String(cell) })],
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

function spacer() {
  return new Paragraph({ spacing: { after: 80 } });
}

const apiEndpoints = [
  ['Method', 'Endpoint', 'Description'],
  ['GET', '/api/inspection-requests', 'List inspection requests (role-scoped filters)'],
  ['POST', '/api/inspection-requests', 'Create a new inspection request'],
  ['GET', '/api/inspection-requests/[id]', 'Get inspection request detail'],
  ['PUT', '/api/inspection-requests/[id]', 'Update inspection request fields'],
  ['DELETE', '/api/inspection-requests/[id]', 'Delete request (administrator)'],
  ['POST', '/api/inspection-requests/[id]/workflow', 'Workflow actions (forward, send back, assign, etc.)'],
  ['PUT', '/api/inspection-requests/[id]/assign', 'Assign inspector(s)'],
  ['PUT', '/api/inspection-requests/[id]/status', 'Update workflow status'],
  ['PUT', '/api/inspection-requests/[id]/approve', 'Approve completed inspection'],
  ['PUT', '/api/inspection-requests/[id]/reject', 'Reject with reason'],
  ['PUT', '/api/inspection-requests/[id]/close', 'Close approved inspection'],
  ['GET', '/api/inspection-requests/stats', 'Dashboard / list statistics'],
  ['GET', '/api/inspection-requests/draft', 'List user draft requests'],
  ['GET', '/api/inspection-checklists', 'List checklists'],
  ['POST', '/api/inspection-checklists', 'Create checklist'],
  ['GET/PUT/DELETE', '/api/inspection-checklists/[id]', 'Checklist CRUD'],
  ['POST', '/api/inspection-checklists/[id]/items', 'Add checklist item'],
  ['PUT/DELETE', '/api/inspection-checklists/items/[id]', 'Update or delete checklist item'],
  ['GET/POST', '/api/attachments', 'List or upload file attachments'],
  ['DELETE', '/api/attachments/[id]', 'Remove attachment'],
  ['GET/POST', '/api/notifications', 'User notifications'],
  ['DELETE', '/api/notifications', 'Clear notifications'],
  ['POST', '/api/reports/generate', 'Generate analytical report (JSON/CSV)'],
  ['GET/POST', '/api/reports', 'List or save reports'],
  ['GET', '/api/reports/types', 'Available report types'],
  ['GET/POST', '/api/users', 'List or create users (admin)'],
  ['GET/PUT/DELETE', '/api/users/[id]', 'User CRUD'],
  ['GET/PUT', '/api/users/profile', 'Current user profile'],
  ['POST', '/api/users/change-password', 'Change password'],
  ['POST', '/api/users/request-password-reset', 'Request reset token'],
  ['POST', '/api/users/reset-password', 'Reset password with token'],
  ['POST/DELETE', '/api/users/[id]/signature', 'Upload or remove digital signature'],
  ['GET/POST', '/api/projects', 'Project hierarchy (admin)'],
  ['GET/PUT/DELETE', '/api/projects/[id]', 'Project CRUD'],
  ['GET/POST', '/api/subsystems', 'Subsystem management'],
  ['GET/POST', '/api/lrus', 'LRU (Line Replaceable Unit) management'],
  ['GET/POST', '/api/srus', 'SRU management'],
  ['GET/POST', '/api/documents', 'Document library'],
  ['GET/POST', '/api/quality-checks', 'Quality check records'],
  ['GET/PUT', '/api/settings', 'System settings'],
  ['GET', '/api/dashboard/stats', 'Dashboard aggregates'],
  ['GET', '/api/cron/check-alerts', 'Automated overdue / pending alerts (cron secret)'],
  ['*', '/api/auth/[...nextauth]', 'NextAuth authentication handlers'],
];

const roles = [
  ['Role', 'Primary responsibilities'],
  ['initiator', 'Creates and submits CABS inspection requests; views organisation-wide requests (read-only on QA parts)'],
  ['request_approver', 'Reviews Part I; forwards to QA or sends back to initiator'],
  ['qa_head', 'QA Head actions: Part II nomination, ORDAQA routing, send-back to designer'],
  ['qa_approver', 'QA approver pipeline; quality checks; similar visibility to QA Head'],
  ['inspector', 'Assigned inspector: checklists, Part III/IV field work, evidence upload'],
  ['ordaqa_head', 'ORDAQA Head: Part V approval, ORDAQA routing decisions'],
  ['ordaqa_inspector', 'ORDAQA assignee: Part IV/V data entry and clearance'],
  ['os_director', 'Organisation-wide read access; approval-level visibility'],
  ['administrator', 'Full system access: users, projects, settings, all workflow overrides'],
];

const workflowSteps = [
  ['Stage', 'Typical actor', 'Description'],
  ['Draft', 'Initiator', 'Request saved but not submitted; editable by initiator'],
  ['Pending request approval', 'Request Approver', 'Part I submitted; approver forwards or sends back'],
  ['QA Part II', 'QA Head / Team Head', 'Nominate team head; assign one or more inspectors'],
  ['Part III (Section 23)', 'Inspector / ORDAQA', 'Received date/time, joint inspection, section completion'],
  ['Part IV', 'Inspector / ORDAQA Inspector', 'Inspection observations, quantities, memo fields (JSONB part4_data)'],
  ['Part V (ORDAQA clearance)', 'ORDAQA Inspector → ORDAQA Head', 'Clearance saved in part3_data; head approves or sends back'],
  ['Inspection execution', 'Inspector(s)', 'Digital checklists, pass/fail/N/A, attachments, activity log'],
  ['Completed / Approved / Closed', 'QA Approver / Admin', 'Final approval, rejection, or closure with audit trail'],
];

const dbTables = [
  ['Table', 'Purpose'],
  ['users', 'Accounts: employee_id login, role, department, designation, signature_path'],
  ['sessions, accounts, verification_tokens', 'NextAuth session and OAuth storage'],
  ['inspection_requests', 'Core IR record: status, workflow JSONB (part2–part5), assignees'],
  ['inspection_checklists, checklist_items', 'Per-request digital checklists'],
  ['attachments', 'Polymorphic file storage (entity_type + entity_id)'],
  ['notifications', 'In-app notification queue per user'],
  ['inspection_activities', 'Timeline of inspection events'],
  ['documents, document_categories', 'Controlled document library'],
  ['quality_checks, quality_check_templates', 'Standalone quality check workflows'],
  ['reports, report_types', 'Generated report metadata and JSON payloads'],
  ['projects, subsystems, lrus, srus', 'Equipment / project hierarchy'],
  ['inspection_type_groups, inspection_type_items', 'Configurable inspection stages'],
  ['audit_logs', 'Change history with old/new JSONB values'],
  ['settings', 'Key-value system configuration'],
  ['password_reset_tokens', 'Password recovery tokens'],
];

const envVars = [
  ['Variable', 'Required', 'Description'],
  ['DATABASE_URL', 'Yes', 'PostgreSQL connection string (postgresql://user:pass@host:port/db)'],
  ['NEXTAUTH_SECRET', 'Yes', 'Session signing secret (openssl rand -base64 32)'],
  ['NEXTAUTH_URL', 'Yes', 'Public base URL of the application'],
  ['AUTH_TRUST_HOST', 'Recommended', 'Set true for LAN, Docker, or reverse-proxy deployments'],
  ['EMAIL_FROM', 'No', 'Sender address when email notifications are enabled'],
  ['SENDGRID_API_KEY', 'No', 'Optional SendGrid integration for outbound email'],
  ['CRON_SECRET', 'No', 'Bearer token for /api/cron/check-alerts'],
  ['HTTP_PORT', 'No', 'Docker Compose host port (default 3000)'],
  ['UPLOADS_HOST_PATH', 'No', 'Host volume for public/uploads in Docker'],
];

const npmScripts = [
  ['Script', 'Purpose'],
  ['npm run dev', 'Development server (Turbopack, binds 0.0.0.0 for LAN)'],
  ['npm run build', 'Production build (standalone output for Docker)'],
  ['npm start', 'Run production server'],
  ['npm run db:init', 'Initialize schema and seed default admin'],
  ['npm run db:migrate', 'Apply SQL migrations in database/migrations/'],
  ['npm run db:test', 'Test database connectivity'],
  ['npm run setup:offline', 'Air-gapped install from vendored npm cache'],
  ['npm run training:ppt', 'Generate training PowerPoint with Playwright screenshots'],
  ['node scripts/generate-technical-documentation.mjs', 'Generate this technical Word document'],
];

const sections = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({ text: 'Quality Management System (QMS)', bold: true, size: 48 }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: 'Technical Documentation', bold: true, size: 36 })],
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

  h1('1. Document Purpose and Audience'),
  p(
    'This document describes the technical architecture, implementation, and operational characteristics of the Quality Management System (QMS). It is intended for software developers, system administrators, DevOps engineers, and technical auditors who deploy, maintain, or extend the application.'
  ),
  p('End-user procedures are covered separately in docs/COMPLETE_USER_MANUAL.md and docs/QMS_Complete_User_Manual.docx.'),

  h1('2. Executive Summary'),
  p(
    'QMS is a full-stack web application that digitises the CABS Request for R&QA Inspection/Testing lifecycle. It replaces paper-based routing with a multi-role workflow spanning request creation, request approval, QA review, inspector assignment, ORDAQA clearance, digital checklists, evidence attachments, notifications, printable CABS forms, and management reporting.'
  ),
  ...bullets([
    'Frontend: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Radix primitives)',
    'Backend: Next.js API Routes with server-side PostgreSQL access',
    'Authentication: NextAuth v5 (Auth.js) with credentials provider (Employee ID + password)',
    'Database: PostgreSQL 14+ with JSONB columns for multi-part workflow data',
    'Deployment: Node.js standalone build, Docker, or offline/air-gapped package',
  ]),

  h1('3. Technology Stack'),
  table(
    ['Layer', 'Technology', 'Version (package.json)'],
    [
      ['Runtime', 'Node.js', '20+ (Docker: node:20-bookworm-slim)'],
      ['Framework', 'Next.js', '15.5.x'],
      ['UI library', 'React', '19.1'],
      ['Language', 'TypeScript', '5.x'],
      ['Styling', 'Tailwind CSS', '4.x'],
      ['Database driver', 'pg (node-postgres)', '8.13'],
      ['Auth', 'next-auth (Auth.js v5 beta)', '5.0 beta'],
      ['Validation', 'Zod', '3.24'],
      ['Password hashing', 'bcryptjs', '2.4'],
      ['Signatures', 'signature_pad', '5.1'],
    ]
  ),
  spacer(),

  h1('4. System Architecture'),
  h2('4.1 High-Level Architecture'),
  p(
    'The application follows a monolithic Next.js architecture: UI pages under app/, REST-style API handlers under app/api/, shared business logic in lib/, and PostgreSQL as the system of record. There is no separate microservice tier; all server logic executes in the Next.js Node.js process.'
  ),
  ...bullets([
    'Browser clients communicate over HTTPS (or HTTP on intranet) to the Next.js server.',
    'Authenticated pages are protected by middleware.ts using NextAuth session cookies.',
    'API routes call lib/db.ts (connection pool) and enforce RBAC via lib/permissions.ts and lib/inspection-access.ts.',
    'Uploaded files are stored on the filesystem under public/uploads/ (Docker volume: ./data/uploads).',
    'Workflow state for Parts II–V is persisted as JSONB on inspection_requests (part2_data, part3_data, part4_data, etc.).',
  ]),

  h2('4.2 Project Structure'),
  ...bullets([
    'app/login — Employee ID sign-in',
    'app/dashboard — Role-aware shell: inspections, reports, projects, users, settings',
    'app/dashboard/inspections — List, create, and multi-tab detail (Parts I–V)',
    'app/print — Printable CABS inspection forms and report layouts',
    'app/api — 50+ route handlers (inspections, users, attachments, cron, etc.)',
    'components/ — UI primitives and feature components (notifications, forms)',
    'lib/ — Database, RBAC, notifications, report generation, inspection workflow helpers',
    'database/ — schema.sql, init.ts, numbered migrations (001–020)',
    'public/uploads — Evidence and signature image storage',
    'scripts/ — Build, offline install, training PPT, documentation generators',
  ]),

  h2('4.3 Request Flow (Simplified)'),
  p(
    '1) User authenticates via POST to NextAuth credentials provider. 2) Middleware validates session on protected routes. 3) Dashboard loads stats from /api/dashboard/stats. 4) Inspection list is filtered server-side by role (lib/inspection-access.ts). 5) Detail updates use PUT on /api/inspection-requests/[id] or POST on /api/inspection-requests/[id]/workflow for state transitions. 6) Notifications are written to the notifications table and surfaced in the header dropdown.'
  ),

  pageBreak(),

  h1('5. Authentication and Session Management'),
  h2('5.1 Login Mechanism'),
  p(
    'Users sign in with Employee ID and password (app/login/page.tsx). The auth module (auth.ts) queries users by normalised employee_id (lib/employee-id.ts), verifies the bcrypt hash, and rejects inactive accounts (status !== active).'
  ),
  ...bullets([
    'JWT session strategy with role, employee_id, and designation embedded in the token.',
    'User status is re-checked every 60 seconds; inactive users receive session.isInactive and are redirected.',
    'Idle timeout: client-side session warning at 4 minutes; logout at 5 minutes of inactivity.',
    'Middleware matcher excludes /api and static assets; API routes perform their own auth() checks.',
  ]),

  h2('5.2 Security Controls'),
  table(
    ['Control', 'Implementation'],
    [
      ['Password storage', 'bcryptjs hashing'],
      ['SQL injection', 'Parameterized queries via pg'],
      ['XSS', 'React automatic escaping; no dangerouslySetInnerHTML on user content'],
      ['RBAC', 'lib/permissions.ts rolePermissions map'],
      ['Row-level access', 'lib/inspection-access.ts scopes list/detail by role and assignment'],
      ['Audit trail', 'audit_logs table on sensitive mutations'],
      ['File uploads', 'Type and size validation in attachment API'],
      ['Cron endpoint', 'Authorization: Bearer CRON_SECRET header'],
    ]
  ),
  spacer(),

  h1('6. Role-Based Access Control'),
  p('The system defines granular roles beyond the original four-role model. Permissions are declared in lib/permissions.ts and enforced in API handlers.'),
  table(roles[0], roles.slice(1)),
  spacer(),
  p(
    'Inspection list visibility is further refined in lib/inspection-access.ts: e.g. inspectors see only assigned requests, QA Heads see requests only after Request Approver forward, and designated employee IDs may have global access regardless of role.'
  ),

  pageBreak(),

  h1('7. Inspection Workflow'),
  p(
    'Inspection requests use auto-generated numbers (IR-YYYY-NNNNN). Status values include draft, pending, pending_request_approval, and stage-specific states managed through the workflow API. Multi-part CABS data is stored in JSONB columns and edited through tabbed UI on the detail page.'
  ),
  table(workflowSteps[0], workflowSteps.slice(1)),
  spacer(),
  h2('7.1 Workflow API'),
  p(
    'POST /api/inspection-requests/[id]/workflow accepts an action field (e.g. submit, forward_to_qa, assign_inspectors, approve_part5, send_back). The handler validates the caller role, current status, and part completion flags (lib/inspection-display.ts), updates the database transactionally, writes audit entries, and triggers notifications (lib/notifications.ts).'
  ),
  h2('7.2 Printable Outputs'),
  p(
    'Routes under app/print/ render print-optimised CABS forms for a single inspection (app/print/inspection/[id]) and analytical reports (app/print/report). These pages are designed for browser Print to PDF.'
  ),

  h1('8. Database Design'),
  p(
    'The canonical schema is in database/schema.sql. Incremental changes are applied via database/migrations/*.sql using npm run db:migrate. Initialization (npm run db:init) creates tables and a default administrator account.'
  ),
  table(dbTables[0], dbTables.slice(1)),
  spacer(),
  h2('8.1 Key inspection_requests Columns'),
  ...bullets([
    'request_number, title, location, item, inspection_type, priority, status, due_date',
    'initiator_id, inspector_id, inspector_ids (JSON array of user IDs), nominated_team_head_id',
    'request_approver_id, final_qa_approver_id, ordaqa_inspector_id, forwarded_to_ordaqa',
    'part2_data, part3_data, part4_data — JSONB workflow payloads',
    'request_approver_send_back_comment, qa_approver_send_back_comment — correction notes',
    'CABS-specific fields added by migrations 007, 014, 020 (item pertains, test types, date ranges)',
  ]),

  pageBreak(),

  h1('9. API Reference'),
  p('All API routes require an authenticated session unless noted. Responses are JSON. Error codes follow HTTP semantics (401 unauthorised, 403 forbidden, 404 not found, 400 validation).'),
  table(apiEndpoints[0], apiEndpoints.slice(1)),
  spacer(),

  h1('10. Notifications and Alerts'),
  h2('10.1 In-App Notifications'),
  p(
    'The notifications table stores per-user messages with type, entity reference, and read state. The UI polls /api/notifications and displays unread counts on the header bell icon.'
  ),
  h2('10.2 Email (Optional)'),
  p(
    'lib/notifications.ts defines helper functions for each workflow event. Email delivery is stub-ready: integrate SendGrid or SMTP in sendEmailNotification() using EMAIL_FROM and SENDGRID_API_KEY.'
  ),
  h2('10.3 Automated Cron Alerts'),
  p(
    'GET /api/cron/check-alerts runs scheduled checks for overdue inspections, pending approvals (>24h), and due-date warnings (3 days). Protect with CRON_SECRET. Vercel cron or an external scheduler can call this endpoint every 6 hours.'
  ),

  h1('11. File Storage'),
  ...bullets([
    'Upload endpoint: POST /api/attachments (multipart form data)',
    'Storage path: public/uploads/ organised by entity',
    'Maximum file size: 10 MB per file (enforced server-side)',
    'Docker: mount UPLOADS_HOST_PATH (default ./data/uploads) to /app/public/uploads',
    'User signatures: POST /api/users/[id]/signature stores PNG for print forms',
  ]),

  h1('12. Reporting'),
  p(
    'POST /api/reports/generate accepts report type and filters (date range, status, inspector). The lib/report-generator.ts module queries aggregated data and returns JSON or CSV. Saved reports are stored in the reports table with JSONB data payloads.'
  ),
  ...bullets([
    'Inspection Summary',
    'Statistical Analysis',
    'Overdue Inspections',
    'Compliance Report',
  ]),

  pageBreak(),

  h1('13. Environment Configuration'),
  p('Copy env.template to .env or .env.local before running the application.'),
  table(envVars[0], envVars.slice(1)),
  spacer(),

  h1('14. Deployment'),
  h2('14.1 Local Development'),
  ...bullets([
    'npm install',
    'Configure .env.local from env.template',
    'npm run db:init && npm run db:migrate',
    'npm run dev — listens on 0.0.0.0:3000 for LAN access',
  ]),

  h2('14.2 Production Build'),
  ...bullets([
    'npm run build — prebuild cleans .next and ensures env',
    'npm start — serves standalone output',
    'Ensure PostgreSQL is reachable from the app host',
  ]),

  h2('14.3 Docker'),
  p(
    'Dockerfile uses multi-stage build: npm ci → next build (standalone) → minimal node:20 runner. docker-compose.yml maps port 3000, loads .env, sets AUTH_TRUST_HOST, and uses host.docker.internal for host PostgreSQL. Customer air-gap delivery uses deploy/docker-compose.yml with a pre-built image.'
  ),

  h2('14.4 Offline / Air-Gapped Install'),
  ...bullets([
    'npm run vendor:npm-cache — populate .npm-offline-cache',
    'npm run install:offline — install without internet',
    'npm run setup:offline — full offline setup script',
  ]),

  h1('15. Operations and Maintenance'),
  table(npmScripts[0], npmScripts.slice(1)),
  spacer(),
  h2('15.1 Database Utilities'),
  ...bullets([
    'npm run db:check-users — list users',
    'npm run db:reset-password — reset single user password',
    'npm run db:reset-all-passwords — bulk password reset (use with caution)',
    'npm run db:test-login — verify credentials against database',
    'npm run db:verify-qc — validate quality check data integrity',
  ]),

  h2('15.2 Default Administrator'),
  p(
    'After db:init, a default admin account may exist (see database/init.ts). Change the default password immediately in production. Login uses Employee ID, not email, for primary authentication.'
  ),

  h1('16. Frontend Technical Notes'),
  ...bullets([
    'UI components: components/ui/ (shadcn pattern with class-variance-authority)',
    'Theming: next-themes for light/dark mode',
    'Icons: lucide-react',
    'Client state: React hooks; server components where applicable in App Router',
    'Inspection detail: tabbed Parts I–V with role-gated actions and auto-refresh on activity timeline',
  ]),

  h1('17. Extension Points'),
  ...bullets([
    'Add migration SQL in database/migrations/ and run db:migrate',
    'Extend rolePermissions in lib/permissions.ts for new roles',
    'Add workflow actions in app/api/inspection-requests/[id]/workflow/route.ts',
    'Add notification templates in lib/notifications.ts',
    'Configure email provider in sendEmailNotification()',
    'Add report types in report_types seed data and lib/report-generator.ts',
  ]),

  h1('18. Related Documentation'),
  ...bullets([
    'README.md — feature overview and quick start',
    'IMPLEMENTATION_GUIDE.md — implementation notes and API matrix',
    'database/schema.sql — full DDL with indexes',
    'docs/COMPLETE_USER_MANUAL.md — end-user manual (Markdown)',
    'docs/QMS_Complete_User_Manual.docx — end-user manual (Word)',
    'docs/QMS_Training_Presentation.pptx — role-based training slides',
  ]),

  pageBreak(),

  h1('Appendix A — Application Routes (UI)'),
  table(
    ['Route', 'Description'],
    [
      ['/', 'Redirects to dashboard or login'],
      ['/login', 'Employee ID authentication'],
      ['/dashboard', 'Role-aware statistics home'],
      ['/dashboard/inspections', 'Inspection request list'],
      ['/dashboard/inspections/new', 'Create new request'],
      ['/dashboard/inspections/[id]', 'Multi-part inspection detail'],
      ['/dashboard/reports', 'Report generation UI'],
      ['/dashboard/projects', 'Project / subsystem / LRU hierarchy'],
      ['/dashboard/inspection-types', 'Inspection stage configuration'],
      ['/dashboard/users', 'User administration'],
      ['/dashboard/settings', 'System settings'],
      ['/dashboard/profile', 'User profile and signature'],
      ['/print/inspection/[id]', 'Printable CABS form'],
      ['/print/report', 'Printable report view'],
    ]
  ),

  spacer(),
  p(`— End of document. Generated ${DATE}.`, { italic: true }),
];

const doc = new Document({
  creator: 'QMS',
  title: 'QMS Technical Documentation',
  description: 'Technical architecture and operations guide for the Quality Management System',
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
