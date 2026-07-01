# CABS Quality Management System (QMS)
# User Manual

**Document Version:** 1.0  
**Date:** March 2026  
**System:** Request for R&QA Inspection/Testing — Web Application

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
   - 2.1 [System Requirements](#21-system-requirements)
   - 2.2 [Logging In](#22-logging-in)
   - 2.3 [Navigating the Application](#23-navigating-the-application)
3. [User Roles and Responsibilities](#3-user-roles-and-responsibilities)
   - 3.1 [Initiator / Designer](#31-initiator--designer)
   - 3.2 [Request Approver](#32-request-approver)
   - 3.3 [QA Head](#33-qa-head)
   - 3.4 [Team Head - QA](#34-team-head---qa)
   - 3.5 [Inspector / QA Rep](#35-inspector--qa-rep)
   - 3.6 [Administrator](#36-administrator)
4. [Dashboard](#4-dashboard)
   - 4.1 [Dashboard Overview](#41-dashboard-overview)
   - 4.2 [Role-Specific Statistics](#42-role-specific-statistics)
   - 4.3 [Review Now Action](#43-review-now-action)
   - 4.4 [Recent Inspections and Notifications](#44-recent-inspections-and-notifications)
5. [Inspection Request Workflow — Complete Guide](#5-inspection-request-workflow--complete-guide)
   - 5.1 [Workflow Overview](#51-workflow-overview)
   - 5.2 [Status Flow Diagram](#52-status-flow-diagram)
   - 5.3 [Step 1 — Creating a New Inspection Request (Part I)](#53-step-1--creating-a-new-inspection-request-part-i)
   - 5.4 [Step 2 — Submitting for Approval](#54-step-2--submitting-for-approval)
   - 5.5 [Step 3 — Request Approver: Forward or Reject](#55-step-3--request-approver-forward-or-reject)
   - 5.6 [Step 4 — QA Head: Part II (Step 1)](#56-step-4--qa-head-part-ii-step-1)
   - 5.7 [Step 5 — Team Head - QA: Assign Inspectors (Part II Step 2)](#57-step-5--team-head---qa-assign-inspectors-part-ii-step-2)
   - 5.8 [Step 6 — Team Head - QA: Start Inspection](#58-step-6--team-head---qa-start-inspection)
   - 5.9 [Step 7 — Inspector / QA Rep: Fill Part III and Part IV](#59-step-7--inspector--qa-rep-fill-part-iii-and-part-iv)
   - 5.10 [Step 8 — Team Head - QA: Complete Inspection](#510-step-8--team-head---qa-complete-inspection)
   - 5.11 [Step 9 — Team Head - QA: Approve and Close](#511-step-9--team-head---qa-approve-and-close)
6. [Inspection Request Form — Section Details](#6-inspection-request-form--section-details)
   - 6.1 [Part I — Details of Item(s) Offered for Inspection (Sections 1–21)](#61-part-i--details-of-items-offered-for-inspection-sections-121)
   - 6.2 [Part II — R&QA Office Use (Section 22)](#62-part-ii--rqa-office-use-section-22)
   - 6.3 [Part III — ORDAQA Office Use (Sections 23–25)](#63-part-iii--ordaqa-office-use-sections-2325)
   - 6.4 [Part IV — CABS R&QA Inspection Report (Sections 26–30)](#64-part-iv--cabs-rqa-inspection-report-sections-2630)
7. [Inspection Request List Page](#7-inspection-request-list-page)
   - 7.1 [Viewing Inspection Requests](#71-viewing-inspection-requests)
   - 7.2 [Filtering and Searching](#72-filtering-and-searching)
   - 7.3 [Action Required Indicators](#73-action-required-indicators)
8. [Inspection Request Detail Page](#8-inspection-request-detail-page)
   - 8.1 [Progress Tracker](#81-progress-tracker)
   - 8.2 [Viewing Request Details](#82-viewing-request-details)
   - 8.3 [Action Buttons](#83-action-buttons)
   - 8.4 [Activity Log](#84-activity-log)
9. [PDF Report — Print Output](#9-pdf-report--print-output)
10. [Projects Management](#10-projects-management)
    - 10.1 [Project Hierarchy](#101-project-hierarchy)
    - 10.2 [Managing Projects](#102-managing-projects)
    - 10.3 [Managing Subsystems](#103-managing-subsystems)
    - 10.4 [Managing LRUs](#104-managing-lrus)
    - 10.5 [Managing SRUs](#105-managing-srus)
    - 10.6 [Serial Number Management](#106-serial-number-management)
11. [Reports](#11-reports)
    - 11.1 [Generating Reports](#111-generating-reports)
    - 11.2 [Report Filters](#112-report-filters)
    - 11.3 [Viewing and Exporting Reports](#113-viewing-and-exporting-reports)
12. [User Management](#12-user-management)
    - 12.1 [Creating Users](#121-creating-users)
    - 12.2 [User Fields](#122-user-fields)
    - 12.3 [Organizational Hierarchy](#123-organizational-hierarchy)
    - 12.4 [Digital Signature Upload](#124-digital-signature-upload)
13. [Settings and Administration](#13-settings-and-administration)
14. [Appendix](#14-appendix)
    - A. [Status Reference Table](#a-status-reference-table)
    - B. [Role–Permission Matrix](#b-rolepermission-matrix)
    - C. [Keyboard Shortcuts and Tips](#c-keyboard-shortcuts-and-tips)

---

## 1. Introduction

The **CABS Quality Management System (QMS)** is a web-based application designed to manage the complete lifecycle of R&QA (Reliability & Quality Assurance) inspection requests. The system digitizes the traditional CABS (Centre for Airborne Systems) inspection form, enabling:

- **Paperless inspection workflow** from request creation through final closure
- **Role-based access control** ensuring each user sees only the information and actions relevant to their role
- **Hierarchical approval chains** where requests flow through designated approvers
- **Digital signatures** replacing physical signatures on inspection documents
- **Real-time dashboards** providing visibility into inspection status and workload
- **PDF report generation** producing formatted output matching the official CABS inspection form

The application supports multiple user roles, each with specific responsibilities in the inspection workflow, and enforces business rules to maintain process integrity.

---

## 2. Getting Started

### 2.1 System Requirements

- **Web Browser:** Google Chrome (recommended), Mozilla Firefox, Microsoft Edge, or Safari (latest versions)
- **Display:** Minimum 1280 x 720 resolution; optimized for desktop use
- **Network:** Internet or intranet connectivity to the QMS server

### 2.2 Logging In

1. Open your web browser and navigate to the QMS application URL.
2. On the **Login** screen, enter your credentials:
   - **Employee ID** — Your unique employee identifier (e.g., `DES001`, `TH002`, `INS001`)
   - **Password** — Your account password
3. Click the **Sign In** button.
4. Upon successful authentication, you will be redirected to the **Dashboard**.

**Important Notes:**

- **Session Timeout:** The system automatically logs you out after a period of inactivity. If this happens, you will see an "Idle Timeout" message on the login page. Simply log in again to continue.
- **Account Deactivation:** If your account has been deactivated by an administrator, you will see a notification. Contact your system administrator for assistance.
- **Incorrect Credentials:** If you enter wrong credentials, an error message will appear. Verify your Employee ID and password, then try again.

### 2.3 Navigating the Application

After logging in, you will see the main application layout consisting of:

- **Sidebar Navigation (Left Panel):** A collapsible menu providing access to all application sections. Click the hamburger icon to collapse or expand the sidebar.
- **Header Bar (Top):** Displays the current page title, a search bar, theme toggle (light/dark mode), notification bell, and your user profile menu.
- **Main Content Area (Center):** The primary workspace where page content is displayed.

**Navigation Menu Items:**

| Menu Item | Description | Access |
|-----------|-------------|--------|
| **Dashboard** | Overview with statistics, recent activity, and quick actions | All users |
| **Inspection Request** | Create, view, and manage inspection requests | All users with read permission |
| **Reports** | Generate and export inspection reports | All users |
| **Projects** | Manage projects, subsystems, LRUs, and SRUs | Administrators only |
| **Inspection Types** | Configure inspection type categories | Administrators only |
| **Users** | Manage user accounts and organizational hierarchy | Administrators only |
| **Settings** | System configuration | Administrators only |

**User Profile Menu (Top-Right):**
- Click your name/avatar to access **Settings** and **Sign Out**.

---

## 3. User Roles and Responsibilities

The QMS implements role-based access control. Each user is assigned one role that determines their permissions and responsibilities within the inspection workflow.

### 3.1 Initiator / Designer

**Internal Key:** `initiator`

**Description:** The person who creates and submits inspection requests. Typically a designer or engineer who needs an item inspected.

**Responsibilities:**
- Create new inspection requests by filling Part I of the CABS form
- Submit requests for approval to their reporting authority
- View the status and progress of their own requests
- Attach supporting documents (e.g., logbook copies)

**Access:**
- Can view only requests created by themselves
- Can edit their own requests while in `Draft` or `Pending` status
- Cannot view or access other users' requests

### 3.2 Request Approver

**Internal Key:** `request_approver`

**Description:** A team leader or divisional authority (typically DH or GD designation) who reviews and forwards inspection requests from their team members.

**Responsibilities:**
- Review inspection requests submitted by subordinates (users in their reporting hierarchy)
- **Forward** valid requests to the QA Head for further processing
- **Reject** requests that are incomplete or incorrect, providing a reason for rejection

**Access:**
- Can view all requests created by users who report to them (directly or indirectly through the organizational hierarchy)
- Cannot view requests from users outside their reporting chain

### 3.3 QA Head

**Internal Key:** `qa_head`

**Description:** The Head of Reliability & Quality Assurance department. The central authority for all inspection processing.

**Responsibilities:**
- Receive forwarded inspection requests
- Fill Part II (Step 1) of the inspection form including R&QA comments
- Nominate a **Team Head - QA** to manage the inspection
- Decide whether an inspection needs to be forwarded to ORDAQA
- Can start/complete inspections and approve/close requests

**Access:**
- Can view all inspection requests in the system
- Full visibility across all teams and hierarchies

### 3.4 Team Head - QA

**Internal Key:** `qa_approver`

**Description:** A team leader within the QA department who is nominated by the QA Head to oversee a specific inspection.

**Responsibilities:**
- Once nominated by the QA Head, assign one or more **Inspector / QA Reps** to the inspection (Part II Step 2)
- **Start Inspection** — Formally begin the inspection process
- **Complete Inspection** — Mark the inspection as complete after inspectors have filled all required sections
- **Approve & Close** — Give final QA approval and close the inspection request

**Access:**
- Can view all inspection requests in the system
- Can perform inspection lifecycle actions (start, complete, approve) only on requests where they are the nominated Team Head

### 3.5 Inspector / QA Rep

**Internal Key:** `inspector`

**Description:** A QA representative who performs the actual inspection and records findings.

**Responsibilities:**
- Fill Part IV (R&QA Inspection Report) with inspection details, observations, and results
- Fill Part III (ORDAQA sections) if assigned as an ORDAQA inspector
- Record inspection remarks and observations
- Manage inspection checklists

**Access:**
- Can view only inspection requests where they are assigned as an inspector
- Can edit Part III/IV only when the inspection status is `In Progress`

### 3.6 Administrator

**Internal Key:** `administrator`

**Description:** System administrator with full access to all features and data.

**Responsibilities:**
- Manage user accounts (create, edit, activate, deactivate)
- Manage projects, subsystems, LRUs, and SRUs
- Configure inspection types and system settings
- Perform any workflow action on any inspection request
- Generate all types of reports

**Access:**
- Full unrestricted access to all system features and data

---

## 4. Dashboard

### 4.1 Dashboard Overview

The Dashboard is the home page after login. It provides a personalized overview based on your role, displaying:

- **Welcome Header** — Shows your name, role badge, and quick action buttons
- **Statistics Cards** — Key metrics relevant to your role
- **Recent Inspections** — The latest inspection requests (up to 6)
- **Notifications** — Unread system notifications
- **Upcoming Inspections** — Count of inspections due within the next 7 days
- **Average Completion Time** — Mean number of days for completing inspections this month
- **Status Distribution** — Visual breakdown of inspections by status

### 4.2 Role-Specific Statistics

Each role sees different statistics on the dashboard:

**Administrator:**
| Card | Description |
|------|-------------|
| Total Inspections | Total number of all inspection requests |
| Active Users | Number of active user accounts |
| Active Projects | Number of active projects |
| Needs Action | Requests requiring administrative attention |

**QA Head / Team Head - QA:**
| Card | Description |
|------|-------------|
| Total Inspections | All inspection requests |
| Pending Forward | Requests awaiting forwarding |
| Needs Assignment | Forwarded requests not yet assigned |
| Completion Rate | Percentage of completed inspections |

**Request Approver:**
| Card | Description |
|------|-------------|
| Total Inspections | Requests from subordinates |
| Pending Forward | Requests awaiting your forwarding action |
| Needs Assignment | Requests pending assignment |
| Overdue | Overdue inspections |

**Inspector / QA Rep:**
| Card | Description |
|------|-------------|
| Assigned to Me | Inspections assigned to you |
| In Progress | Inspections you are currently working on |
| Overdue | Overdue assigned inspections |
| Completion Rate | Your inspection completion rate |

**Initiator / Designer:**
| Card | Description |
|------|-------------|
| My Requests | Total requests you have created |
| Drafts | Requests saved as drafts |
| Pending | Requests awaiting approval |
| Completion Rate | Completion rate of your requests |

### 4.3 Review Now Action

When you have pending actions (e.g., requests awaiting forwarding, inspections needing approval), the dashboard displays a **"Review Now"** button. Clicking this button navigates you to the **Inspection Request List** page with:

- **Actionable items highlighted** with an amber border and "Action Required" badge
- **Actionable items sorted to the top** of the list for quick access

### 4.4 Recent Inspections and Notifications

- **Recent Inspections:** Displays the latest 6 inspection requests visible to you, with their status, request number, title, initiator name, and due date. Click any entry to view its details.
- **Notifications:** Displays up to 4 unread notifications. Click to view details.
- **Admin Quick Links (Administrators only):** Direct links to Manage Users, Projects, Inspection Types, and Reports.

---

## 5. Inspection Request Workflow — Complete Guide

### 5.1 Workflow Overview

The inspection request follows a structured multi-stage workflow:

```
Initiator creates request (Part I)
        |
        v
Request Approver forwards (or rejects)
        |
        v
QA Head fills Part II Step 1 (nominates Team Head)
        |
        v
Team Head - QA assigns Inspector(s) (Part II Step 2)
        |
        v
Team Head - QA starts inspection
        |
        v
Inspector(s) fill Part III & Part IV
        |
        v
Team Head - QA completes inspection
        |
        v
Team Head - QA approves & closes
```

### 5.2 Status Flow Diagram

| Current Status | Action | Next Status | Performed By |
|----------------|--------|-------------|--------------|
| Draft / Pending | Submit for Approval | Pending Forward | Initiator |
| Pending Forward | Forward Request | Forwarded | Request Approver |
| Pending Forward | Reject | Rejected | Request Approver |
| Forwarded | Part II Step 1 Complete | Forwarded (updated) | QA Head |
| Forwarded | Assign Inspector(s) | Assigned | Team Head - QA |
| Assigned | Start Inspection | In Progress | Team Head - QA |
| In Progress | Complete Inspection | Inspection Done | Team Head - QA |
| Inspection Done | Approve & Close | Completed | Team Head - QA |

**Display Status Labels:**

| Internal Status | Display Label |
|-----------------|---------------|
| `draft` | Draft |
| `pending` | Pending |
| `pending_request_approval` | Pending Forward |
| `request_approved` | Forwarded |
| `assigned` | Assigned |
| `in_progress` | In Progress |
| `inspection_completed` | Inspection Done |
| `completed` | Completed |
| `rejected` | Rejected |

### 5.3 Step 1 — Creating a New Inspection Request (Part I)

**Who:** Initiator / Designer

**How to create:**

1. Navigate to **Inspection Request** in the sidebar.
2. Click the **"New Request"** button.
3. Fill in all required fields organized across the following sections:

   **Basic Information:**
   - **IR Number:** Auto-generated (e.g., `IR-MAR-001`)
   - **Request Date:** Defaults to today; cannot be set earlier than today's date

   **Programme & Item Details (Sections 1–3):**
   - Select the **Programme / Project** from the dropdown
   - Select the **Subsystem** (filtered by selected project)
   - Choose **Item Pertains To** (Airborne Unit / Ground Unit) and **Test Type** (SOFT, QT, AT, PQT, System-level Test, Lab Testing)

   **Supply Order & Equipment (Sections 4–11):**
   - Enter **SO Details**, **Delivery Period**, **Source** (Indigenous/Imported), **OEM Name**
   - Select **LRU Nomenclature** (filtered by subsystem), optionally select **SRU**
   - Choose **Criticality** (Mission Critical, Flight Critical, Safety Critical, Non-Critical)
   - **Part Number:** Auto-populated from selected LRU/SRU
   - **Serial Number(s):** Multi-select from serial numbers registered against the selected LRU/SRU
   - Enter **No. of Sets / Qty** and **Qty per Set**

   **Inspection Details (Sections 12–17):**
   - Select **Previous Stage Cleared** and **Log Book Copy Attached** (with file upload option, max 10 MB)
   - Select **Inspection Stage Offered Now** from configured inspection types
   - Choose **Mode of Inspection** (Physical VC / Through Hybrid)
   - Set **Inspection Date & Time** — must be on or after the Request Date
   - Enter **Venue** and optional **Description**

   **Document Reference Details (Section 18):**
   - A table listing standard documents: TS, SOP/MDI, QAP, QTP/LQTP/SOFTP, FTP/ATP, PC/TA/Other Doc
   - For each document, indicate: Approval status (Yes/No), Controlled Doc No., Amendment No., Revision No., Date

   **Confirmations (Section 19):**
   - Six yes/no confirmations:
     - (a) Approved documents available at time of inspection
     - (b) Logbook updated up to previous stage
     - (c) Previous observations status (Open / Closed / N/A)
     - (d) Certificates of Conformance (CoCs) available
     - (e) Instruments available
     - (f) Joint inspection request

   **Designer Representative & Certification (Sections 20–21):**
   - **Designer Rep Name, Designation, Contact:** Auto-populated from your profile
   - **Digital Signature:** Displayed from your uploaded signature
   - **Design Coordinator** name
   - **Designer DH/GD** (Certifier): Auto-populated as the request approver from your reporting chain

4. Click **"Create Inspection Request"** to save as a draft, or proceed to submit.

### 5.4 Step 2 — Submitting for Approval

**Who:** Initiator / Designer

Once a request is created (status: Draft or Pending):

1. Open the inspection request from the list.
2. Review all entered details.
3. Click the **"Submit for Approval"** button.
4. The status changes to **"Pending Forward"** and the request becomes visible to your Request Approver (the authority you report to).

### 5.5 Step 3 — Request Approver: Forward or Reject

**Who:** Request Approver

When a request from your subordinate is pending:

1. Go to the **Dashboard** and click **"Review Now"** or navigate to **Inspection Request** list.
2. Requests requiring your action are highlighted with an amber border and "Action Required" badge.
3. Click **"View Details"** on the request.
4. Review the Part I details carefully.
5. Choose one of the following actions:

   **Forward Request:**
   - Click the **"Forward Request"** button.
   - The request status changes to **"Forwarded"** and becomes available to the QA Head.
   - Your name, date, and digital signature are recorded in Section 21 of the form.

   **Reject:**
   - Click the **"Reject"** button.
   - Enter a **rejection reason** in the dialog.
   - The request status changes to **"Rejected"** and the initiator is notified.

**Important:** You can only see and act on requests created by users within your reporting hierarchy (direct and indirect subordinates).

### 5.6 Step 4 — QA Head: Part II (Step 1)

**Who:** QA Head

After a request has been forwarded:

1. Navigate to the request detail page.
2. Click **"Fill Part II"** or switch to the **Part II** tab.
3. Fill the Part II Step 1 form:

   **Section 22 — R&QA Office Use:**
   - **Head R&QA Comments:** Enter review comments
   - **Return to Designer:** Toggle if the request needs to be returned to the designer
   - **Forward to ORDAQA:** Toggle if the inspection requires ORDAQA involvement
   - **Team Head - QA:** Select a Team Head from the dropdown (only users with the "Team Head - QA" role are listed)
   - **Third Party Agency:** If applicable, enter third party agency details
   - **Outstation Inspection:** Toggle and enter location if applicable

4. Click **"Save Part II"** to complete Step 1.
5. Your name, date, and digital signature are recorded as the "Head R&QA Name & Signature" in Part II.
6. The nominated Team Head - QA now gains access to assign inspectors.

**Note:** Selecting an Inspector / QA Rep is NOT required at this step. The nominated Team Head - QA will handle inspector assignment.

### 5.7 Step 5 — Team Head - QA: Assign Inspectors (Part II Step 2)

**Who:** Nominated Team Head - QA

After the QA Head completes Part II Step 1:

1. Navigate to the request detail page (it will appear in your actionable items on the dashboard).
2. Click **"Assign Inspectors"** or switch to the **Part II** tab.
3. The Part II Step 2 form is displayed:
   - **Assign Inspector(s):** Select one or more Inspector / QA Reps from the dropdown
   - Multiple selection is allowed — all assigned inspectors will have equal access to work on the inspection

4. Click **"Assign"** to complete Step 2.
5. The status changes to **"Assigned"** and the selected inspectors are notified.

### 5.8 Step 6 — Team Head - QA: Start Inspection

**Who:** Nominated Team Head - QA (or QA Head / Administrator)

After inspectors are assigned:

1. Navigate to the request detail page.
2. Click the **"Start Inspection"** button.
3. The status changes from **"Assigned"** to **"In Progress"**.
4. Assigned inspectors can now fill Part III and Part IV of the form.

**Important:** Only the nominated Team Head - QA, QA Head, or Administrator can start the inspection. Individual inspectors cannot start inspections.

### 5.9 Step 7 — Inspector / QA Rep: Fill Part III and Part IV

**Who:** Assigned Inspector(s) / QA Rep(s)

While the inspection is **In Progress**:

#### Part III — ORDAQA Office Use (if applicable)

Only available if the QA Head marked "Forward to ORDAQA" in Part II.

- **Section 23 — ORDAQA Comments:** Remarks from the ORDAQA office, received date/time, memo details
- **Section 24 — Inspection Remarks:** Three tables for Mechanical, Electrical, and Other observations
- **Section 25 — Clearance Status:** Record the clearance recommendation with certification text

#### Part IV — CABS R&QA Inspection Report

- **Section 26 — Details of Inspection/Test:** Describe the inspection or test performed
- **Section 27 — Inspection Count:**
  - Enter **No. of Items Offered** and **No. of Items Accepted**
  - Validation: Accepted count must not exceed Items Offered
  - **Rejected** count is auto-calculated as: Items Offered − Accepted
  - Enter **No. of Observations**

- **Section 28 — Remarks/Observation by Inspector:** Detailed observations and findings

- **Section 29 — Inspection Remarks:**
  - A dynamic table where inspectors record individual observations:
    - **Sl. No.** — Sequential number (auto-generated)
    - **Observation** — Description of the finding
    - **Action Required** — Recommended corrective action
    - **Closed On** — Date when the observation was addressed
    - **Signature** — Inspector's identification
  - Rows can be added or removed as needed
  - This section is always displayed, even if no remarks are recorded

- **Section 30 — Inspector Name / Seal & Signature with Date:**
  - Displays all assigned Inspector / QA Reps in separate rows (Rep 1, Rep 2, etc.)
  - Displays the Team Head - QA name and signature
  - Digital signatures are auto-populated from user profiles

Click **"Save Part IV"** to save the inspection report.

### 5.10 Step 8 — Team Head - QA: Complete Inspection

**Who:** Nominated Team Head - QA (or QA Head / Administrator)

After inspectors have completed their entries:

1. Navigate to the request detail page.
2. Review Part III (if applicable) and Part IV entries.
3. Click the **"Complete Inspection"** button.
4. The status changes from **"In Progress"** to **"Inspection Done"**.

**Important:** Only the nominated Team Head - QA, QA Head, or Administrator can complete the inspection. Individual inspectors cannot perform this action.

### 5.11 Step 9 — Team Head - QA: Approve and Close

**Who:** Nominated Team Head - QA (or QA Head / Administrator)

After the inspection is completed:

1. Navigate to the request detail page.
2. Review all parts of the inspection form.
3. Click the **"Approve & Close"** button.
4. The status changes to **"Completed"**.
5. Your name, date, and digital signature are recorded as the final QA approver.
6. The inspection request is now closed and read-only.

**Important:** This is the final step. Once approved and closed, no further modifications can be made to the inspection request.

---

## 6. Inspection Request Form — Section Details

### 6.1 Part I — Details of Item(s) Offered for Inspection (Sections 1–21)

| Section | Title | Description | Filled By |
|---------|-------|-------------|-----------|
| 1 | Programme / Project | Select the project from the master list | Initiator |
| 2 | Sub System | Select the subsystem under the chosen project | Initiator |
| 3 | Item Pertains To | Choose Airborne/Ground unit and test type | Initiator |
| 4 | SO Details | Supply Order reference number | Initiator |
| 5 | Source | Indigenous or Imported | Initiator |
| 6 | LRU / SRU Nomenclature | Select equipment from the project hierarchy | Initiator |
| 7 | Criticality of Store | Mission, Flight, Safety, or Non-Critical | Initiator |
| 8 | Part Number | Auto-populated from selected LRU/SRU | System |
| 9 | Serial Number(s) | Multi-select from serial numbers registered against the LRU/SRU | Initiator |
| 10 | No. of Sets / Qty | Quantity of items offered | Initiator |
| 11 | Qty per Set | Quantity per set | Initiator |
| 12 | Previous Stage Cleared | Whether the previous inspection stage is cleared | Initiator |
| 13 | Log Book Copy Attached | Whether a logbook copy is attached (with upload) | Initiator |
| 14 | Inspection Stage Offered Now | Stage name from configured inspection types | Initiator |
| 15 | Mode of Inspection | Physical VC or Through Hybrid | Initiator |
| 16 | Venue | Location of the inspection | Initiator |
| 17 | Inspection Date & Time | Scheduled date/time (must be >= Request Date) | Initiator |
| 18–19 | Document Details & Confirmations | Document references and six confirmation questions | Initiator |
| 20 | Designer Rep Name & Designation | Auto-populated from the initiator's profile with digital signature | System |
| 21 | DH/GD Name & Signature | Request approver's details and digital signature (recorded upon forwarding) | System |

### 6.2 Part II — R&QA Office Use (Section 22)

| Field | Description | Filled By |
|-------|-------------|-----------|
| Head R&QA Comments | QA Head's review comments | QA Head (Step 1) |
| Return to Designer | Flag to return the request to the designer | QA Head (Step 1) |
| Forward to ORDAQA | Flag indicating ORDAQA involvement is needed | QA Head (Step 1) |
| Team Head - QA | Nominated Team Head from QA department | QA Head (Step 1) |
| Third Party Agency | External agency details (if applicable) | QA Head (Step 1) |
| Outstation Inspection | Flag and location for outstation inspections | QA Head (Step 1) |
| Inspector(s) / QA Rep(s) | One or more inspectors assigned to the inspection | Team Head - QA (Step 2) |
| Head R&QA Name & Signature | QA Head's digital signature (auto-recorded) | System |

### 6.3 Part III — ORDAQA Office Use (Sections 23–25)

*Only applicable when "Forward to ORDAQA" is enabled in Part II.*

| Section | Title | Description | Filled By |
|---------|-------|-------------|-----------|
| 23 | ORDAQA Comments | Office comments, received date/time, memo details | QA Approver |
| 24 | Inspection Remarks | Tables for Mechanical, Electrical, and Other observations | ORDAQA Inspector |
| 25 | Clearance Status | Certification and clearance recommendation | ORDAQA Inspector |

### 6.4 Part IV — CABS R&QA Inspection Report (Sections 26–30)

| Section | Title | Description | Filled By |
|---------|-------|-------------|-----------|
| 26 | Details of Inspection/Test | Description of the inspection/test performed | Inspector |
| 27 | Inspection Count | Items offered, accepted, observations, rejected (auto-calculated) | Inspector |
| 28 | Remarks/Observation | Detailed inspector observations | Inspector |
| 29 | Inspection Remarks | Table with Sl. No., Observation, Action Required, Closed On, Signature | Inspector |
| 30 | Inspector Name/Seal & Signature | Names and digital signatures of all assigned inspectors and Team Head | System |

---

## 7. Inspection Request List Page

### 7.1 Viewing Inspection Requests

Navigate to **Inspection Request** from the sidebar to view the list of all inspection requests visible to your role:

- **Initiator / Designer:** Only your own requests
- **Request Approver:** Requests from your subordinates (reporting hierarchy)
- **QA Head / Team Head - QA / Administrator:** All requests in the system
- **Inspector / QA Rep:** Only requests where you are assigned as an inspector

Each request card displays:
- **Request Number** (e.g., IR-MAR-001)
- **Title** and brief description
- **Status Badge** with color coding
- **Location / Venue**
- **Inspector** name (if assigned)
- **Due Date**
- **Created Date**

### 7.2 Filtering and Searching

Use the controls at the top of the list page:

- **Search:** Type in the search box to filter by title, request number, or description
- **Status Filter:** Select a status from the dropdown to show only requests in that status:
  - All Status
  - Draft / Pending
  - Pending Forward
  - Forwarded
  - Assigned
  - In Progress
  - Inspection Done
  - Completed
  - Rejected

### 7.3 Action Required Indicators

When you access the list via the **"Review Now"** button from the dashboard (or with `?action=review` in the URL):

- Requests that need **your action** are highlighted with:
  - An **amber left border** on the card
  - A light amber **background tint**
  - An **"Action Required"** badge
- These actionable items are **sorted to the top** of the list

**Actionable Items by Role:**

| Role | Actionable Statuses |
|------|---------------------|
| Request Approver | Pending Forward |
| QA Head | Forwarded, Assigned, In Progress, Inspection Done |
| Team Head - QA (nominated) | Forwarded (when nominated), Assigned, In Progress, Inspection Done |
| Initiator | Draft, Pending |

---

## 8. Inspection Request Detail Page

### 8.1 Progress Tracker

At the top of the detail page, a **progress tracker** shows the current stage of the inspection workflow:

```
Part I → Forwarded → Part II → Inspection → Part III/IV → Approved → Completed
```

Each step shows a green checkmark when completed and a gray circle when pending. This gives you an instant visual indication of where the request is in the workflow.

### 8.2 Viewing Request Details

The detail page is organized into tabs for each Part of the CABS form:

- **Overview** — Summary with key fields, status, and activity log
- **Part I** — All sections 1–21 of the inspection request
- **Part II** — R&QA office use details (Section 22)
- **Part III** — ORDAQA details (Sections 23–25), only if forwarded to ORDAQA
- **Part IV** — R&QA Inspection Report (Sections 26–30)
- **Checklists** — Inspection checklists (if any)
- **Attachments** — Uploaded documents

Each section displays the data in a clean, structured format with labels and values.

### 8.3 Action Buttons

Action buttons appear based on your role and the current request status:

| Button | Who Sees It | When (Status) |
|--------|-------------|---------------|
| Submit for Approval | Initiator | Draft, Pending |
| Forward Request | Request Approver, Admin | Pending Forward |
| Reject | Request Approver, Admin | Pending Forward |
| Fill Part II | QA Head, Admin | Forwarded (no Team Head assigned yet) |
| Assign Inspector(s) | Nominated Team Head | Forwarded (Team Head assigned, no inspectors) |
| Start Inspection | QA Head, Nominated Team Head, Admin | Assigned |
| Complete Inspection | QA Head, Nominated Team Head, Admin | In Progress |
| Approve & Close | QA Head, Nominated Team Head, Admin | Inspection Done |
| Print PDF | All users | Any status |

**Administrator Actions:** Administrators have access to an **"Admin Actions"** dropdown that provides all workflow actions regardless of the current status.

### 8.4 Activity Log

The **Activity Log** section (in the Overview tab) records every action performed on the inspection request, including:
- Who performed the action
- What action was taken
- When it was performed
- Additional details (e.g., rejection reason)

This provides a complete audit trail for every inspection request.

---

## 9. PDF Report — Print Output

The system can generate a formatted PDF output that matches the official CABS "Request for R&QA Inspection/Testing" form.

**How to generate the PDF:**

1. Open the inspection request detail page.
2. Click the **"Print PDF"** button (or access via the print icon).
3. A new browser tab opens with the formatted printable version.
4. Click **"Print"** to send to your printer or save as PDF.
5. Click **"Close"** to return to the application.

**PDF Layout:**

The PDF is formatted as an A4 document and includes:

| Section | Content |
|---------|---------|
| **Header** | CABS logo, R&QA Control No., Form No., Revision, Date |
| **Title** | "REQUEST FOR R&QA INSPECTION/TESTING" |
| **Part I** | Sections 1–21 with all form data |
| **Section 18** | Document reference details table |
| **Section 19** | Confirmation items (a–f) |
| **Sections 20–21** | Designer rep and DH/GD certification with digital signatures |
| **Part II** | Section 22 — R&QA office use with QA Head's digital signature |
| **Part III** | Sections 23–25 (if applicable) |
| **Part IV** | Sections 26–30 — Inspection report |
| **Section 29** | Inspection remarks table (always shown, even if empty) |
| **Section 30** | Inspector signatures (Rep 1, Rep 2) and Team Head signature with digital signature images |
| **Final Approvals** | QA Approver name, date, and digital signature |

**Digital Signatures:** All signature fields display the uploaded digital signature image from the respective user's profile, providing a formal and authentic appearance.

---

## 10. Projects Management

*Available to Administrators only.*

### 10.1 Project Hierarchy

Projects in the QMS follow a four-level hierarchy:

```
Project
  └── Subsystem
        └── LRU (Line Replaceable Unit)
              └── SRU (Shop Replaceable Unit)
```

This hierarchy is used when creating inspection requests — the initiator selects a Project, then Subsystem, then LRU/SRU in a cascading dropdown fashion.

### 10.2 Managing Projects

Navigate to **Projects** in the sidebar.

**Dashboard Cards:**
- **Total Projects** — Count of all projects
- **Subsystems** — Total count of subsystems across all projects
- **LRUs** — Total LRU count
- **SRUs** — Total SRU count

**Adding a Project:**
1. Click the **"Add Project"** button.
2. Fill in:
   - **Project Name** (required)
   - **Project Code** (required, unique identifier)
   - **Description** (optional)
   - **Status** (Active / Inactive)
3. Click **"Save"**.

**Editing / Deleting:**
- Click the dropdown menu (three dots) on any project to **Edit** or **Delete**.

### 10.3 Managing Subsystems

1. Expand a project to view its subsystems.
2. Click **"Add Subsystem"** from the project's dropdown menu.
3. Fill in: Subsystem Name, Code, Description, Status.
4. Click **"Save"**.

### 10.4 Managing LRUs

1. Expand a subsystem to view its LRUs.
2. Click **"Add LRU"** from the subsystem's dropdown menu.
3. Fill in:
   - **LRU Name** (required)
   - **Code** (required)
   - **Part Number** (required)
   - **Description** (optional)
   - **Serial Numbers** — See Section 10.6
   - **Status** (Active / Inactive)
4. Click **"Save"**.

### 10.5 Managing SRUs

1. Expand an LRU to view its SRUs.
2. Click **"Add SRU"** from the LRU's dropdown menu.
3. Fill in: SRU Name, Code, Part Number, Description, Serial Numbers, Status.
4. Click **"Save"**.

### 10.6 Serial Number Management

Both LRUs and SRUs support multiple alphanumeric serial numbers.

**Adding Serial Numbers:**
1. In the LRU or SRU form, locate the **Serial Numbers** field.
2. Type a serial number in the input box.
3. Press **Enter** or click the **Add** button.
4. The serial number appears as a badge/tag below the input.
5. Repeat to add more serial numbers.

**Removing Serial Numbers:**
- Click the **"×"** button on any serial number badge to remove it.

**Usage:** When creating an inspection request, Section 9 (Serial Number) dynamically loads the serial numbers from the selected LRU or SRU, allowing the initiator to select one or more applicable serial numbers.

---

## 11. Reports

### 11.1 Generating Reports

Navigate to **Reports** from the sidebar.

**Report Types:**
- **Inspection Requests** — Detailed list of inspection requests
- **Inspection Summary** — Summary statistics of inspections

**Output Formats:**
- **View On Screen** — Display results directly in the browser
- **Download PDF** — Generate and download a PDF document
- **Download Word** — Generate and download a Word document

### 11.2 Report Filters

Before generating a report, you can apply filters to narrow the results:

| Filter | Description |
|--------|-------------|
| **Project** | Select a specific project |
| **Designer / Initiator** | Filter by the person who created the request |
| **Status** | Four grouped options (see below) |
| **From Date** | Start date range |
| **To Date** | End date range |

**Grouped Status Filter Options:**

| Group | Included Statuses |
|-------|-------------------|
| **Pending** | Draft, Pending, Pending Forward, Forwarded |
| **In Progress** | Assigned, In Progress |
| **Completed** | Inspection Done, Completed, Approved, Closed |
| **Rejected** | Rejected |

### 11.3 Viewing and Exporting Reports

**On-Screen View:**

When you select "View On Screen", the report displays:
- **Summary Cards** — Quick statistics (total, by status, etc.)
- **Data Table** — Detailed rows with: IR No., Title, Project, Status (with individual color-coded badge), Initiator, Inspector, Due Date
- **Row Actions** — View Details (navigate to IR detail page), Print CABS PDF

**Exporting from On-Screen:**
- After viewing on screen, use the **"Export PDF"** or **"Export Word"** buttons to download the currently displayed report.

**Direct Download:**
- Select "Download PDF" or "Download Word" as the output format and click **"Generate"** to download directly without on-screen preview.

---

## 12. User Management

*Available to Administrators only.*

### 12.1 Creating Users

1. Navigate to **Users** from the sidebar.
2. Click the **"Add User"** button.
3. Fill in all required fields (see Section 12.2).
4. Click **"Save"** to create the user account.

### 12.2 User Fields

| Field | Description | Required |
|-------|-------------|----------|
| **Employee ID** | Unique identifier (e.g., DES001, TH002) | Yes |
| **Name** | Full name of the user | Yes |
| **Email** | Email address | Yes |
| **Password** | Account password | Yes (on creation) |
| **Designation** | Organizational title (GD, DGD, DH, TH, Inspector, Designer) | Yes |
| **Scientist Rank / Grade** | Academic or organizational rank | No |
| **User/Designer Department** | Department: User/Designer, R&QA, or ORDAQA | Yes |
| **System Role** | One of the six roles (see Chapter 3) | Yes |
| **Status** | Active or Inactive | Yes |
| **Reports To** | Select the user's reporting manager | No (top-level users have none) |
| **Contact Number** | Phone number | No |
| **Digital Signature** | Scanned signature image (PNG/JPEG, max 2 MB) | No |

### 12.3 Organizational Hierarchy

The system uses a **reporting hierarchy** to control access and workflow routing:

- Each user (except top-level authorities) has a **"Reports To"** manager
- The hierarchy forms a tree structure: GD → DGD → DH → TH → Designer/Inspector
- **Request Approvers** can only forward/reject requests from their subordinates (direct and indirect reports)
- **Initiators** see only their own requests

**Hierarchy Example:**

```
Group Director (GD)
  └── Deputy Group Director (DGD)
        └── Division Head (DH) — Request Approver
              └── Team Head (TH) — Request Approver
                    ├── Designer 1 — Initiator
                    ├── Designer 2 — Initiator
                    └── Designer 3 — Initiator
```

The **Users** page displays the hierarchy as an expandable tree, showing each user and their direct reports.

### 12.4 Digital Signature Upload

Each user can have a digital signature stored in the system:

1. Navigate to the user's profile (via Users page for admins, or Settings for self).
2. In the **Scanned Signature** section:
   - Click **"Upload"** and select a PNG or JPEG image file (max 2 MB).
   - The signature preview is displayed.
   - To remove, click **"Remove Signature"**.

3. The digital signature is automatically displayed in:
   - **Part I, Section 20** — Initiator's signature
   - **Part I, Section 21** — Request Approver's signature
   - **Part II** — QA Head's signature
   - **Part IV, Section 30** — Inspector signatures and Team Head signature
   - **Final Approvals** — QA Approver's signature
   - **PDF Output** — All corresponding signature fields

---

## 13. Settings and Administration

*Available to Administrators only.*

The **Settings** section provides system-wide configuration options. Access it from the sidebar under **Settings**.

Additional administrative features:

- **Inspection Types:** Configure the list of inspection stages that appear in Section 14 of the form (e.g., Assembly Inspection, Final Testing, etc.)
- **User Management:** Full CRUD operations on user accounts
- **Project Management:** Configure the project hierarchy used in inspection requests

---

## 14. Appendix

### A. Status Reference Table

| Status | Label | Color | Description |
|--------|-------|-------|-------------|
| `draft` | Draft | Gray | Request saved but not submitted |
| `pending` | Pending | Amber | Request created, awaiting submission |
| `pending_request_approval` | Pending Forward | Amber | Submitted, awaiting Request Approver action |
| `request_approved` | Forwarded | Blue | Forwarded by Request Approver to QA Head |
| `assigned` | Assigned | Indigo | Inspectors assigned, awaiting inspection start |
| `in_progress` | In Progress | Yellow | Inspection actively in progress |
| `inspection_completed` | Inspection Done | Teal | Inspection completed, awaiting final approval |
| `completed` | Completed | Green | Approved and closed by Team Head - QA |
| `rejected` | Rejected | Red | Rejected by Request Approver |

### B. Role–Permission Matrix

| Permission | Initiator | Request Approver | QA Head | Team Head - QA | Inspector | Administrator |
|------------|-----------|------------------|---------|----------------|-----------|---------------|
| Create IR | Yes | — | — | — | — | Yes |
| Edit own IR | Draft/Pending only | — | — | — | — | Yes |
| View own IRs | Yes | — | — | — | — | Yes |
| View team IRs | — | Yes (subordinates) | — | — | — | Yes |
| View all IRs | — | — | Yes | Yes | — | Yes |
| View assigned IRs | — | — | — | — | Yes | Yes |
| Forward Request | — | Yes | — | — | — | Yes |
| Reject Request | — | Yes | — | — | — | Yes |
| Fill Part II Step 1 | — | — | Yes | — | — | Yes |
| Assign Inspectors | — | — | — | Yes (nominated) | — | Yes |
| Start Inspection | — | — | Yes | Yes (nominated) | — | Yes |
| Complete Inspection | — | — | Yes | Yes (nominated) | — | Yes |
| Approve & Close | — | — | Yes | Yes (nominated) | — | Yes |
| Fill Part III | — | — | — | — | Yes (assigned) | Yes |
| Fill Part IV | — | — | — | — | Yes (assigned) | Yes |
| Manage Checklists | — | — | — | — | Yes | Yes |
| Generate Reports | Yes | Yes | Yes | Yes | Yes | Yes |
| Manage Users | — | — | — | — | — | Yes |
| Manage Projects | — | — | — | — | — | Yes |

### C. Keyboard Shortcuts and Tips

- **Search:** Use the search bar in the header or on list pages to quickly find inspection requests by number, title, or description.
- **Print PDF:** From any inspection detail page, click the Print button to generate the official CABS form.
- **Dark Mode:** Toggle between light and dark themes using the theme switch in the header.
- **Collapsible Sidebar:** Click the hamburger icon to collapse the sidebar for more workspace area.
- **Review Mode:** Use the "Review Now" button on the dashboard to quickly see items requiring your attention.

---

*End of User Manual*

**For technical support or queries, contact your system administrator.**
