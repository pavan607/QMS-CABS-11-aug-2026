/**
 * Capture QMS UI screenshots and build a training PowerPoint.
 * Usage: node scripts/generate-training-ppt.mjs
 * Requires: dev server at BASE_URL (default http://127.0.0.1:3000)
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import PptxGenJS from 'pptxgenjs';
import { seedTrainingWorkflow } from './seed-training-workflow.mjs';

const ROOT = process.cwd();
const BASE_URL = process.env.QMS_BASE_URL || 'http://127.0.0.1:3000';
const OUT_DIR = path.join(ROOT, 'docs', 'training-screenshots');
const PPT_PATH = path.join(
  ROOT,
  'docs',
  process.env.TRAINING_PPT_OUTPUT || 'QMS_Training_Presentation.pptx'
);
const LOGO = path.join(ROOT, 'public', 'logo.png');

const ADMIN = {
  id: process.env.TRAINING_ADMIN_ID || 'ADM001',
  password: process.env.TRAINING_ADMIN_PASSWORD || 'admin123',
};
const INITIATOR = {
  id: process.env.TRAINING_INITIATOR_ID || '1213',
  password: process.env.TRAINING_INITIATOR_PASSWORD || 'admin123',
};
const REQUEST_APPROVER = {
  id: process.env.TRAINING_APPROVER_ID || '1098',
  password: process.env.TRAINING_APPROVER_PASSWORD || 'admin123',
};
const QA_HEAD = {
  id: process.env.TRAINING_QA_HEAD_ID || '1035',
  password: process.env.TRAINING_QA_HEAD_PASSWORD || 'admin123',
};
const TEAM_HEAD = {
  id: process.env.TRAINING_TEAM_HEAD_ID || '1060',
  password: process.env.TRAINING_TEAM_HEAD_PASSWORD || 'admin123',
};
const INSPECTOR = {
  id: process.env.TRAINING_INSPECTOR_ID || '2389',
  password: process.env.TRAINING_INSPECTOR_PASSWORD || 'admin123',
};

const NAVY = '1E3A5F';
const TEAL = '0D9488';
const SLATE = '475569';
const LIGHT = 'F1F5F9';

async function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function waitForApp(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
}

async function screenshot(page, name, fullPage = false) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  return file;
}

async function login(page, employeeId, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  await page.locator('#employee_id').fill(employeeId);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await waitForApp(page);
}

async function logout(page) {
  await page.context().clearCookies();
}

async function gotoAndCapture(page, url, name, fullPage = false) {
  await page.goto(`${BASE_URL}${url}`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  return screenshot(page, name, fullPage);
}

async function captureInspectionWorkflow(page, inspectionId, name, { tab, loginAs } = {}) {
  if (loginAs) {
    await page.context().clearCookies();
    await login(page, loginAs.id, loginAs.password);
  }
  await page.goto(`${BASE_URL}/dashboard/inspections/${inspectionId}`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForApp(page);
  await page.waitForSelector('h2', { timeout: 25_000 }).catch(() => {});
  if (tab) {
    const tabBtn = page.getByRole('tab', { name: new RegExp(tab, 'i') });
    if (await tabBtn.count()) {
      await tabBtn.first().click();
      await waitForApp(page);
    }
  }
  const header = page.locator('div.flex.items-center.justify-between').first();
  const headerShot = path.join(OUT_DIR, `${name}-actions.png`);
  if (await header.count()) {
    await header.screenshot({ path: headerShot });
  }
  const full = await screenshot(page, name, true);
  return { full, actions: fs.existsSync(headerShot) ? headerShot : full };
}

function addTitleSlide(ppt, title, subtitle) {
  const slide = ppt.addSlide();
  slide.background = { color: NAVY };
  if (fs.existsSync(LOGO)) {
    slide.addImage({ path: LOGO, x: 0.45, y: 0.35, w: 1.1, h: 1.1 });
  }
  slide.addText(title, {
    x: 1.7,
    y: 1.35,
    w: 7.8,
    h: 1.2,
    fontSize: 36,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Calibri',
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 1.7,
      y: 2.55,
      w: 7.5,
      h: 1.5,
      fontSize: 18,
      color: 'CBD5E1',
      fontFace: 'Calibri',
    });
  }
  slide.addText('CABS Quality Management System', {
    x: 1.7,
    y: 6.55,
    w: 6,
    h: 0.4,
    fontSize: 12,
    color: '94A3B8',
  });
}

function addSectionSlide(ppt, title, bullets) {
  const slide = ppt.addSlide();
  slide.addShape(ppt.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.55,
    fill: { color: NAVY },
    line: { color: NAVY },
  });
  slide.addText(title, {
    x: 0.45,
    y: 0.08,
    w: 9,
    h: 0.45,
    fontSize: 22,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Calibri',
  });
  slide.addText(bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })), {
    x: 0.55,
    y: 0.95,
    w: 8.8,
    h: 5.8,
    fontSize: 16,
    color: '1E293B',
    fontFace: 'Calibri',
    valign: 'top',
  });
}

function addImageSlide(ppt, title, imagePath, notes, caption) {
  const slide = ppt.addSlide();
  slide.addShape(ppt.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.5,
    fill: { color: TEAL },
    line: { color: TEAL },
  });
  slide.addText(title, {
    x: 0.4,
    y: 0.07,
    w: 9.2,
    h: 0.38,
    fontSize: 20,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Calibri',
  });
  if (fs.existsSync(imagePath)) {
    slide.addImage({ path: imagePath, x: 0.35, y: 0.62, w: 9.3, h: 5.35, sizing: { type: 'contain', w: 9.3, h: 5.35 } });
  }
  if (caption) {
    slide.addText(caption, {
      x: 0.4,
      y: 6.05,
      w: 9.2,
      h: 0.35,
      fontSize: 11,
      italic: true,
      color: SLATE,
      fontFace: 'Calibri',
    });
  }
  if (notes) slide.addNotes(notes);
}

function addWorkflowSlide(ppt) {
  const slide = ppt.addSlide();
  slide.addShape(ppt.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.5, fill: { color: NAVY }, line: { color: NAVY } });
  slide.addText('Inspection Request Workflow', {
    x: 0.4,
    y: 0.07,
    w: 9,
    h: 0.38,
    fontSize: 20,
    bold: true,
    color: 'FFFFFF',
  });
  const steps = [
    '1. Initiator — Create & submit Part I',
    '2. Request Approver — Forward, send back, or reject',
    '3. QA Head — Part II Step 1, nominate Team Head',
    '4. Team Head QA — Assign inspectors, start inspection',
    '5. Inspector — Record Part IV findings & checklists',
    '6. Team Head QA — Complete, approve & close',
  ];
  slide.addText(
    steps.map((s) => ({ text: s, options: { bullet: true, breakLine: true } })),
    { x: 0.5, y: 0.75, w: 4.5, h: 5.5, fontSize: 15, color: '1E293B', valign: 'top' }
  );
  slide.addText('Key statuses', {
    x: 5.2,
    y: 0.75,
    w: 4.3,
    h: 0.35,
    fontSize: 14,
    bold: true,
    color: NAVY,
  });
  const statuses = [
    'Draft → Pending → Pending Request Approval',
    'Forwarded → Assigned → In Progress',
    'Inspection Completed → Completed (closed)',
    'Returned to Designer — corrections needed',
    'Rejected — workflow ends with reason',
  ];
  slide.addText(
    statuses.map((s) => ({ text: s, options: { bullet: true, breakLine: true } })),
    { x: 5.2, y: 1.15, w: 4.5, h: 4.8, fontSize: 13, color: SLATE, valign: 'top' }
  );
  slide.addNotes(
    'Use Send back when the initiator can correct Part I. Use Reject when the request must not continue. Closed requests are read-only.'
  );
}

async function captureScreenshots() {
  await ensureDir(OUT_DIR);
  const shots = { workflow: {} };

  console.log('Seeding workflow training samples...');
  const wfIds = await seedTrainingWorkflow();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    shots.login = await screenshot(page, '01-login');

    await login(page, ADMIN.id, ADMIN.password);
    shots.dashboard = await gotoAndCapture(page, '/dashboard', '02-dashboard');
    shots.inspections = await gotoAndCapture(page, '/dashboard/inspections', '03-inspections-list', true);
    shots.newIr = await gotoAndCapture(page, '/dashboard/inspections/new', '04-new-inspection-request', true);

    const detailHref = await page
      .locator('a[href^="/dashboard/inspections/"]')
      .evaluateAll((links) => {
        const href = links
          .map((a) => a.getAttribute('href'))
          .find((h) => h && /^\/dashboard\/inspections\/\d+/.test(h));
        return href || null;
      });
    if (detailHref) {
      shots.inspectionDetail = await gotoAndCapture(page, detailHref, '05-inspection-detail', true);
    }

    shots.reports = await gotoAndCapture(page, '/dashboard/reports', '06-reports', true);
    shots.projects = await gotoAndCapture(page, '/dashboard/projects', '07-projects', true);
    shots.users = await gotoAndCapture(page, '/dashboard/users', '08-users', true);
    shots.inspectionTypes = await gotoAndCapture(page, '/dashboard/inspection-types', '09-inspection-types', true);
    shots.settings = await gotoAndCapture(page, '/dashboard/settings', '10-settings', true);
    shots.profile = await gotoAndCapture(page, '/dashboard/profile', '11-profile');

    await logout(page);
    await login(page, INITIATOR.id, INITIATOR.password);
    shots.dashboardInitiator = await gotoAndCapture(page, '/dashboard', '12-dashboard-initiator');

    console.log('Capturing workflow stage screenshots...');
    shots.workflow.submit = await captureInspectionWorkflow(page, wfIds['01-DRAFT'], 'wf-01-initiator-submit', {
      loginAs: INITIATOR,
    });
    shots.workflow.forward = await captureInspectionWorkflow(page, wfIds['02-PENDING-FORWARD'], 'wf-02-approver-forward', {
      loginAs: REQUEST_APPROVER,
    });
    shots.workflow.returned = await captureInspectionWorkflow(page, wfIds['03-RETURNED'], 'wf-03-returned-designer', {
      loginAs: INITIATOR,
    });
    shots.workflow.qaPart2 = await captureInspectionWorkflow(page, wfIds['04-QA-PART2'], 'wf-04-qa-head-part2', {
      loginAs: QA_HEAD,
      tab: 'Part II',
    });
    shots.workflow.assign = await captureInspectionWorkflow(page, wfIds['05-ASSIGN'], 'wf-05-team-head-assign', {
      loginAs: TEAM_HEAD,
      tab: 'Part II',
    });
    shots.workflow.start = await captureInspectionWorkflow(page, wfIds['06-ASSIGNED'], 'wf-06-inspector-start', {
      loginAs: INSPECTOR,
    });
    shots.workflow.part4 = await captureInspectionWorkflow(page, wfIds['07-IN-PROGRESS'], 'wf-07-inspector-part4', {
      loginAs: INSPECTOR,
      tab: 'Part IV',
    });
    shots.workflow.approveClose = await captureInspectionWorkflow(page, 63, 'wf-08-approve-close', {
      loginAs: TEAM_HEAD,
    });
    shots.workflow.completed = await captureInspectionWorkflow(page, 69, 'wf-09-completed', {
      loginAs: ADMIN,
    });
  } finally {
    await browser.close();
  }

  return shots;
}

async function buildPresentation(shots) {
  const ppt = new PptxGenJS();
  ppt.author = 'QMS';
  ppt.title = 'CABS QMS User Training';
  ppt.subject = 'Quality Management System training';
  ppt.layout = 'LAYOUT_16x9';

  addTitleSlide(
    ppt,
    'CABS Quality Management System',
    'End-user training — inspection requests, workflow, and administration'
  );

  addSectionSlide(ppt, 'What is QMS?', [
    'Web application for CABS Request for R&QA Inspection/Testing records.',
    'Replaces paper-based movement with a role-based digital workflow.',
    'Covers request creation, approval, QA review, inspector assignment, reporting, and closure.',
    'Includes notifications, printable CABS forms, and summary reports.',
    'Access via the URL provided by your administrator (modern browser recommended).',
  ]);

  addImageSlide(
    ppt,
    'Signing In',
    shots.login,
    'Enter Employee ID and password. IDs are normalized to uppercase. Contact admin if account is deactivated.',
    'Sign In screen — use your Employee ID and password'
  );

  addSectionSlide(ppt, 'Application Layout', [
    'Header: branding, search, theme toggle, notifications, profile menu.',
    'Sidebar: Dashboard, Inspection Request, Reports, Profile, and admin menus by role.',
    'Main content: the page or form you selected.',
    'Session timeout: 5 minutes of inactivity (warning at 4 minutes).',
  ]);

  addImageSlide(
    ppt,
    'Dashboard (Administrator)',
    shots.dashboard,
    'Role-specific statistics, recent inspections, notifications, and Action Required / Review Now when workflow items are pending.',
    'Home page after login — overview tailored to your role'
  );

  addImageSlide(
    ppt,
    'Dashboard (Initiator / Designer)',
    shots.dashboardInitiator,
    'Initiators see their requests, drafts, pending items, and shortcuts to create a new IR.',
    'Designer view — focused on own inspection requests'
  );

  addWorkflowSlide(ppt);

  addSectionSlide(ppt, 'Workflow in the Application', [
    'Each role sees action buttons on the inspection detail page when the request status matches their step.',
    'Status badge (top right) shows where the request is in the lifecycle.',
    'Part I–V tabs hold form sections; workflow buttons sit above the tabs.',
    'Training samples below use demo request numbers prefixed TRAIN-WF- plus live completed examples.',
  ]);

  const wfSlides = [
    {
      title: 'Step 1 — Initiator: Submit for Approval',
      shot: shots.workflow?.submit,
      notes: 'Designer completes Part I and selects Submit for Approval. Edit Part I is available while status is draft, pending, or returned.',
      caption: 'Initiator view — Submit for Approval',
    },
    {
      title: 'Step 2 — Request Approver: Forward / Send Back / Reject',
      shot: shots.workflow?.forward,
      notes: 'Request Approver reviews Part I. Forward Request sends the IR to QA. Send back returns it to the designer with a comment. Reject ends the workflow.',
      caption: 'Request Approver — pending forward actions',
    },
    {
      title: 'Step 3 — Returned to Designer',
      shot: shots.workflow?.returned,
      notes: 'Initiator sees Returned to Designer status and the approver comment. They edit Part I and resubmit for approval.',
      caption: 'Returned for Part I corrections',
    },
    {
      title: 'Step 4 — QA Head: Fill Part II',
      shot: shots.workflow?.qaPart2,
      notes: 'After forward, QA Head completes Part II Step 1 (Head R&QA comments) and nominates Team Head – QA.',
      caption: 'QA Head — Part II nomination',
    },
    {
      title: 'Step 5 — Team Head QA: Assign Inspector(s)',
      shot: shots.workflow?.assign,
      notes: 'Nominated Team Head opens Part II Step 2 to assign one or more Inspector / QA Reps.',
      caption: 'Team Head — assign inspectors in Part II',
    },
    {
      title: 'Step 6 — Inspector: Start Inspection',
      shot: shots.workflow?.start,
      notes: 'Assigned inspector selects Start Inspection when the request is in Assigned status.',
      caption: 'Inspector — Start Inspection',
    },
    {
      title: 'Step 7 — Inspector: Record Part IV',
      shot: shots.workflow?.part4,
      notes: 'During In Progress, inspectors record observations, quantities, and checklist results in Part IV.',
      caption: 'Inspector — Part IV during inspection',
    },
    {
      title: 'Step 8 — Team Head QA: Approve & Close',
      shot: shots.workflow?.approveClose,
      notes: 'When status is Inspection Completed, Team Head – QA reviews Part IV and selects Approve & Close.',
      caption: 'Team Head — Approve & Close',
    },
    {
      title: 'Step 9 — Completed (Read-Only)',
      shot: shots.workflow?.completed,
      notes: 'Closed requests are read-only for normal workflow editing. Use Print PDF or Reports for output.',
      caption: 'Completed request — final state',
    },
  ];

  for (const s of wfSlides) {
    if (s.shot?.full) {
      addImageSlide(ppt, s.title, s.shot.full, s.notes, s.caption);
    }
  }

  addImageSlide(
    ppt,
    'Inspection Request List',
    shots.inspections,
    'Filter and search requests. Open a row to view or act on workflow steps permitted for your role.',
    'All inspection requests visible to your role'
  );

  addImageSlide(
    ppt,
    'Create New Inspection Request (Part I)',
    shots.newIr,
    'Part I captures programme, item details, SO/equipment data, inspection details, and certifying approver. IR number is auto-generated.',
    'Request for R&QA Inspection/Testing — Part I form'
  );

  addImageSlide(
    ppt,
    'Reports',
    shots.reports,
    'Generate printable CABS inspection forms and summary reports from completed or in-progress requests as allowed.',
    'Reports module'
  );

  addImageSlide(
    ppt,
    'Projects & Equipment Hierarchy',
    shots.projects,
    'Administrators maintain programmes, subsystems, LRUs, SRUs, and serial numbers used on inspection forms.',
    'Admin — project / LRU master data'
  );

  addImageSlide(
    ppt,
    'User Management',
    shots.users,
    'Administrators manage users, roles, reporting hierarchy, designations, and signatures.',
    'Admin — users and roles'
  );

  addImageSlide(
    ppt,
    'Inspection Types & Checklists',
    shots.inspectionTypes,
    'Configure inspection type groups and checklist items used during inspection.',
    'Admin — inspection type configuration'
  );

  addImageSlide(
    ppt,
    'System Settings',
    shots.settings,
    'System-wide configuration (deployment-specific options).',
    'Admin — settings'
  );

  addImageSlide(
    ppt,
    'Profile & Password',
    shots.profile,
    'Users can update profile details and change password from the Profile page or profile menu.',
    'Profile — account and password'
  );

  addSectionSlide(ppt, 'Roles at a Glance', [
    'Initiator / Designer — create and submit Part I; correct when sent back.',
    'Request Approver — forward, send back, or reject in reporting chain.',
    'QA Head — Part II Step 1; nominate Team Head - QA.',
    'Team Head - QA — assign inspectors, start/complete inspection, close.',
    'Inspector / QA Rep — Part IV findings and checklists.',
    'ORDAQA roles — when ORDAQA involvement is required.',
    'Administrator — full access including master data and users.',
  ]);

  const closing = ppt.addSlide();
  closing.background = { color: LIGHT };
  closing.addText('Thank You', {
    x: 0.5,
    y: 2.2,
    w: 9,
    h: 0.8,
    fontSize: 40,
    bold: true,
    color: NAVY,
    align: 'center',
  });
  closing.addText('Questions? Contact your QMS administrator or refer to the Complete User Manual.', {
    x: 0.8,
    y: 3.2,
    w: 8.4,
    h: 1.2,
    fontSize: 16,
    color: SLATE,
    align: 'center',
  });
  if (fs.existsSync(LOGO)) {
    closing.addImage({ path: LOGO, x: 4.45, y: 4.5, w: 1.1, h: 1.1 });
  }

  try {
    await ppt.writeFile({ fileName: PPT_PATH });
    return PPT_PATH;
  } catch (err) {
    if (err?.code === 'EBUSY') {
      const alt = path.join(ROOT, 'docs', 'QMS_Training_Presentation_updated.pptx');
      console.warn(`File locked (${PPT_PATH}); writing to ${alt}`);
      await ppt.writeFile({ fileName: alt });
      return alt;
    }
    throw err;
  }
}

async function main() {
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Capturing screenshots...');
  const shots = await captureScreenshots();
  console.log('Building PowerPoint...');
  const written = await buildPresentation(shots);
  console.log(`\nDone.`);
  console.log(`  Screenshots: ${OUT_DIR}`);
  console.log(`  Presentation: ${written || PPT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
