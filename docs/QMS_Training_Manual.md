# CABS Quality Management System — Training Manual

| Field | Value |
|-------|-------|
| Document version | 1.0 |
| Application | CABS Quality Management System (QMS) |
| Audience | Trainers, new users, role-specific trainees |
| Companion materials | `QMS_Training_Presentation.pptx`, `COMPLETE_USER_MANUAL.md` |
| Last updated | May 2026 |

---

## How to Use This Manual

This manual is designed for **instructor-led training** and **self-paced onboarding**. It complements the slide deck (`npm run training:ppt`) and the complete user manual (`docs/COMPLETE_USER_MANUAL.md`).

| Your role | Start with | Then complete |
|-----------|------------|---------------|
| All users | Module 1 — Orientation | Module 2 — Navigation & security |
| Initiator / Designer | Module 3 | Exercise 3.1 |
| Request Approver | Module 4 | Exercise 4.1 |
| QA Head | Module 5 | Exercise 5.1 |
| Team Head — QA | Module 6 | Exercise 6.1 |
| Inspector / QA Rep | Module 7 | Exercise 7.1 |
| ORDAQA users | Module 8 | Exercise 8.1 |
| Administrator | Module 9 | Exercise 9.1 |
| Full team | Module 10 — End-to-end walkthrough | Assessment checklist |

**Training duration (typical):**

- Half-day (3–4 hours): Modules 1–2 + one role track + Module 10 overview  
- Full day (6–7 hours): All modules + hands-on end-to-end exercise  
- Administrator add-on: +2 hours for Module 9  

---

## Module 1 — Orientation

### Learning objectives

After this module, participants can:

- Describe what QMS replaces and what business process it supports  
- Name the main user roles and where each fits in the workflow  
- Explain the difference between **Send back**, **Reject**, and **Approve & Close**  

### 1.1 What is QMS?

The CABS Quality Management System is a web application for **Request for R&QA Inspection/Testing** records. It digitizes the paper CABS form workflow:

- Part I — Designer / initiator request  
- Part II — R&QA office (QA Head nomination, Team Head assignment)  
- Part III — ORDAQA office (when required)  
- Part IV — Inspection report (inspectors)  
- Part V — ORDAQA clearance (when required)  

The system provides role-based access, in-app notifications, printable CABS PDFs, filtered reports, and an audit trail of workflow actions.

### 1.2 Standard workflow (overview)

```
Initiator          Request Approver       QA Head           Team Head QA        Inspector
   |                      |                  |                    |                  |
   |-- Submit Part I ---->|                  |                    |                  |
   |                      |-- Forward ------>|                    |                  |
   |                      |   (or Send back / Reject)            |                  |
   |                      |                  |-- Part II Step 1 ->|                  |
   |                      |                  |   nominate TH-QA   |                  |
   |                      |                  |                    |-- Assign ------->|
   |                      |                  |                    |-- Start -------->|
   |                      |                  |                    |                  |-- Part IV
   |                      |                  |                    |<-- Complete -----|
   |                      |                  |                    |-- Approve & Close|
```

### 1.3 Roles at a glance

| Role | Primary responsibility |
|------|------------------------|
| Initiator / Designer | Create Part I, submit, correct when returned |
| Request Approver | Forward, send back, or reject Part I |
| QA Head | Part II Step 1; nominate Team Head — QA; ORDAQA routing |
| Team Head — QA | Assign inspectors, start/complete inspection, close |
| Inspector / QA Rep | Part IV findings, checklists, evidence |
| ORDAQA Head / Inspector | Part III / Part V when ORDAQA is required |
| Administrator | Users, projects, inspection types, settings, full access |

### 1.4 Key statuses (trainees must recognize)

| Status | Meaning |
|--------|---------|
| Draft | Saved, not yet submitted |
| Pending request approval | Waiting for Request Approver |
| Forwarded | Sent to QA Head for Part II |
| Returned to designer | Part I needs correction |
| Assigned | Inspector(s) nominated |
| In progress | Inspection work started |
| Inspection completed | Ready for Team Head review |
| Completed / Closed | Final state; read-only for workflow edits |
| Rejected | Workflow ended with reason |

### Discussion questions

1. When would you use **Send back** instead of **Reject**?  
2. Who can edit Part I after the request is forwarded?  
3. What happens to a closed request if someone needs a printable form?

---

## Module 2 — Access, Layout, and Security

### Learning objectives

Participants can sign in, navigate the application, manage their profile, and understand session timeout behaviour.

### 2.1 Signing in

1. Open the QMS URL provided by your administrator.  
2. Enter your **Employee ID** (the system normalizes to uppercase).  
3. Enter your **password**.  
4. Select **Sign In**.

**Common issues:**

| Message | Action |
|---------|--------|
| Invalid Employee ID or password | Verify credentials; check Caps Lock |
| Account deactivated | Contact administrator |
| Session expired (idle) | Sign in again; use **Stay Logged In** when warned |

### 2.2 Application layout

| Area | Purpose |
|------|---------|
| **Header** | Search, theme toggle, notifications, profile menu |
| **Sidebar** | Dashboard, Inspection Request, Reports, admin menus (by role) |
| **Main content** | Current page or form |
| **Footer** | Copyright and support links |

**Sidebar by role:**

- **All users:** Dashboard, Inspection Request (if permitted), Reports, Profile  
- **Administrators:** Projects, Inspection Types, Users, Settings  

### 2.3 Session timeout

- **5 minutes** of inactivity triggers automatic logout  
- A warning appears at **4 minutes** — select **Stay Logged In** to continue  

### 2.4 Profile and password

1. Open the profile menu (top right) or **Profile** in the sidebar.  
2. To change password: **Change Password** → current password → new password (min. 6 characters) → confirm.  

### Hands-on exercise 2.1 — First login

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Sign in with your training account | Dashboard opens with your name and role |
| 2 | Toggle light/dark theme | Theme changes across the app |
| 3 | Open notification bell | Panel opens (may be empty in training) |
| 4 | Open Profile | Your employee ID, designation, and role display |
| 5 | Sign out and sign in again | Successful return to Dashboard |

---

## Module 3 — Initiator / Designer Training

### Learning objectives

Participants can create an inspection request (Part I), submit it for approval, and correct a returned request.

### 3.1 Dashboard (initiator view)

- **New IR** — start a new request  
- Statistics: your requests, drafts, pending items  
- **Action Required** / **Review Now** — shortcuts to drafts or returned requests  

### 3.2 Create a new inspection request

1. Select **New IR** (Dashboard or Inspection Request list).  
2. Complete **Part I** sections:

   - **IR Number** — auto-generated  
   - **Programme / Project** → **Subsystem** → **LRU** → **SRU** (cascading dropdowns)  
   - **Serial numbers**, quantity, SO details, source, OEM  
   - **Inspection details** — stage, mode, dates, venue  
   - **Document rows** — TS, SOP/MDI, QAP, etc.  
   - **Confirmations** — logbook, instruments, joint inspection  
   - **Certifying Request Approver** — select from hierarchy  

3. Upload **logbook** if “Log Book Copy Attached” is **Yes**.  
4. Select **Submit for Approval** (or save as draft if your deployment allows).  

### 3.3 After submission

- Request status becomes **Pending request approval**  
- Request Approver in your reporting chain receives a notification  
- You can view the request but cannot edit Part I until it is **returned**  

### 3.4 When the request is returned

1. Open the request (Dashboard, notifications, or list).  
2. Read the **send-back comment**.  
3. Select **Edit Part I** (or equivalent action).  
4. Correct fields, save, and **Resubmit for Request Approver**.  

### Hands-on exercise 3.1 — Submit Part I

Use a training project and LRU provided by your instructor.

| Step | Action | Checkpoint |
|------|--------|------------|
| 1 | Create new IR with all required fields | No validation errors |
| 2 | Attach logbook if required | File appears in attachments |
| 3 | Select correct Request Approver | Matches your reporting chain |
| 4 | Submit for approval | Status = pending request approval |
| 5 | (Instructor) Send back with comment | You see returned status |
| 6 | Edit Part I per comment and resubmit | Status returns to pending approval |

### Initiator pitfalls

- Wrong project / LRU / serial — fix master data with admin before training production data  
- Missing logbook when “attached = Yes” — submission blocked  
- Wrong certifying approver — request routes to wrong person  

---

## Module 4 — Request Approver Training

### Learning objectives

Participants can review Part I, forward acceptable requests, send back for correction, or reject with a reason.

### 4.1 Finding work

- Dashboard **Review Now** or **Action Required**  
- Inspection Request list — filter or look for **Action Required** badge  
- Notifications — “pending forward” or similar  

### 4.2 Review checklist

Before forwarding, verify:

- [ ] Programme, item, and serial numbers are correct  
- [ ] Document references and confirmations are complete  
- [ ] Logbook attached when required  
- [ ] Certifying approver and designer details are correct  
- [ ] Venue and inspection dates are reasonable  

### 4.3 Actions

| Button | When to use | Result |
|--------|-------------|--------|
| **Forward Request** | Part I is acceptable | Request goes to QA Head |
| **Send back** | Part I can be corrected | Returned to designer with comment |
| **Reject** | Request must not continue | Rejected with reason; workflow ends |

### Hands-on exercise 4.1 — Forward and send back

| Step | Action | Checkpoint |
|------|--------|------------|
| 1 | Open trainee’s submitted request | Part I visible |
| 2 | Send back with comment “Fix serial number” | Initiator sees returned status |
| 3 | After resubmit, forward request | Status = forwarded to QA |
| 4 | (Optional) Reject a second training request | Rejected status; initiator notified |

---

## Module 5 — QA Head Training

### Learning objectives

Participants can complete Part II Step 1, indicate ORDAQA requirement, and nominate Team Head — QA.

### 5.1 When you act

After Request Approver **forwards** the request, it appears in your queue (forwarded / pending Part II).

### 5.2 Fill Part II Step 1

1. Open the request → **Part II** tab or **Fill Part II**.  
2. Enter **Head R&QA comments**.  
3. Set **ORDAQA involvement** if applicable.  
4. **Nominate Team Head — QA**.  
5. Enter third-party / outstation details if needed.  
6. Save Part II.  

The nominated Team Head can then assign inspectors.

### Hands-on exercise 5.1 — Part II nomination

| Step | Action | Checkpoint |
|------|--------|------------|
| 1 | Open forwarded training request | Part II editable |
| 2 | Enter comments and nominate Team Head | Nominee saved |
| 3 | Set ORDAQA = No (unless exercise requires Yes) | Routing correct for Module 8 |
| 4 | Save | Team Head sees request in their queue |

---

## Module 6 — Team Head — QA Training

### Learning objectives

Participants can assign inspectors, start inspection, complete inspection, and approve & close.

### 6.1 Assign inspectors (Part II Step 2)

1. Open request where you are nominated.  
2. **Part II** → select one or more **Inspector / QA Rep** users.  
3. Save → status **Assigned**; inspectors notified.  

### 6.2 Start inspection

- Select **Start Inspection** when assignments are correct  
- Status → **In progress**  

### 6.3 Complete and close

| Step | Action |
|------|--------|
| 1 | Inspectors complete Part IV (and checklists as required) |
| 2 | Team Head reviews → **Complete Inspection** |
| 3 | After review → **Approve & Close** |
| 4 | Request becomes read-only; use **Print PDF** or Reports for output |

### 6.4 Send back before assignment

If Part I must be corrected **before** inspectors are assigned, use **Send back** with a clear comment. The request returns to the initiator and must pass Request Approver and QA Head again after resubmission.

### Hands-on exercise 6.1 — Assign through close

| Step | Action | Checkpoint |
|------|--------|------------|
| 1 | Assign training inspector(s) | Status = assigned |
| 2 | Start inspection | Status = in progress |
| 3 | (Inspector completes Part IV — Module 7) | Part IV saved |
| 4 | Complete inspection | Inspection completed |
| 5 | Approve & close | Completed / closed; read-only |

---

## Module 7 — Inspector / QA Rep Training

### Learning objectives

Participants can start assigned work, record Part IV, use checklists, and upload evidence.

### 7.1 Your queue

- Dashboard shows **assigned** and **in progress** counts  
- Open requests from list or notifications  

### 7.2 Start inspection

When status is **Assigned**, select **Start Inspection** (if not already started by Team Head).

### 7.3 Part IV — inspection report

Record in **Part IV** tab:

- Details of inspection / test performed  
- Items offered, accepted, observations, rejected quantity  
- Observations, action required, closure dates, remarks  
- Save after each meaningful update  

### 7.4 Checklists

1. Open **Checklists** tab → **Add Checklist**.  
2. Add items; set pass/fail/N/A, findings, corrective action, notes.  
3. **Complete** when finished; reopen only if permitted and necessary.  

### 7.5 Attachments

- Use **Attachments** tab for evidence (photos, reports)  
- Follow size/type limits shown on screen  

### Hands-on exercise 7.1 — Record inspection

| Step | Action | Checkpoint |
|------|--------|------------|
| 1 | Open assigned training request | Part IV tab available in progress |
| 2 | Enter inspection details and quantities | Data saves without error |
| 3 | Add checklist with 3+ items | Items marked with results |
| 4 | Upload one attachment | File listed and downloadable |
| 5 | Notify Team Head | Ready for complete/close in Module 6 |

---

## Module 8 — ORDAQA Training (when applicable)

### Learning objectives

Participants understand when ORDAQA is involved and how Part III / Part V fit the workflow.

### 8.1 Trigger

QA Head sets **ORDAQA involvement** in Part II. ORDAQA Head and ORDAQA Inspector roles then act on Part III and Part V.

### 8.2 ORDAQA Inspector

- Complete **Part III** — received date, observations, clearance fields  
- May **send back** to designer for Part I corrections (request re-enters full chain)  

### 8.3 ORDAQA Head

- Reviews clearance and approves or sends back per deployment rules  

### Hands-on exercise 8.1 — ORDAQA path (optional)

Run only when training environment includes ORDAQA accounts and a request flagged for ORDAQA.

| Step | Action | Checkpoint |
|------|--------|------------|
| 1 | QA Head sets ORDAQA = Yes on training IR | ORDAQA users see request |
| 2 | ORDAQA Inspector fills Part III | Part III saved |
| 3 | ORDAQA Head completes clearance | Workflow continues to inspection/close |

---

## Module 9 — Reports and Printable Output

### Learning objectives

Participants can generate filtered reports and print official CABS PDFs.

### 9.1 Print PDF (single request)

1. Open inspection request.  
2. Select **Print PDF**.  
3. Review formatted output in new tab → browser **Print** or **Save as PDF**.  

Signatures appear when uploaded in User Management.

### 9.2 Reports module

1. Open **Reports** from sidebar.  
2. Select report type (e.g. Inspection Requests).  
3. Choose output: **View on screen**, PDF, Word, or Excel (if enabled).  
4. Apply filters: project, designer, status group, date range.  
5. Select **Generate**.  

### Hands-on exercise 9.1 — Report

| Step | Action | Checkpoint |
|------|--------|------------|
| 1 | Generate on-screen report for last 30 days | Rows display |
| 2 | Export or download PDF/Excel | File opens successfully |
| 3 | Print PDF from a completed training IR | All parts visible per role |

---

## Module 10 — Administrator Training

### Learning objectives

Administrators can maintain users, project hierarchy, inspection types, and settings.

### 10.1 User management

**Users** → **New User**:

- Employee ID, name, email, initial password  
- Designation, department, **role**, **Reports To**  
- Active status; optional **signature** upload (PNG/JPEG)  

Keep reporting hierarchy aligned with Request Approver chains.

### 10.2 Project hierarchy

**Projects** → Project → Subsystem → LRU → SRU → **serial numbers**

This drives inspection form dropdowns. Add serial numbers **before** initiators need them in production.

### 10.3 Inspection types

**Inspection Types** — categories and items for “inspection stage offered” and related fields. Only **active** items should appear in live forms.

### 10.4 Settings

Organization, notification, security, and regional preferences (availability depends on deployment).

### Hands-on exercise 10.1 — Master data

| Step | Action | Checkpoint |
|------|--------|------------|
| 1 | Create test user with initiator role | User can sign in |
| 2 | Add serial number under training LRU | Appears on new IR form |
| 3 | Add inspection type item | Appears in stage dropdown |
| 4 | Upload signature for test user | Visible on Print PDF where applicable |

---

## Module 11 — End-to-End Training Exercise

### Scenario

Walk one inspection request through every role using training accounts (or `npm run training:seed-workflow` sample data).

| # | Role | Action | Verify |
|---|------|--------|--------|
| 1 | Initiator | Create and submit Part I | Pending request approval |
| 2 | Request Approver | Forward | Forwarded to QA |
| 3 | QA Head | Part II + nominate Team Head | Nomination saved |
| 4 | Team Head QA | Assign inspector(s) | Assigned |
| 5 | Team Head QA | Start inspection | In progress |
| 6 | Inspector | Part IV + checklist + attachment | Data saved |
| 7 | Team Head QA | Complete inspection | Inspection completed |
| 8 | Team Head QA | Approve & close | Closed; read-only |
| 9 | Any | Print PDF + generate report | Outputs correct |

**Debrief topics:** notifications received, send-back path, ORDAQA branch, common mistakes.

---

## Assessment — Role Competency Checklist

Trainers sign off when the trainee completes all items for their role.

### All users

- [ ] Sign in and sign out correctly  
- [ ] Explain session timeout behaviour  
- [ ] Use notifications and open linked requests  
- [ ] Change own password  

### Initiator

- [ ] Create complete Part I request  
- [ ] Submit and track status  
- [ ] Correct and resubmit after send-back  

### Request Approver

- [ ] Forward valid request  
- [ ] Send back with clear comment  
- [ ] Reject with reason when appropriate  

### QA Head

- [ ] Complete Part II Step 1 and nominate Team Head  
- [ ] Set ORDAQA flag correctly  

### Team Head — QA

- [ ] Assign inspectors  
- [ ] Start, complete, and close inspection  

### Inspector

- [ ] Record Part IV and checklist  
- [ ] Upload evidence  

### Administrator

- [ ] Create/edit user with correct role and Reports To  
- [ ] Maintain project/serial master data  
- [ ] Configure inspection type item  

---

## Trainer Guide

### Before the session

1. Confirm QMS URL and training accounts (see `scripts/generate-training-ppt.mjs` for sample IDs).  
2. Run `npm run training:seed-workflow` if using demo requests (`TRAIN-WF-*`).  
3. Generate slides: `npm run training:ppt` (requires dev server running).  
4. Distribute this manual and note companion Word export: `npm run docs:training`.  

### Recommended agenda (full day)

| Time | Content |
|------|---------|
| 09:00–09:45 | Module 1 — Orientation |
| 09:45–10:30 | Module 2 — Access & layout |
| 10:30–12:00 | Role tracks (split groups or sequential demos) |
| 12:00–13:00 | Lunch |
| 13:00–14:30 | Hands-on exercises 3–7 by role |
| 14:30–15:15 | Module 9 — Reports & PDF |
| 15:15–16:30 | Module 11 — End-to-end + assessment |
| 16:30–17:00 | Q&A, admin topics if needed |

### Split-room training

- **Room A:** Initiators + Request Approvers (Modules 3–4)  
- **Room B:** QA Head + Team Head + Inspectors (Modules 5–7)  
- **Merge:** Module 11 end-to-end with scripted handoffs  

### Evaluation

- Practical: complete assessment checklist  
- Optional written quiz: status names, Send back vs Reject, which part each role owns  

---

## Quick Reference Card

| I need to… | Go to… | Button / tab |
|------------|--------|----------------|
| Create request | Dashboard / Inspection Request | New IR |
| Fix returned request | Request detail | Edit Part I → Resubmit |
| Approve Part I | Request detail | Forward / Send back / Reject |
| Nominate Team Head | Request detail | Part II |
| Assign inspector | Part II | Assign inspector(s) |
| Record findings | Part IV | Save |
| Print official form | Request detail | Print PDF |
| Run management report | Reports | Generate |
| Add serial number | Projects (admin) | LRU → Serial numbers |
| Fix missing menu | Contact admin | Role / permission update |

---

## Related Documentation

| Document | Purpose | Command |
|----------|---------|---------|
| `QMS_Training_Presentation.pptx` | Slide deck with screenshots | `npm run training:ppt` |
| `COMPLETE_USER_MANUAL.md` | Detailed reference for all screens | — |
| `QMS_Training_Manual.docx` | This manual (Word) | `npm run docs:training` |
| `QMS_Technical_Documentation.docx` | Architecture & APIs | `npm run docs:technical` |
| `QMS_Deployment_and_Configuration_Guide.docx` | Install & configure | `npm run docs:deployment` |

---

## Support

For training account issues, missing master data, or workflow questions during rollout, contact your **QMS administrator**.

For server, deployment, or integration issues, contact your **QMS support / deployment team**.

---

*TechFLUENT Solutions Pvt Ltd — CABS Quality Management System*
