# Quality Management System (QMS) - Complete User Manual

Document version: 2.0  
Application: CABS Quality Management System  
Audience: End users, approvers, QA users, ORDAQA users, and administrators  
Last updated: May 2026

---

## 1. Introduction

The Quality Management System (QMS) is a web application for managing the complete lifecycle of CABS Request for R&QA Inspection/Testing records. It replaces paper-based movement of inspection requests with a role-based digital workflow for request creation, request approval, QA review, inspector assignment, inspection reporting, closure, notifications, and printable reports.

Use the system to:

- Create and submit inspection requests.
- Forward, reject, or send back requests for correction.
- Capture R&QA and ORDAQA review details.
- Assign QA and ORDAQA representatives.
- Record inspection observations, accepted quantities, rejected quantities, and checklist results.
- Track request progress from draft to closure.
- Generate printable CABS inspection forms and summary reports.
- Manage users, project hierarchy, inspection stages, and system settings.

---

## 2. System Access

### 2.1 Recommended Environment

- Use a modern desktop browser such as Microsoft Edge, Google Chrome, or Mozilla Firefox.
- Use the official QMS URL provided by your administrator.
- Keep your browser zoom near 100% for best form alignment and print preview output.
- A network connection to the QMS server is required.

### 2.2 Signing In

1. Open the QMS URL in your browser.
2. On the Sign In page, enter your Employee ID.
3. Enter your password.
4. Select Sign In.

Employee IDs are normalized by the system. If you type lowercase characters, the login screen converts them to uppercase.

### 2.3 Login Problems

If login fails, check that:

- The Employee ID is correct.
- The password has been entered correctly.
- Caps Lock is not causing a typing mistake.
- Your account is active.

If the message says your account has been deactivated, contact an administrator. If you forgot your password, ask an administrator to reset it or use the password reset process configured for your deployment.

### 2.4 Session Timeout

For security, QMS automatically signs users out after 5 minutes of inactivity. One minute before logout, the system displays a timeout warning. Select Stay Logged In to continue, or Logout Now to end the session.

---

## 3. Application Layout

After login, QMS opens the Dashboard. The main layout has four areas:

- Header: Shows the CABS QMS branding, global search box, theme toggle, notification bell, and profile menu.
- Sidebar: Provides navigation to Dashboard, Inspection Request, Reports, Projects, Inspection Types, Users, and Settings depending on your role.
- Main Content Area: Displays the selected page or form.
- Footer: Shows copyright, support links, and the TechFLUENT attribution.

### 3.1 Sidebar Navigation

Dashboard is available to all users.

Inspection Request is available to users who can read inspection requests. This includes initiators, inspectors, approvers, QA roles, ORDAQA roles, and administrators as applicable.

Reports is available to all signed-in users.

Projects, Inspection Types, and Settings are administrator functions.

Users is available to administrators and roles with user read permission.

### 3.2 Header Actions

Use the theme toggle to switch between light and dark mode.

Use the notification bell to view recent workflow notifications. You can open related inspection requests, mark notifications as read, mark all as read, or clear notifications.

Use the profile menu to change your password or sign out. Administrators also see a shortcut to Settings.

### 3.3 Change Password

1. Open the profile menu in the top-right corner.
2. Select Change Password.
3. Enter the current password.
4. Enter the new password.
5. Re-enter the new password to confirm.
6. Select Change Password.

The new password must contain at least 6 characters.

---

## 4. User Roles

QMS uses role-based permissions. Your role controls which requests you can see and which actions you can perform.

### 4.1 Initiator / Designer

Initiators create inspection requests and submit Part I for approval.

Primary responsibilities:

- Create inspection requests.
- Fill Part I sections 1 to 21.
- Upload logbook or supporting attachments where required.
- Select the certifying request approver.
- Track the request after submission.
- Correct and resubmit requests that are sent back.

Typical access:

- Create new inspection requests.
- View and update their own requests while the workflow allows correction.
- View reports and notifications.

### 4.2 Request Approver

Request Approvers review requests submitted by designers in their reporting chain.

Primary responsibilities:

- Review Part I details.
- Forward valid requests to the QA Head.
- Send requests back to the initiator for correction.
- Reject invalid requests with a reason.

Typical access:

- View requests from users in their reporting hierarchy.
- Act on requests waiting for request approval.
- View reports and notifications.

### 4.3 QA Head

The QA Head performs the first R&QA review after a request is forwarded.

Primary responsibilities:

- Review forwarded inspection requests.
- Complete Part II Step 1.
- Record Head R&QA comments.
- Decide whether the request requires ORDAQA involvement.
- Nominate the Team Head - QA.
- Review and act on later QA stages when permitted.

Typical access:

- View all inspection requests.
- Fill and edit Part II as allowed by status.
- Generate reports.

### 4.4 Team Head - QA

The Team Head - QA manages the inspection after nomination by the QA Head.

Primary responsibilities:

- Assign one or more Inspector / QA Reps.
- Send the request back before inspector assignment when corrections are needed.
- Start the inspection.
- Review Part III and Part IV entries.
- Complete the inspection.
- Approve and close the request.

Typical access:

- View inspection requests.
- Perform workflow actions on requests where they are nominated.

### 4.5 Inspector / QA Rep

Inspectors perform inspection work and record inspection findings.

Primary responsibilities:

- Work on assigned inspections.
- Fill inspection report details in Part IV.
- Record observations, action required, closure dates, and remarks.
- Create and update inspection checklists for assigned work.
- Upload evidence or supporting attachments when needed.

Typical access:

- View assigned inspection requests.
- Update assigned requests while they are in editable inspection stages.

### 4.6 ORDAQA Head

The ORDAQA Head is used when a request requires ORDAQA involvement.

Primary responsibilities:

- Review ORDAQA-related inspection requests.
- Support ORDAQA assignment or approval activities based on deployment configuration.
- Monitor ORDAQA workflow progress.

### 4.7 ORDAQA Inspector / Rep

The ORDAQA Inspector records ORDAQA inspection inputs when the request has been forwarded to ORDAQA.

Primary responsibilities:

- Fill ORDAQA-related sections.
- Record ORDAQA observations and clearance status.
- Send the request back to the designer for Part I corrections when required.

### 4.8 Administrator

Administrators manage the application and have full access.

Primary responsibilities:

- Manage users, roles, reporting hierarchy, and signatures.
- Manage projects, subsystems, LRUs, SRUs, and serial numbers.
- Configure inspection type categories and items.
- Manage system settings.
- View and act on all inspection requests.
- Generate reports.

---

## 5. Dashboard

The Dashboard is the home page after login. It gives each user a role-specific overview of work and activity.

### 5.1 Common Dashboard Elements

- Welcome section with your name, designation, and role label.
- New IR button for Initiators and Administrators.
- View All IRs shortcut.
- Overdue inspection alert, if applicable.
- Statistics cards based on your role.
- Recent Inspections list.
- Notifications summary.
- Upcoming inspections due within 7 days.
- Average completion time, when data is available.
- Status overview by inspection status.

### 5.2 Role-Specific Statistics

Administrators see total inspections, active users, active projects, and items needing action.

QA Head and Team Head - QA users see total inspections, pending forward items, requests needing assignment, and completion rate.

Request Approvers see total inspections, pending forward items, requests needing assignment, and overdue counts.

Inspectors and ORDAQA Inspectors see assigned inspections, in-progress inspections, overdue assignments, and completion rate.

Initiators see their requests, drafts, pending requests, and completion rate.

### 5.3 Review Now

When your role has pending workflow actions, the Dashboard displays an Action Required panel with a Review Now button. Selecting it opens the Inspection Request list with actionable items highlighted and sorted near the top.

---

## 6. Inspection Request Workflow

The inspection request workflow follows the CABS R&QA form structure.

### 6.1 Standard Workflow

1. Initiator creates and submits Part I.
2. Request Approver reviews the request.
3. Request Approver forwards, sends back, or rejects the request.
4. QA Head fills Part II Step 1 and nominates Team Head - QA.
5. Team Head - QA assigns Inspector / QA Rep users.
6. Team Head - QA starts inspection.
7. Inspectors fill Part IV and, where applicable, ORDAQA users fill Part III.
8. Team Head - QA completes the inspection.
9. Team Head - QA approves and closes the request.

### 6.2 Status Reference

- Draft: Request is saved but not yet submitted.
- Pending: Request is created and awaiting submission or further action.
- Pending Request Approval / Pending Forward: Request is awaiting Request Approver action.
- Request Approved / Forwarded: Request has been forwarded to QA.
- Returned to Designer: Request was sent back for Part I correction.
- Assigned: Inspector or QA representatives are assigned.
- In Progress: Inspection work has started.
- Inspection Completed / Inspection Done: Inspection entries are complete and awaiting final approval.
- Completed: Request is approved and closed in the current workflow.
- Approved: Legacy or compatibility status used by some report filters.
- Closed: Final legacy closure status used by some report filters.
- Rejected: Request was rejected with a reason.

### 6.3 Send Back vs Reject

Use Send back when the request can be corrected and resubmitted. The initiator updates Part I and resubmits for approval.

Use Reject when the request should not continue in the workflow. A rejection reason should explain why the request was rejected.

### 6.4 Closed Request Restrictions

After final approval and closure, the inspection request becomes read-only for normal workflow editing. Generate reports or printable PDFs from the closed request as needed.

---

## 7. Create an Inspection Request

Initiators and Administrators can create a new inspection request.

### 7.1 Open the Form

1. Open Dashboard or Inspection Request.
2. Select New IR or New Request.
3. The Request for R&QA Inspection/Testing form opens.

### 7.2 Form Sections

The form captures Part I of the CABS request.

IR Number and Date:

- IR Number is auto-generated by the system.
- Request Date defaults to the current date.

Programme and Item Details:

- Select Programme / Project.
- Select Subsystem.
- Select whether the item pertains to Airborne Unit or Ground Unit.
- Select the applicable test type.

Supply Order and Equipment Details:

- Enter SO details and delivery period.
- Select source, such as Indigenous or Imported.
- Enter OEM name where applicable.
- Select LRU nomenclature.
- Select SRU if applicable.
- Select criticality.
- Confirm or enter part number.
- Select one or more serial numbers.
- Enter quantity as sets with quantity per set, or total quantity when applicable.

Inspection Details:

- Select previous stage cleared value.
- Indicate whether logbook copy is attached.
- Upload a logbook file if logbook attached is Yes.
- Select inspection stage offered now.
- Select mode of inspection.
- Enter inspection date or date range as required by the form.
- Enter venue.
- Add optional description.

Document Details:

For each document type, enter whether the document is approved, document number, amendment number, revision number, and date. Typical document rows include TS, SOP/MDI, QAP, QTP/LQTP/SOFTP, FTP/ATP, PC/TA, and other applicable documents.

Confirmations:

Answer all required confirmation questions, including availability of approved documents, logbook status, previous observation compliance, Certificates of Conformance, calibrated instruments, and joint inspection request.

Designer Representative and Certification:

- Designer representative fields are filled from the logged-in user profile where available.
- Enter or confirm design coordinator details.
- Select the Designer DH/GD/TH certifier or request approver.
- The certification statement confirms that the item is ready for inspection or testing.

### 7.3 Submit the Request

1. Review all required fields.
2. Correct validation messages if any are shown.
3. Select Submit Inspection Request.
4. The system creates the request and routes it to the selected Request Approver.

### 7.4 Edit a Sent-Back Request

When a request is returned to the designer:

1. Open the request from Dashboard, Notifications, or Inspection Request.
2. Read the send-back comment.
3. Select the edit option for Part I.
4. Update the required details.
5. Save changes.
6. Resubmit for Request Approver approval.

---

## 8. Inspection Request List

Open Inspection Request from the sidebar to see requests available to your role.

### 8.1 Searching and Filtering

Use search to find requests by request number, title, item, or related text. Use status filters or dashboard highlight links to narrow the list.

### 8.2 Request Cards

Each request card may show:

- Request number.
- Title or item description.
- Status badge.
- Initiator.
- Inspector or assigned user.
- Venue or location.
- Due date or inspection date.
- Created date.
- Action Required badge where applicable.

### 8.3 Action Highlighting

When opened from Review Now, requests needing your action are highlighted. Examples include:

- Request Approver: pending request approval.
- QA Head: forwarded requests needing Part II.
- Team Head - QA: assigned workflow stages for nominated requests.
- Inspector: assigned or in-progress inspections.
- Initiator: drafts or returned requests needing correction.

---

## 9. Inspection Request Detail Page

The request detail page is the central workspace for viewing, editing, approving, assigning, and printing an inspection request.

### 9.1 Header Actions

Depending on role and status, you may see:

- Print PDF.
- Submit for Approval or Resubmit for Request Approver.
- Send back.
- Reject.
- Forward Request.
- Fill Part II.
- Edit Part II.
- Assign Inspector(s).
- Start Inspection.
- Complete Inspection.
- Approve & Close.

Only actions allowed for your role and the current status are shown.

### 9.2 Detail Tabs

Overview:

- Shows request summary, status, primary fields, and activity information.

Part I:

- Shows designer-entered request details from sections 1 to 21.

Part II:

- Used for R&QA office review and assignment details.

Part III:

- Used for ORDAQA office entries where ORDAQA involvement applies.

Part IV:

- Used for the CABS R&QA inspection report.

Checklists:

- Used to create, view, update, complete, reopen, or delete inspection checklists where permitted.

Attachments:

- Used to upload, download, and delete permitted supporting files.

### 9.3 Activity and Audit Trail

Workflow actions are recorded so users can see what happened, who performed the action, and when it occurred. Use this information to understand current ownership and previous decisions.

---

## 10. Request Approver Actions

Request Approvers act after an initiator submits Part I.

### 10.1 Review the Request

1. Open Dashboard and select Review Now, or open Inspection Request.
2. Open the request requiring approval.
3. Review Part I, document details, confirmations, logbook attachment, and certifier information.

### 10.2 Forward the Request

Use Forward Request when the request is acceptable. The request moves to QA review and becomes available to the QA Head.

### 10.3 Send Back

Use Send back when Part I needs correction. Enter a clear comment explaining what the initiator must change. The request is returned to the designer for correction and resubmission.

### 10.4 Reject

Use Reject when the request should not continue. Enter a rejection reason. The initiator is notified.

---

## 11. QA Head Actions

QA Head acts after the Request Approver forwards the request.

### 11.1 Fill Part II Step 1

1. Open the forwarded request.
2. Select Fill Part II or open the Part II tab.
3. Enter Head R&QA comments.
4. Choose whether the request should be returned to the designer if the form provides that control.
5. Choose whether to forward to ORDAQA.
6. Nominate Team Head - QA.
7. Enter third party agency or outstation inspection details if applicable.
8. Save Part II.

After saving, the nominated Team Head - QA can continue the assignment workflow.

### 11.2 Edit Part II

Where status permits, QA Head or Administrator can return to Part II and update details such as nominated team head, ORDAQA involvement, third party agency, or outstation inspection data.

---

## 12. Team Head - QA Actions

### 12.1 Assign Inspectors

1. Open the request where you are nominated as Team Head - QA.
2. Open Part II.
3. Select one or more Inspector / QA Rep users.
4. Save the assignment.

The request status changes to Assigned and assigned inspectors are notified.

### 12.2 Send Back Before Assignment

If Part I needs correction before inspectors are assigned, use Send back and enter a comment. After the initiator resubmits, the request returns through Request Approver and QA Head steps again.

### 12.3 Start Inspection

After inspectors are assigned, select Start Inspection. The status changes to In Progress and inspectors can record inspection details.

### 12.4 Complete Inspection

After inspectors save required inspection entries, review the details and select Complete Inspection. The request moves to Inspection Completed / Inspection Done.

### 12.5 Approve & Close

After final review, select Approve & Close. This closes the request and records the final QA approval details.

---

## 13. Inspector and ORDAQA Work

### 13.1 Inspector / QA Rep Part IV

When the inspection is In Progress, assigned inspectors can fill Part IV.

Part IV captures:

- Details of inspection or test performed.
- Number of items offered.
- Number of items accepted.
- Number of observations.
- Rejected quantity, calculated from offered minus accepted where applicable.
- Inspector observations and remarks.
- Action required for each observation.
- Observation closure date.
- Inspector signature details.

Save Part IV after entering or updating inspection details.

### 13.2 ORDAQA Part III

When the QA Head marks the request for ORDAQA involvement, ORDAQA users complete the applicable Part III sections.

Part III may include:

- ORDAQA comments.
- Received date and memo details.
- Mechanical, electrical, or other observations.
- Clearance status and certification.

### 13.3 Send Back from ORDAQA

If ORDAQA review identifies Part I corrections, the assigned ORDAQA user can send the request back to the designer. The initiator must update Part I and resubmit. The request then passes again through Request Approver, QA Head, and Team Head - QA steps.

---

## 14. Checklists

Checklists help inspectors track detailed inspection tasks and compliance items.

### 14.1 Create a Checklist

1. Open the inspection request.
2. Open the Checklists tab.
3. Select Add Checklist.
4. Enter checklist name and description.
5. Add checklist item descriptions and categories.
6. Save the checklist.

### 14.2 Update Checklist Items

For each checklist item, permitted users can record:

- Status.
- Compliance result.
- Findings.
- Corrective action.
- Inspector notes.

### 14.3 Complete or Reopen a Checklist

Use Complete when all items are ready to be marked complete. If a completed checklist needs more work, reopen it and update the required items.

### 14.4 Delete a Checklist

Delete only if the checklist was created in error. Deletion removes the checklist and its items.

---

## 15. Attachments and Files

Attachments support evidence, logbook copies, and other supporting records.

### 15.1 Upload a File

1. Open the request.
2. Go to the Attachments tab or the upload control in the form.
3. Select the file.
4. Confirm upload.

Logbook upload is required when Log Book Copy Attached is set to Yes and no existing logbook file is already present.

### 15.2 Download or Remove Files

Use Download to view or save a file. Use Delete only when you own the file or your role allows deletion.

### 15.3 File Guidelines

- Upload only relevant inspection evidence and official documents.
- Use clear file names.
- Avoid duplicate uploads.
- Follow local size and type limits shown by the form.

---

## 16. Print PDF and Official Form Output

QMS can generate a printable CABS Request for R&QA Inspection/Testing output.

### 16.1 Print an Inspection Request

1. Open an inspection request.
2. Select Print PDF.
3. A print page opens in a new browser tab or window.
4. Review the formatted output.
5. Use the browser print command to print or save as PDF.

### 16.2 PDF Contents

The printable output includes:

- Header and form title.
- Part I designer request details.
- Document reference details.
- Confirmation answers.
- Designer and certifier information.
- Part II R&QA office details.
- Part III ORDAQA details where applicable.
- Part IV inspection report.
- Inspector, QA, and approval signatures where signatures are available.

---

## 17. Reports

Reports are available from the Reports sidebar item.

### 17.1 Report Types

The main report type is Inspection Requests. The reports page is designed to generate inspection request data with filters and export options.

### 17.2 Filters

You can filter by:

- Project.
- Designer / Initiator.
- Status group.
- From date.
- To date.

Status groups include Pending, In Progress, Completed, and Rejected. Each group contains related internal statuses.

### 17.3 Output Formats

View On Screen:

- Displays the report inside the application.
- Shows summary data and request rows.
- Provides row actions such as viewing the request or printing the CABS PDF.

Download PDF:

- Opens or downloads a printable PDF report.

Download Word:

- Downloads a Word-compatible document.

Download Excel:

- Downloads an Excel-compatible spreadsheet when enabled in the deployment.

### 17.4 Generate a Report

1. Open Reports.
2. Select report type.
3. Choose output format.
4. Apply filters if required.
5. Select Generate.

When viewing on screen, use export buttons to export the currently displayed report.

---

## 18. Project Management

Project Management is for administrators.

### 18.1 Project Hierarchy

QMS uses this hierarchy:

Project -> Subsystem -> LRU -> SRU

This hierarchy controls the cascading dropdowns in the inspection request form.

### 18.2 Manage Projects

Administrators can:

- Add projects.
- Edit project name, code, description, and status.
- Delete projects where allowed.
- Search projects.
- Expand projects to manage child records.

### 18.3 Manage Subsystems

Within a project, administrators can add, edit, or delete subsystems. A subsystem contains a name, code, description, and status.

### 18.4 Manage LRUs

Within a subsystem, administrators can add, edit, or delete LRUs. An LRU contains a name, code, part number, description, status, and serial numbers.

### 18.5 Manage SRUs

Within an LRU, administrators can add, edit, or delete SRUs. An SRU contains a name, code, part number, description, status, and serial numbers.

### 18.6 Serial Numbers

Serial numbers entered for LRUs and SRUs are shown in the inspection request form. Keep serial numbers accurate because initiators select inspection serial numbers from this master data.

---

## 19. Inspection Types

Inspection Types is an administrator page used to configure inspection stage options.

### 19.1 Categories

Categories group related inspection type items. Administrators can create, edit, expand, collapse, and delete categories.

Category fields include:

- Name.
- Description.
- Sort order.
- Status.

### 19.2 Items

Items are the actual inspection stage choices shown to users in the inspection request form.

Item fields include:

- Name.
- Description.
- Sort order.
- Status.

Only active and correctly configured items should be used for production forms.

---

## 20. User Management

User Management is primarily for administrators.

### 20.1 User List

The Users page shows user accounts with:

- Employee ID.
- Name.
- Designation.
- Role.
- Department.
- Reporting manager.
- Status.
- Available actions.

The page also shows designation hierarchy information.

### 20.2 Create a User

1. Open Users.
2. Select New User.
3. Enter Employee ID.
4. Enter name and email.
5. Enter an initial password.
6. Select designation.
7. Select department.
8. Select system role.
9. Set status to Active or Inactive.
10. Choose Reports To where applicable.
11. Upload scanned signature if available.
12. Select Create User.

### 20.3 Edit a User

1. Open the user action menu.
2. Select Edit User.
3. Update fields as required.
4. Leave password blank if it should not change.
5. Select Save Changes.

### 20.4 Add a Direct Report

Where provided by the hierarchy view, use Add Direct Report to create a user already linked to the selected reporting manager.

### 20.5 User Status

Active users can sign in. Inactive users cannot sign in and may be signed out by the system during status checks.

### 20.6 Digital Signatures

Administrators can upload scanned signatures for users. The file should be PNG or JPEG and no larger than the limit shown by the form, commonly 2 MB.

Signatures may appear in:

- Designer representative certification.
- Request approver certification.
- Head R&QA review.
- Inspector report sections.
- Final QA approval.
- Printable PDF output.

---

## 21. Settings

Settings is an administrator page.

### 21.1 Organization Settings

Administrators can manage values such as organization name, contact email, maintenance mode, language, and theme preference where supported by the deployment.

### 21.2 Notification Settings

Administrators can configure email notification preferences and push notification preferences where supported.

### 21.3 Security Settings

Security settings include password and session-related preferences displayed by the settings page.

### 21.4 Regional Settings

Regional settings include locale, date format, time format, time zone, and currency preferences where supported.

Note: Some settings screens may be placeholders or deployment-specific. If a setting does not appear to take effect, contact the system administrator or deployment team.

---

## 22. Notifications

QMS sends in-app notifications for important workflow events.

Common notification types include:

- Request submitted.
- Request assigned.
- Request approved or forwarded.
- Request rejected.
- Inspection completed.
- Overdue alert.
- Returned to designer.
- Resubmitted after return.
- Forwarded to QA Head.
- Team Head - QA nominated.
- Part II inspector assignment.
- Part IV saved.

### 22.1 Use the Notification Bell

1. Select the bell icon in the header.
2. Review unread notifications.
3. Select a notification to open the related inspection request when available.
4. Use Mark all read to clear unread badges.
5. Use Clear all to remove notifications from the dropdown.

Notifications refresh automatically at intervals while you are using the app.

---

## 23. Best Practices

### 23.1 For Initiators

- Confirm project, subsystem, LRU, SRU, and serial numbers before submission.
- Upload the logbook when required.
- Use clear descriptions and venue details.
- Select the correct request approver.
- Respond quickly when a request is sent back.

### 23.2 For Approvers

- Use Send back for correctable issues.
- Use Reject only when the request should stop.
- Enter clear comments so the initiator knows exactly what to fix.

### 23.3 For QA Head and Team Head - QA

- Nominate the correct Team Head - QA.
- Assign inspectors before starting inspection.
- Confirm ORDAQA requirement before progressing.
- Review all inspection data before closure.

### 23.4 For Inspectors

- Record inspection findings clearly.
- Keep accepted, rejected, and observation counts accurate.
- Use checklist items for repeatable inspection criteria.
- Upload supporting evidence where required.

### 23.5 For Administrators

- Keep user status and reporting hierarchy current.
- Keep signatures up to date for users who sign official outputs.
- Maintain active project hierarchy and serial numbers.
- Avoid deleting master data used by existing inspection requests.

---

## 24. Troubleshooting

### 24.1 I Cannot See a Menu Item

Your role may not have permission for that area. Contact an administrator if you believe access is missing.

### 24.2 I Cannot Edit a Request

Requests are editable only in specific statuses and by specific roles. Closed, completed, rejected, or unrelated requests may be read-only.

### 24.3 A Required Serial Number Is Missing

Ask an administrator to add the serial number under the correct LRU or SRU in Projects.

### 24.4 The Inspection Stage Is Missing

Ask an administrator to add or activate the inspection type item under Inspection Types.

### 24.5 Signature Is Not Showing in PDF

Ask an administrator to upload or replace the user's scanned signature in User Management.

### 24.6 Session Expired

Sign in again. If the timeout warning appears, select Stay Logged In before the countdown ends.

### 24.7 Report Download Did Not Start

Check browser pop-up settings, download permissions, and filters. Try View On Screen first to confirm report data exists.

---

## 25. Glossary

CABS: Centre for Airborne Systems.

QMS: Quality Management System.

R&QA: Reliability and Quality Assurance.

ORDAQA: External or organizational R&QA authority involved when selected in Part II.

IR: Inspection Request.

LRU: Line Replaceable Unit.

SRU: Shop Replaceable Unit.

Part I: Designer or initiator section of the request.

Part II: R&QA office use section.

Part III: ORDAQA office use section.

Part IV: CABS R&QA inspection report section.

Request Approver: User who forwards, sends back, or rejects initiator requests.

Team Head - QA: QA user nominated by QA Head to manage assignment and closure.

Inspector / QA Rep: User assigned to perform and record inspection details.

---

## 26. Support

For access problems, password issues, role changes, missing master data, or workflow questions, contact your QMS administrator.

For deployment, server, or technical issues, contact the system support team responsible for this QMS installation.

