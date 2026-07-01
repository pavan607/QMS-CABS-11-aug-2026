# Quick Start Guide - Quality Management System

## 🎉 Implementation Complete!

All features from your requirements have been successfully implemented. Here's how to get started.

## ⚡ Quick Setup (5 minutes)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Set Up Environment
```bash
# Copy the example environment file
cp .env.example .env.local

# Edit .env.local with your database details
# Minimum required:
DATABASE_URL=postgresql://user:password@localhost:5432/qms
NEXTAUTH_SECRET=<generate-with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
```

### Step 3: Initialize Database
```bash
# This will create all tables and default users
npm run db:init
```

### Step 4: Start Development Server
```bash
npm run dev
```

### Step 5: Login
Open http://localhost:3000 and login with:

**Administrator Account:**
- Email: `admin@qms.com`
- Password: `admin123`

**Test Accounts (optional):**
- Inspector: `inspector@qms.com` / `admin123`
- Approver: `approver@qms.com` / `admin123`
- Initiator: `initiator@qms.com` / `admin123`

⚠️ **IMPORTANT**: Change all passwords immediately!

---

## 📋 What You Can Do Immediately

### As Administrator
1. Go to Users → Create new users with proper roles
2. Change the default admin password
3. Review system settings
4. Assign inspectors to inspection requests

### As Initiator
1. Click "New Request" to create an inspection request
2. Fill in location, item, type, priority, due date
3. Attach documents if needed
4. Submit for review

### As Inspector
1. View assigned inspection requests
2. Start inspection (status → in progress)
3. Create checklists with items
4. Upload photos and evidence
5. Mark items as pass/fail
6. Complete inspection

### As Approver
1. View completed inspections
2. Review checklists and evidence
3. Approve or reject with reason
4. Generate reports

---

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Frontend (Next.js)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │Dashboard │  │Inspections│ │Reports   │     │
│  └──────────┘  └──────────┘  └──────────┘     │
└─────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────┐
│           API Routes (Next.js)                  │
│  ┌──────────────┐  ┌──────────────┐           │
│  │RBAC Middleware│  │Notifications │           │
│  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────┐
│            PostgreSQL Database                  │
│  • 18 Tables  • 25 Indexes  • Audit Logs       │
└─────────────────────────────────────────────────┘
```

---

## 📁 Key File Locations

### Backend APIs
- `app/api/inspection-requests/` - Inspection management
- `app/api/inspection-checklists/` - Checklist system
- `app/api/attachments/` - File uploads
- `app/api/notifications/` - Notification center
- `app/api/reports/` - Report generation
- `app/api/users/` - User management

### Frontend Pages
- `app/dashboard/page.tsx` - Main dashboard
- `app/dashboard/inspections/` - Inspection management UI
- `app/dashboard/inspections/[id]/` - Detailed inspection view

### Core Libraries
- `lib/permissions.ts` - RBAC system
- `lib/notifications.ts` - Notification functions
- `lib/report-generator.ts` - Report generation
- `lib/db.ts` - Database connection

### Database
- `database/schema.sql` - Complete database schema
- `database/init.ts` - Initialization script

---

## 🎯 Common Tasks

### Create an Inspection Request
```
1. Login as Initiator
2. Click "New Request" button
3. Fill in:
   - Title (e.g., "Monthly Equipment Inspection")
   - Location (e.g., "Building A, Floor 2")
   - Item (e.g., "HVAC System")
   - Type (e.g., "Routine")
   - Priority (e.g., "Medium")
   - Due Date
4. Attach documents (optional)
5. Click "Create Request"
```

### Assign an Inspector
```
1. Login as Administrator
2. Go to Inspections
3. Click on a pending request
4. Click "Assign Inspector"
5. Select inspector and approver
6. Save
```

### Perform an Inspection
```
1. Login as Inspector
2. View assigned requests
3. Click "Start Inspection"
4. Create checklist
5. Add checklist items
6. Upload photos/evidence
7. Mark items as pass/fail
8. Add findings/notes
9. Click "Mark Complete"
```

### Generate a Report
```
1. Login as Approver or Administrator
2. Go to Reports
3. Select report type:
   - Inspection Summary
   - Statistical Analysis
   - Overdue Inspections
   - Compliance Report
4. Choose filters (date range, status, etc.)
5. Select format (CSV or JSON)
6. Click "Generate"
```

---

## 🔔 Set Up Automated Alerts

### For Vercel Deployment
The `vercel.json` is already configured. Alerts will run every 6 hours automatically.

### For Other Deployments
Set up a cron job:
```bash
# In your crontab (runs every 6 hours):
0 */6 * * * curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/check-alerts
```

Alerts check for:
- Overdue inspections
- Pending approvals (>24 hours)
- Upcoming due dates (3-day warning)

---

## 📧 Email Integration (Optional)

To enable email notifications, update `lib/notifications.ts`:

### Using SendGrid
```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

await sgMail.send({
  to: email,
  from: process.env.EMAIL_FROM,
  subject: title,
  text: message,
  html: `<p>${message}</p>`,
});
```

Add to `.env.local`:
```env
SENDGRID_API_KEY=your-key-here
EMAIL_FROM=noreply@yourdomain.com
```

---

## 🧪 Testing Workflow

### Complete Testing Flow
1. **Create Request** (as Initiator)
   - Login: `initiator@qms.com`
   - Create a new inspection request
   - Verify notification appears

2. **Assign Inspector** (as Administrator)
   - Login: `admin@qms.com`
   - Assign request to inspector
   - Verify email/notification sent

3. **Perform Inspection** (as Inspector)
   - Login: `inspector@qms.com`
   - Start inspection
   - Create checklist
   - Add items
   - Upload photos
   - Mark complete

4. **Approve** (as Approver)
   - Login: `approver@qms.com`
   - Review inspection
   - Approve or reject
   - Verify notifications sent

5. **Generate Report** (as Approver)
   - Generate various report types
   - Export to CSV
   - Verify data accuracy

---

## 📊 Dashboard Features

The dashboard shows:
- Total inspections count
- In-progress inspections
- Overdue inspections (with alert)
- Completion rate percentage
- Recent inspection requests
- Latest notifications
- Status distribution chart
- Priority distribution chart

Auto-refreshes data periodically!

---

## 🔐 Security Checklist

- [ ] Change all default passwords
- [ ] Generate strong NEXTAUTH_SECRET
- [ ] Set up HTTPS in production
- [ ] Configure firewall for database
- [ ] Review user permissions
- [ ] Enable email notifications
- [ ] Set up backup schedule
- [ ] Review audit logs regularly

---

## 📱 Mobile Access

The UI is fully responsive! Access from:
- Desktop browsers
- Tablets
- Mobile phones

All features work on mobile devices.

---

## 🚀 Production Deployment

### Vercel (Recommended)
```bash
npm i -g vercel
vercel
```

### Manual Deployment
```bash
npm run build
npm start
```

Requirements:
- Node.js 18+
- PostgreSQL accessible
- Environment variables set
- HTTPS enabled

---

## 📚 Learn More

- **Complete Documentation**: See `IMPLEMENTATION_GUIDE.md`
- **All Features**: See `FEATURES_IMPLEMENTED.md`
- **API Docs**: See inline comments in `app/api/`
- **Database Schema**: See `database/schema.sql`
- **User Guide**: See `docs/USER_GUIDE.md`

---

## 💡 Tips & Best Practices

1. **Regular Backups**: Backup PostgreSQL database daily
2. **Monitor Alerts**: Check cron job logs regularly
3. **Audit Logs**: Review audit trail for compliance
4. **User Training**: Train users on their role workflows
5. **Performance**: Add indexes for custom queries
6. **Files**: Consider cloud storage for production (S3, Cloudinary)
7. **Email**: Set up transactional email service
8. **Updates**: Keep dependencies updated regularly

---

## 🆘 Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
psql -d qms -U postgres

# Verify DATABASE_URL in .env.local
```

### Login Not Working
```bash
# Re-run database init
npm run db:init

# Clear browser cookies
```

### Files Not Uploading
```bash
# Check uploads directory exists
mkdir -p public/uploads

# Check permissions
chmod 755 public/uploads
```

---

## 🎊 You're All Set!

The system is fully functional and ready to use. Start by:
1. Creating a few test inspection requests
2. Trying the complete workflow
3. Generating some reports
4. Customizing for your needs

**Need Help?** Check the documentation or review the code comments.

**Happy Quality Managing! 🎯**

