# Quality Management System (QMS)

A comprehensive inspection and quality tracking platform built with Next.js 15, TypeScript, PostgreSQL, and NextAuth.

## 🎯 Features Overview

This QMS implementation includes all requested features from the RFP:

### ✅ User Management
- **4 Role-Based Access Levels**: Initiator, Inspector, Approver, Administrator
- User registration, login, and profile management
- Secure password management with reset functionality
- Department and position tracking

### ✅ Inspection Request Management
- Online submission with comprehensive details:
  - Auto-generated request numbers (IR-YYYY-NNNNN)
  - Date, location, item, type, priority, due date
  - Document attachment support
- Inspector assignment by administrators
- Real-time status tracking (6 states: pending → assigned → in_progress → completed → approved/rejected)
- Automated email and in-app notifications

### ✅ Inspection Activity Tracking
- Digital checklists with customizable items
- Pass/Fail/N/A status for each checklist item
- Photo and document upload as evidence (max 10MB per file)
- Real-time activity timeline with auto-refresh
- Findings, corrective actions, and inspector notes

### ✅ Report Generation
- Multiple report types:
  - Inspection Summary
  - Statistical Analysis
  - Overdue Inspections
  - Compliance Reports
- Export formats: JSON and CSV (Excel-compatible)
- Comprehensive filtering options
- Historical data analysis

### ✅ Notifications & Alerts
- **Email notifications** for key events:
  - Request submission
  - Assignment
  - Completion
  - Approval/Rejection
- **In-app notification center** with unread badges
- **Automated alerts** for:
  - Overdue inspections
  - Pending approvals (>24 hours)
  - Upcoming due dates (3-day warning)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd QMS
   npm install
   ```

2. **Set up environment variables**
   ```bash
   # Copy the example env file
   cp .env.example .env.local
   
   # Edit .env.local with your settings
   ```

   Required environment variables:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/qms
   NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
   NEXTAUTH_URL=http://localhost:3000
   ```

3. **Initialize the database**
   ```bash
   npm run db:init
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Open http://localhost:3000
   - Login with default admin account:
     - Email: `admin@qms.com`
     - Password: `admin123`
   - **⚠️ Change this password immediately!**

## 📁 Project Structure

```
QMS/
├── app/
│   ├── api/                          # API routes
│   │   ├── inspection-requests/      # Inspection CRUD & operations
│   │   ├── inspection-checklists/    # Checklist management
│   │   ├── attachments/              # File upload handling
│   │   ├── notifications/            # Notification system
│   │   ├── reports/                  # Report generation
│   │   ├── users/                    # User & auth management
│   │   └── cron/                     # Automated alert jobs
│   ├── dashboard/                    # Main application UI
│   │   ├── inspections/              # Inspection management pages
│   │   ├── documents/                # Document management
│   │   ├── quality-checks/           # Quality checks
│   │   ├── reports/                  # Reports interface
│   │   ├── users/                    # User management
│   │   └── settings/                 # System settings
│   └── login/                        # Authentication pages
├── components/
│   └── ui/                           # Reusable UI components (shadcn/ui)
├── lib/
│   ├── db.ts                         # Database connection
│   ├── permissions.ts                # RBAC logic
│   ├── notifications.ts              # Notification utilities
│   └── report-generator.ts           # Report generation logic
├── database/
│   ├── schema.sql                    # Complete database schema
│   └── init.ts                       # Database initialization script
└── public/
    └── uploads/                      # File upload storage
```

## 🔐 User Roles & Permissions

| Feature | Initiator | Inspector | Approver | Administrator |
|---------|-----------|-----------|----------|---------------|
| **Inspection Requests** | | | | |
| Create Requests | ✅ | ❌ | ❌ | ✅ |
| View All Requests | ✅ | ❌ | ✅ | ✅ |
| View Assigned Only | ❌ | ✅ | ❌ | N/A |
| Update Own Pending | ✅ | ❌ | ❌ | ✅ |
| Update Assigned | ❌ | ✅ | ❌ | ✅ |
| **Checklists** | | | | |
| View Checklists | ✅ | ✅ | ✅ | ✅ |
| Create/Update Checklists | ❌ | ✅ | ❌ | ✅ |
| **Quality Checks** | | | | |
| View Quality Checks | ✅ | ✅ | ✅ | ✅ |
| Create/Update Quality Checks | ❌ | ✅ | ✅ | ✅ |
| **Other Features** | | | | |
| Assign Inspectors | ❌ | ❌ | ❌ | ✅ |
| Approve/Reject | ❌ | ❌ | ✅ | ✅ |
| Close Inspections | ❌ | ❌ | ✅ | ✅ |
| Upload Files | ✅ | ✅ | ❌ | ✅ |
| Generate Reports | ✅ | ✅ | ✅ | ✅ |
| Manage Users | ❌ | ❌ | ❌ | ✅ |
| **Dashboard** | | | | |
| View All Data | ✅ | ❌ | ✅ | ✅ |
| View Assigned Data | ❌ | ✅ | ❌ | N/A |

### Key Points

**Initiator:**
- ✅ Can view ALL inspection requests (like admin)
- ✅ Can view checklists and quality checks (read-only)
- ✅ Dashboard shows all organization data
- ❌ Cannot create or update checklists
- ❌ Cannot create or update quality checks
- ❌ Cannot modify other users' inspection requests

**Inspector:**
- ✅ Can view only assigned inspection requests
- ✅ Can create and update checklists for assigned inspections
- ✅ Can create quality checks for assigned inspections
- ✅ Dashboard shows assigned inspection data only

**Approver:**
- ✅ Can view all inspection requests
- ✅ Can create and update quality checks
- ✅ Can approve/reject/close inspections
- ✅ Dashboard shows all organization data

**Administrator:**
- ✅ Full access to all features
- ✅ Can perform any action

## 📊 Database Schema

The system uses 18 PostgreSQL tables:

### Core Tables
- `users` - User accounts with roles
- `inspection_requests` - Main inspection tracking
- `inspection_checklists` - Checklist templates
- `checklist_items` - Individual checklist items
- `attachments` - File uploads (universal)
- `notifications` - Notification queue
- `inspection_activities` - Activity timeline

### Supporting Tables
- `documents` - Document management
- `quality_checks` - Quality check records
- `reports` - Generated reports
- `audit_logs` - Complete audit trail
- `password_reset_tokens` - Password reset
- Plus NextAuth tables (sessions, accounts, etc.)

## 🔔 Setting Up Automated Alerts

### Option 1: Vercel Cron (Recommended)
The `vercel.json` is already configured for automatic alerts every 6 hours.

### Option 2: External Cron Service
Set up a cron job to call:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
     https://your-domain.com/api/cron/check-alerts
```

Recommended schedule: `0 */6 * * *` (every 6 hours)

## 📧 Email Integration

Email notifications are ready to integrate. Update `lib/notifications.ts` function `sendEmailNotification()`:

```typescript
// Example with SendGrid
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

## 🛠️ Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run db:init      # Initialize database with schema
```

### Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, PostgreSQL
- **Auth**: NextAuth v5
- **UI**: shadcn/ui components
- **Icons**: Lucide React

## 📱 API Endpoints

### Inspection Requests
- `GET /api/inspection-requests` - List all requests (with filters)
- `POST /api/inspection-requests` - Create new request
- `GET /api/inspection-requests/[id]` - Get single request
- `PUT /api/inspection-requests/[id]` - Update request
- `DELETE /api/inspection-requests/[id]` - Delete request (admin only)
- `PUT /api/inspection-requests/[id]/assign` - Assign inspector
- `PUT /api/inspection-requests/[id]/status` - Update status
- `PUT /api/inspection-requests/[id]/approve` - Approve request
- `PUT /api/inspection-requests/[id]/reject` - Reject request
- `GET /api/inspection-requests/stats` - Get statistics

### Checklists
- `GET /api/inspection-checklists` - List checklists
- `POST /api/inspection-checklists` - Create checklist
- `GET /api/inspection-checklists/[id]` - Get checklist with items
- `PUT /api/inspection-checklists/[id]` - Update checklist
- `POST /api/inspection-checklists/[id]/items` - Add checklist item
- `PUT /api/inspection-checklists/items/[id]` - Update item
- `DELETE /api/inspection-checklists/items/[id]` - Delete item

### Attachments & More
- `POST /api/attachments` - Upload file
- `GET /api/notifications` - Get user notifications
- `POST /api/reports/generate` - Generate report
- See IMPLEMENTATION_GUIDE.md for complete API documentation

## 🔒 Security Features

- ✅ Bcrypt password hashing
- ✅ Role-based access control (RBAC)
- ✅ Complete audit trail logging
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS protection (React auto-escaping)
- ✅ File upload validation (type & size)
- ✅ Secure session management (NextAuth)

## 📖 Documentation

- `docs/QMS_Training_Manual.md` / `docs/QMS_Training_Manual.docx` - Instructor-led training manual with role exercises (Markdown + Word; `npm run docs:training`)
- `docs/QMS_Training_Presentation.pptx` - Training slide deck with UI screenshots (`npm run training:ppt`)
- `docs/QMS_Technical_Documentation.docx` - Technical architecture and APIs (Word; `npm run docs:technical`)
- `docs/QMS_Deployment_and_Configuration_Guide.docx` - Deployment and configuration (Word; `npm run docs:deployment`)
- `docs/QMS_Testing_and_Validation_Report.docx` - Testing and validation report with test cases (Word; `npm run docs:testing`)
- `IMPLEMENTATION_GUIDE.md` - Comprehensive implementation details
- `database/schema.sql` - Complete database schema with comments
- `SETUP.md` - Detailed setup instructions
- `docs/USER_GUIDE.md` - End-user documentation

## 🎨 Screenshots

The UI features:
- Modern, clean dashboard with real-time statistics
- Responsive design for mobile and desktop
- Intuitive inspection request forms
- Real-time activity timeline with auto-refresh
- Comprehensive filtering and search
- File upload with preview
- Notification center with badges

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm i -g vercel
vercel
```

### Other Platforms
1. Build the project: `npm run build`
2. Set environment variables
3. Run: `npm start`
4. Ensure PostgreSQL is accessible
5. Set up cron job for `/api/cron/check-alerts`

## 📝 License

Proprietary - TechFLUENT Solutions Pvt Ltd

## 🤝 Support

For technical support or questions:
- Review the IMPLEMENTATION_GUIDE.md
- Check API documentation in code comments
- Examine database schema in database/schema.sql

---

**Built with ❤️ for efficient quality management**
