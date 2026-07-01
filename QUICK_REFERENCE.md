# Quick Reference - Inspection System

## 🚀 Quick Start

### Test Accounts
```
Administrator: admin@qms.com / admin123
Inspector:     inspector@qms.com / admin123  
Approver:      approver@qms.com / admin123
Initiator:     initiator@qms.com / admin123
```

### Access Application
```
http://localhost:3003  (or check your terminal for the actual port)
```

---

## 📊 Status Flow (Quick View)

```
pending → assigned → in_progress → completed → approved → closed
                                              ↘ rejected
```

| Status | Who Sets It | Next Available |
|--------|-------------|----------------|
| pending | Initiator (auto) | assigned |
| assigned | Administrator | in_progress |
| in_progress | Assigned Inspector | completed |
| completed | Assigned Inspector | approved, rejected |
| approved | Approver | closed |
| rejected | Approver | (terminal) |
| closed | Approver | (terminal - final) |

---

## 🔑 Quick Actions by Role

### Initiator
- ✅ Create requests
- ✅ View own requests
- ✅ Upload attachments

### Inspector (Assigned Only)
- ✅ Start inspection: `assigned` → `in_progress`
- ✅ Create checklists
- ✅ Add checklist items
- ✅ Upload evidence
- ✅ Complete: `in_progress` → `completed`

### Approver
- ✅ Approve: `completed` → `approved`
- ✅ Reject: `completed` → `rejected` (with reason)
- ✅ Close: `approved` → `closed` (NEW)
- ✅ Generate reports

### Administrator
- ✅ All of the above
- ✅ Assign inspectors: `pending` → `assigned`
- ✅ Manage users

---

## 🔗 API Endpoints (Quick Reference)

### Assignment
```http
PUT /api/inspection-requests/[id]/assign
Body: { inspector_id: 2, approver_id?: 3 }
Auth: Administrator only
```

### Status Update
```http
PUT /api/inspection-requests/[id]/status
Body: { status: "in_progress" }
Auth: Assigned inspector or admin
```

### Approve
```http
PUT /api/inspection-requests/[id]/approve
Auth: Approver or administrator
Requirement: status === "completed"
```

### Reject
```http
PUT /api/inspection-requests/[id]/reject
Body: { reason: "Missing documentation" }
Auth: Approver or administrator
Requirement: status === "completed"
```

### Close (NEW)
```http
PUT /api/inspection-requests/[id]/close
Body: { notes?: "Verification complete" }
Auth: Approver or administrator
Requirement: status === "approved"
```

---

## ⚡ Common Commands

```bash
# Start development server
npm run dev

# Test database connection
npm run db:test

# Check users and passwords
npm run db:check-users

# Test login authentication
npm run db:test-login

# Initialize/reset database
npm run db:init
```

---

## ⚠️ Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid email or password" | Wrong credentials or server issue | Use exact credentials, restart server |
| "You can only update requests assigned to you" | Not the assigned inspector | Login as the correct inspector |
| "Request must be completed before approval" | Wrong status | Inspector must complete first |
| "Request must be approved before closure" | Wrong status | Approver must approve first |
| 403 Forbidden | Permission denied | Check your role and assignment |

---

## 📚 Documentation Files

- **IMPLEMENTATION_SUMMARY.md** - Complete implementation details
- **ASSIGNMENT_APPROVAL_CLOSURE_FEATURES.md** - Feature documentation
- **INSPECTION_WORKFLOW.md** - Detailed workflow guide
- **TROUBLESHOOTING.md** - Login and technical issues
- **README.md** - Full project documentation

---

## 🧪 Test Scenario (5 Minutes)

1. **Login as Initiator** → Create inspection request
2. **Login as Admin** → Assign to inspector@qms.com
3. **Login as Inspector** → Start → Add checklist → Complete
4. **Login as Approver** → Approve
5. **Stay as Approver** → Close (NEW feature)

✅ Done! Full lifecycle tested.

---

## 🎯 Key Features Implemented

✅ Inspector assignment by administrators
✅ Permission enforcement (only assigned inspector can update)
✅ Approval system with validation
✅ Rejection system with mandatory reason
✅ **Closure system (NEW)** - official final closure
✅ Notifications at every stage
✅ Complete audit trail
✅ Role-based UI

---

**Need Help?** See TROUBLESHOOTING.md or IMPLEMENTATION_SUMMARY.md


