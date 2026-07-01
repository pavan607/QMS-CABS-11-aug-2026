/**
 * Generate QMS Deployment & Configuration Guide as Word (.docx).
 * Usage: node scripts/generate-deployment-guide.mjs
 * Output: docs/QMS_Deployment_and_Configuration_Guide.docx
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

const OUT_PATH = path.join(process.cwd(), 'docs', 'QMS_Deployment_and_Configuration_Guide.docx');
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

const envVars = [
  ['Variable', 'Required', 'Where used', 'Description / example'],
  [
    'DATABASE_URL',
    'Yes',
    'All',
    'postgresql://user:password@host:5432/database — PostgreSQL connection string',
  ],
  [
    'AUTH_SECRET',
    'Yes (prod)',
    'Docker / prod',
    'Session signing secret. Generate: openssl rand -base64 32. Legacy alias: NEXTAUTH_SECRET',
  ],
  [
    'AUTH_URL',
    'Yes (prod)',
    'All',
    'Public URL users open in the browser (e.g. http://qms or https://qms). Must match actual access URL. Legacy: NEXTAUTH_URL',
  ],
  [
    'AUTH_TRUST_HOST',
    'Recommended',
    'Docker, LAN, proxy',
    'Set true for Docker, reverse proxy, or non-default hostnames (Auth.js v5 UntrustedHost)',
  ],
  [
    'AUTH_COOKIE_SECURE',
    'Optional',
    'HTTP intranet',
    'Set false for plain HTTP LAN; true for HTTPS. Auto-derived from AUTH_URL if unset',
  ],
  [
    'DOCKER_PG_HOST',
    'Docker only',
    'docker-compose',
    'e.g. host.docker.internal — rewrites localhost in DATABASE_URL inside container',
  ],
  [
    'UPLOADS_HOST_PATH',
    'Docker prod',
    'docker-compose',
    'Host directory mounted to /app/public/uploads (writable by uid 1001)',
  ],
  [
    'HTTP_PORT',
    'Optional',
    'Docker',
    'Host port mapped to container 3000 (default 3000)',
  ],
  [
    'NGINX_HTTP_PORT',
    'Optional',
    'Docker + nginx',
    'Reverse proxy HTTP port (default 80)',
  ],
  [
    'NGINX_HTTPS_PORT',
    'Optional',
    'Docker + nginx',
    'HTTPS port when TLS certs configured (default 443)',
  ],
  [
    'EMAIL_FROM',
    'No',
    'Notifications',
    'Sender address when email integration is enabled',
  ],
  [
    'SENDGRID_API_KEY',
    'No',
    'Notifications',
    'SendGrid API key for outbound email',
  ],
  [
    'CRON_SECRET',
    'No',
    'Cron',
    'Bearer token for GET /api/cron/check-alerts',
  ],
  [
    'NODE_ENV',
    'Auto',
    'Runtime',
    'production for npm start / Docker; development for npm run dev',
  ],
];

const prereqs = [
  ['Component', 'Minimum version', 'Notes'],
  ['Node.js', '18 LTS (20 recommended)', 'Required for source build; not needed for Docker-only delivery'],
  ['npm', '9+', 'Bundled with Node.js'],
  ['PostgreSQL', '12+ (14+ recommended)', 'External service; not included in customer Docker bundle'],
  ['Docker', '20+', 'Optional; required for container deployment'],
  ['Disk space', '1 GB+', 'Plus space for uploads and database'],
  ['OS', 'Windows / Linux', 'Windows deploy scripts in deploy/ folder'],
];

const deployPaths = [
  ['Scenario', 'Compose file', 'Env template', 'Notes'],
  [
    'Developer (source)',
    'docker-compose.yml (repo root)',
    'env.template → .env or .env.local',
    'Build image: docker compose up --build -d',
  ],
  [
    'Customer (image only)',
    'deploy/docker-compose.yml',
    'deploy/env.example → deploy/.env',
    'Load qms-image.tar; no source code on server',
  ],
  [
    'LAN dev server',
    'npm run dev',
    'env.template',
    'Binds 0.0.0.0; prints LAN URLs via print-intranet-dev-url.js',
  ],
];

const sections = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: 'Quality Management System (QMS)', bold: true, size: 44 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: 'Deployment and Configuration Guide', bold: true, size: 32 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: `Version ${VERSION}  |  ${DATE}`, size: 22 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'TechFLUENT Solutions Pvt Ltd', size: 22 })],
  }),

  pageBreak(),

  h1('1. Introduction'),
  p(
    'This guide explains how to install, configure, and operate the QMS application across development, production, Docker, offline (air-gapped), and intranet environments. Follow the section that matches your deployment model.'
  ),
  p('Audience: system administrators, DevOps engineers, and deployment teams.', { italic: true }),

  h1('2. Prerequisites'),
  table(prereqs[0], prereqs.slice(1)),
  spacer(),
  ...bullets([
    'PostgreSQL must be installed, running, and reachable before starting QMS.',
    'Create an empty database (e.g. QMS or qms_db) before running db:init or migrations.',
    'Firewall: allow inbound TCP on the HTTP/HTTPS port users will use.',
  ]),

  h1('3. Configuration Files Overview'),
  table(deployPaths[0], deployPaths.slice(1)),
  spacer(),
  ...bullets([
    'env.template — developer template at repository root',
    'deploy/env.example — customer Docker bundle template (uses AUTH_SECRET / AUTH_URL naming)',
    '.env or .env.local — active configuration (never commit to git)',
    'deploy/.env.docker — optional starting point for Docker trials',
  ]),

  pageBreak(),

  h1('4. Environment Variables Reference'),
  p(
    'Copy the appropriate template to .env (Docker: deploy/.env) and edit all CHANGE_ME values before first start.'
  ),
  table(envVars[0], envVars.slice(1)),
  spacer(),

  h2('4.1 DATABASE_URL'),
  p('Format: postgresql://username:password@host:port/database_name'),
  ...bullets([
    'Local Node (no Docker): host localhost or 127.0.0.1 is correct.',
    'Docker with Postgres on the same machine: keep localhost in .env; set DOCKER_PG_HOST=host.docker.internal in compose (automatic rewrite via lib/database-url.ts).',
    'Remote database server: use the real hostname or IP in DATABASE_URL (no rewrite).',
    'Special characters in passwords: URL-encode @ and other reserved characters.',
  ]),

  h2('4.2 Authentication variables'),
  p(
    'QMS uses NextAuth v5 (Auth.js). Users sign in with Employee ID and password. Session JWT max age is 30 minutes (auth.config.ts); the UI enforces a 5-minute idle timeout.'
  ),
  ...bullets([
    'AUTH_URL must exactly match what users type in the browser (scheme, host, port).',
    'Example behind nginx on port 80: AUTH_URL=http://qms (hostname qms in DNS or hosts file).',
    'Example direct app port: AUTH_URL=http://server-name:3000',
    'HTTPS production: AUTH_URL=https://your-server and install valid TLS certificates.',
    'Plain HTTP intranet: set AUTH_COOKIE_SECURE=false if sessions fail after login.',
    'AUTH_TRUST_HOST=true is required for Docker, LAN IPs, and reverse proxies.',
  ]),

  h2('4.3 Generate secrets'),
  p('Linux / macOS / Git Bash:'),
  p('  openssl rand -base64 32'),
  p('PowerShell:'),
  p('  [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])'),

  pageBreak(),

  h1('5. Database Setup and Configuration'),
  h2('5.1 Create database'),
  p('Using psql:'),
  p('  CREATE DATABASE "QMS";'),
  p('Or command line: createdb QMS'),

  h2('5.2 Initialize schema and seed users'),
  p('From project root with DATABASE_URL set in .env or .env.local:'),
  ...bullets([
    'npm run db:test — verify connectivity',
    'npm run db:init — applies database/schema.sql, all migrations, and seed users',
    'npm run db:migrate — apply migrations only (existing databases)',
    'npm run db:check-users — list users after init',
  ]),
  p(
    'Default administrator after init: Employee ID ADM001, password admin123 (change immediately in production). Login screen uses Employee ID, not email.'
  ),

  h2('5.3 Migration files'),
  p(
    'Incremental SQL lives in database/migrations/ (001 through 020). db:init runs them in sorted order. For upgrades on live systems, back up PostgreSQL first, then run npm run db:migrate.'
  ),

  h2('5.4 Database maintenance commands'),
  table(
    ['Command', 'Purpose'],
    [
      ['npm run db:test', 'Test DATABASE_URL connection'],
      ['npm run db:init', 'Full schema + migrations + seed users'],
      ['npm run db:migrate', 'Run migration SQL files only'],
      ['npm run db:reset-password', 'Reset one user password (interactive)'],
      ['npm run db:reset-all-passwords', 'Bulk reset (use with caution)'],
      ['npm run db:test-login', 'Verify credentials against database'],
    ]
  ),

  pageBreak(),

  h1('6. Local Development Deployment'),
  h2('6.1 Install dependencies'),
  p('  npm install'),
  h2('6.2 Configure environment'),
  p('  copy env.template .env.local'),
  p('Edit DATABASE_URL, NEXTAUTH_SECRET (or AUTH_SECRET), NEXTAUTH_URL (or AUTH_URL), AUTH_TRUST_HOST=true'),

  h2('6.3 Start development server'),
  p('  npm run dev'),
  p(
    'The dev script binds 0.0.0.0 and prints LAN URLs (scripts/print-intranet-dev-url.js). Colleagues on the same network can use http://<your-ip>:3000.'
  ),
  h2('6.4 Alternative: automated setup'),
  ...bullets([
    'npm run setup — interactive setup (requires internet)',
    'node setup.js / setup.ps1 / setup.sh — platform-specific setup scripts',
  ]),

  h1('7. Production Deployment (Node.js)'),
  h2('7.1 Build'),
  p('Stop npm run dev before building (prebuild script blocks if next dev is running).'),
  ...bullets([
    'npm run build — cleans .next if needed, runs next build (standalone output)',
    'npm start — serves production build on port 3000',
    'npm run start:lan — production server bound to 0.0.0.0 for intranet',
  ]),

  h2('7.2 Process management'),
  p(
    'Run npm start under a process manager (systemd, PM2, Windows Service) so the app restarts on failure. Set working directory to the project root and load .env variables.'
  ),

  h2('7.3 Uploads directory'),
  ...bullets([
    'Ensure public/uploads/ exists and is writable by the Node process.',
    'Subfolders are created on demand for inspection_request, quality_check, document, signatures.',
    'Back up public/uploads/ with the database for disaster recovery.',
  ]),

  pageBreak(),

  h1('8. Docker Deployment'),
  h2('8.1 Vendor: build and export image'),
  p('From repository root (requires internet for npm ci during build):'),
  ...bullets([
    'docker build -t qms:latest .',
    'docker save qms:latest -o qms-image.tar',
    'Deliver to customer: qms-image.tar, deploy/docker-compose.yml, deploy/env.example, deploy/README.md',
  ]),
  p('The production image uses Node 20 slim, standalone Next.js output, non-root user nextjs (uid 1001). Secrets in .env are not baked into the image.'),

  h2('8.2 Customer: load and run'),
  p('In the deploy/ delivery folder:'),
  ...bullets([
    'docker load -i qms-image.tar',
    'cp env.example .env — edit DATABASE_URL, AUTH_SECRET, AUTH_URL, UPLOADS_HOST_PATH',
    'sudo mkdir -p /var/lib/qms/uploads && sudo chown -R 1001:1001 /var/lib/qms/uploads',
    'docker compose up -d',
  ]),

  h2('8.3 Docker Compose behaviour'),
  table(
    ['Setting', 'Value', 'Effect'],
    [
      ['extra_hosts', 'host.docker.internal:host-gateway', 'Reach host PostgreSQL from container'],
      ['DOCKER_PG_HOST', 'host.docker.internal', 'Rewrites localhost in DATABASE_URL'],
      ['AUTH_TRUST_HOST', 'true', 'Allows LAN / proxy hostnames'],
      ['Volume', 'UPLOADS_HOST_PATH → /app/public/uploads', 'Persistent file storage on host'],
      ['HTTP_PORT', '3000 (default)', 'Published app port'],
    ]
  ),
  spacer(),
  p(
    'Customer compose uses image: qms:latest (no build step). Root docker-compose.yml includes build: for vendor CI.'
  ),

  h2('8.4 Windows helper scripts (deploy/)'),
  table(
    ['Script', 'Purpose'],
    [
      ['start_qms.bat', 'Start Docker container (creates if missing)'],
      ['stop_qms.bat / stop_qms.vbs', 'Stop QMS container'],
      ['watch_qms.bat', 'Monitor container'],
      ['install-offline.bat', 'Run offline npm install on Windows'],
      ['run_qms.vbs', 'Alternative launcher'],
    ]
  ),
  p('Edit hard-coded paths in start_qms.bat (DATABASE_URL, volume mount) to match your server before use.'),

  pageBreak(),

  h1('9. Offline and Air-Gapped Deployment'),
  p(
    'For defence or isolated networks without internet, use the vendored npm cache (.npm-offline-cache) included in the repository.'
  ),

  h2('9.1 On a connected machine (once)'),
  ...bullets([
    'Stop npm run dev (avoids Windows file locks)',
    'npm run vendor:npm-cache — populate cache from package-lock.json',
    'Optional: npm run package — full USB bundle with offline .npmrc',
    'Copy entire project including .npm-offline-cache, package-lock.json, package.json, .npmrc',
  ]),

  h2('9.2 On the target machine (no internet)'),
  ...bullets([
    'deploy\\install-offline.bat OR npm run install:offline OR npm install --offline',
    'cp env.template .env — configure DATABASE_URL and secrets',
    'npm run db:init',
    'npm run build && npm start (production) or npm run dev (development)',
  ]),

  h2('9.3 Docker-only air-gap'),
  p(
    'If you only run the pre-built qms-image.tar, npm install is NOT required on the target. Transfer the image tar and deploy/ folder, load the image, configure .env, and run docker compose up -d.'
  ),

  h2('9.4 Offline UI mode'),
  p('  npm run setup:offline — validates env and configures system fonts (no Google Fonts CDN).'),

  pageBreak(),

  h1('10. Reverse Proxy and HTTPS (Optional)'),
  h2('10.1 Nginx'),
  p(
    'Sample configuration: deploy/nginx/default.conf proxies port 80 to the app service on port 3000. Set server_name to your intranet hostname (e.g. techfluentcrm or qms).'
  ),
  ...bullets([
    'Add hosts file or DNS entry: qms → server IP',
    'Set AUTH_URL=http://qms when users access port 80 without :3000',
    'Do not expose port 3000 publicly if nginx terminates HTTP on 80',
  ]),

  h2('10.2 HTTPS / TLS'),
  p('Certificates go in deploy/nginx/ssl/:'),
  ...bullets([
    'fullchain.pem — server certificate',
    'privkey.pem — private key',
    'Generate self-signed (testing): deploy/nginx/ssl/generate-self-signed.ps1 (Windows) or .sh (Linux)',
    'Production: replace with CA-issued certificates; set AUTH_URL=https://qms',
  ]),
  p('Browsers show warnings for self-signed certs until the certificate is trusted.'),

  h1('11. Intranet and LAN Access'),
  ...bullets([
    'Development: npm run dev prints Network: http://<ip>:3000 for each LAN interface',
    'Production LAN: npm run start:lan or Docker with HTTP_PORT and firewall rule',
    'All clients must resolve the same hostname used in AUTH_URL',
    'Session cookies require consistent scheme (http vs https) and host',
  ]),

  h1('12. File Uploads Configuration'),
  ...bullets([
    'Maximum upload size: 10 MB per file (API validation)',
    'Storage path: public/uploads/<entity_type>/',
    'Docker: set UPLOADS_HOST_PATH to an absolute host path; chown 1001:1001',
    'Signatures: stored via /api/users/[id]/signature for printable forms',
    'Back up UPLOADS_HOST_PATH with regular database backups',
  ]),

  pageBreak(),

  h1('13. Optional Services'),
  h2('13.1 Email notifications'),
  p(
    'Email is optional. Configure EMAIL_FROM and SENDGRID_API_KEY, then implement sendEmailNotification() in lib/notifications.ts for your mail provider.'
  ),

  h2('13.2 Automated alerts (cron)'),
  p('Endpoint: GET /api/cron/check-alerts'),
  p('Header: Authorization: Bearer <CRON_SECRET>'),
  p('Schedule: every 6 hours recommended (0 */6 * * *).'),
  ...bullets([
    'Vercel: vercel.json defines cron path /api/cron/check-alerts',
    'Linux cron: curl -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/cron/check-alerts',
    'Windows Task Scheduler: equivalent HTTP call on schedule',
  ]),
  p('Alerts cover: overdue inspections, pending approvals (>24h), due dates within 3 days.'),

  h1('14. Post-Deployment Checklist'),
  table(
    ['Step', 'Action', 'Verify'],
    [
      ['1', 'PostgreSQL running', 'npm run db:test succeeds'],
      ['2', 'Schema applied', 'db:init or db:migrate completed'],
      ['3', 'Secrets set', 'Unique AUTH_SECRET / NEXTAUTH_SECRET'],
      ['4', 'AUTH_URL correct', 'Login works from user workstations'],
      ['5', 'Default passwords changed', 'ADM001 and all seed users'],
      ['6', 'Uploads writable', 'Test file attachment on inspection'],
      ['7', 'Firewall / ports', 'Users reach app URL'],
      ['8', 'Backups scheduled', 'Database + uploads folder'],
      ['9', 'Cron configured', 'Optional alerts endpoint responds 200'],
    ]
  ),

  pageBreak(),

  h1('15. Troubleshooting'),
  h2('15.1 Database'),
  table(
    ['Symptom', 'Likely cause', 'Resolution'],
    [
      ['Connection refused', 'PostgreSQL stopped or wrong host', 'Start service; fix DATABASE_URL'],
      ['Database does not exist', 'DB not created', 'CREATE DATABASE in psql'],
      ['Auth fails inside Docker', 'localhost in URL', 'Use DOCKER_PG_HOST or remote host IP'],
    ]
  ),
  spacer(),

  h2('15.2 Authentication'),
  table(
    ['Symptom', 'Likely cause', 'Resolution'],
    [
      ['Login succeeds then logs out', 'AUTH_URL mismatch or secure cookies on HTTP', 'Match AUTH_URL; set AUTH_COOKIE_SECURE=false'],
      ['UntrustedHost error', 'Missing trust host', 'AUTH_TRUST_HOST=true in .env and compose'],
      ['Invalid credentials', 'User not seeded', 'Run db:init; check employee_id case'],
      ['Account deactivated', 'status != active', 'Admin reactivates user in database or UI'],
    ]
  ),
  spacer(),

  h2('15.3 Build and runtime'),
  table(
    ['Symptom', 'Likely cause', 'Resolution'],
    [
      ['Build blocked: next dev running', 'Dev server lock', 'Stop npm run dev; npm run clean; rebuild'],
      ['ENOTCACHED offline install', 'Incomplete cache', 'Run vendor:npm-cache on connected PC'],
      ['Port in use', 'Another process on 3000', 'Change PORT or stop conflicting service'],
      ['Upload fails', 'Permissions', 'chmod/chown uploads directory or Docker uid 1001'],
    ]
  ),
  spacer(),

  h2('15.4 Docker'),
  ...bullets([
    'docker logs qms — view application errors',
    'docker compose ps — confirm container running',
    'Verify volume mount: docker inspect qms',
    'Recreate after image update: docker compose up -d --force-recreate',
  ]),

  h1('16. Quick Command Reference'),
  table(
    ['Task', 'Command'],
    [
      ['Install (online)', 'npm install'],
      ['Install (offline)', 'npm run install:offline'],
      ['Dev server', 'npm run dev'],
      ['Production build', 'npm run build'],
      ['Production run', 'npm start'],
      ['DB init', 'npm run db:init'],
      ['DB migrate', 'npm run db:migrate'],
      ['Docker build', 'docker build -t qms:latest .'],
      ['Docker save', 'docker save qms:latest -o qms-image.tar'],
      ['Docker load', 'docker load -i qms-image.tar'],
      ['Docker start', 'docker compose up -d'],
      ['Regenerate this guide', 'npm run docs:deployment'],
    ]
  ),

  spacer(),
  p('Related documents: deploy/README.md, SETUP.md, OFFLINE_DEPLOYMENT_GUIDE.md, DEPLOYMENT_CHECKLIST.md, docs/QMS_Technical_Documentation.docx', {
    italic: true,
  }),
  p(`— End of guide. Generated ${DATE}.`, { italic: true }),
];

const doc = new Document({
  title: 'QMS Deployment and Configuration Guide',
  creator: 'QMS',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
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
