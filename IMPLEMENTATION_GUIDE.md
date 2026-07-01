# QMS Implementation Guide

## Overview

This Quality Management System (QMS) is a comprehensive inspection and quality tracking platform built with Next.js 15, TypeScript, PostgreSQL, and NextAuth.

## Features Implemented

### 1. User Management
- **Role-Based Access Control (RBAC)** with 4 roles:
  - `initiator`: Can create and manage their own inspection requests
  - `inspector`: Can perform inspections, create checklists, and upload evidence
  - `approver`: Can approve or reject completed inspections
  - `administrator`: Full system access with all permissions

- **Authentication Features**:
  - Secure login with email/password
  - User profile management (name, phone, department, position)
  - Password change functionality
  - Password reset via token (email integration ready)

### 2. Inspection Request Management
- **Request Submission**: Online forms with all required fields
  - Request number (auto-generated: IR-YYYY-NNNNN)
  - Date, location, item, type of inspection
  - Priority levels (low, medium, high, critical)
  - Due dates and scheduled dates
  - Document attachments

- **Request Assignment**: Admins can assign inspectors and approvers
- **Status Tracking**: Real-time status updates through 6 states
  - `pending`: Newly created, awaiting assignment
  - `assigned`: Assigned to inspector
  - `in_progress`: Inspector actively working
  - `completed`: Inspector finished, awaiting approval
  - `approved`: Approved by approver
  - `rejected`: Rejected with reason

- **Automated Notifications**: Email and in-app notifications for:
  - Request submission
  - Inspector assignment
  - Status changes
  - Completion
  - Approval/Rejection
  - Overdue alerts

### 3. Inspection Activity Tracking
- **Digital Checklists**: Create and manage inspection checklists
  - Customizable checklist items
  - Pass/Fail/N/A status for each item
  - Findings and corrective actions
  - Inspector notes

- **Evidence Upload**: Photo and document attachments
  - Support for multiple file types
  - File size limit: 10MB per file
  - Attachments linked to requests or checklist items

- **Real-Time Activity Timeline**:
  - All actions logged with timestamps
  - User attribution for all activities
  - Activity types: started, paused, checkpoint, photo_uploaded, etc.
  - Auto-refresh every 30 seconds on detail pages

### 4. Report Generation
- **Report Types**:
  - Inspection Summary Report
  - Statistical Analysis Report
  - Overdue Inspections Report
  - Compliance Report

- **Export Formats**:
  - JSON (for API integration)
  - CSV (Excel-compatible)
  - Data ready for PDF generation

- **Filters**:
  - Date ranges
  - Status, priority, type
  - Inspector, initiator

### 5. Notifications and Alerts
- **In-App Notifications**: Real-time notification center
  - Unread badge count
  - Mark as read functionality
  - Notification types: info, success, warning, error

- **Email Notifications**: Template-ready (integration required)
  - Request lifecycle events
  - Overdue alerts
  - Pending approval reminders

- **Automated Alerts**:
  - Overdue inspections (daily check)
  - Pending approvals (after 24 hours)
  - Upcoming due dates (3-day warning)
  - Cron job endpoint: `/api/cron/check-alerts`

## Technical Architecture

### Backend
- **API Routes**: RESTful API with Next.js App Router
  - `/api/inspection-requests` - CRUD operations
  - `/api/inspection-requests/[id]` - Single request operations
  - `/api/inspection-requests/[id]/assign` - Assignment
  - `/api/inspection-requests/[id]/status` - Status updates
  - `/api/inspection-requests/[id]/approve` - Approval
  - `/api/inspection-requests/[id]/reject` - Rejection
  - `/api/inspection-checklists` - Checklist management
  - `/api/attachments` - File uploads
  - `/api/notifications` - Notification system
  - `/api/reports/generate` - Report generation
  - `/api/users/profile` - Profile management
  - `/api/users/change-password` - Password change
  - `/api/users/request-password-reset` - Password reset request
  - `/api/users/reset-password` - Password reset with token

### Database
- **PostgreSQL** with comprehensive schema:
  - 18 tables covering all functionality
  - Foreign key relationships for data integrity
  - Indexes for performance optimization
  - JSONB fields for flexible data storage

### Frontend
- **React Components**: Modern, accessible UI with shadcn/ui
  - Dashboard with real-time statistics
  - Inspection request list with filters
  - Detailed inspection view with tabs
  - File upload with drag-and-drop ready
  - Activity timeline with auto-refresh

### Security
- **Authentication**: NextAuth v5 with credentials provider
- **Authorization**: Permission-based access control
- **Audit Trail**: All actions logged with user, timestamp, and changes
- **Password Security**: bcrypt hashing with salt rounds

## Setup Instructions

### 1. Database Setup
```bash
# Create PostgreSQL database
createdb qms

# Set environment variable
echo "DATABASE_URL=postgresql://user:password@localhost:5432/qms" > .env.local

# Initialize database
npm run db:init
```

### 2. Environment Variables
Create `.env.local`:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/qms

# NextAuth
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# App URL (for email links)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron Secret (for automated alerts)
CRON_SECRET=your-cron-secret-here

# Email (optional - for notifications)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:3000`

### 5. Default Admin Account
After running `npm run db:init`, a default admin account is created:
- Email: `admin@qms.com`
- Password: `admin123`

**Important**: Change this password immediately in production!

## API Permissions Matrix

| Resource | Initiator | Inspector | Approver | Administrator |
|----------|-----------|-----------|----------|---------------|
| Create Request | ✓ | - | - | ✓ |
| View Own Requests | ✓ | - | - | ✓ |
| View Assigned Requests | - | ✓ | - | ✓ |
| View All Requests | - | - | ✓ | ✓ |
| Assign Inspector | - | - | - | ✓ |
| Update Request Status | - | ✓ (assigned) | - | ✓ |
| Create Checklist | - | ✓ | - | ✓ |
| Upload Attachments | ✓ | ✓ | - | ✓ |
| Approve/Reject | - | - | ✓ | ✓ |
| Generate Reports | - | - | ✓ | ✓ |
| Manage Users | - | - | - | ✓ |

## Automated Alerts Setup

### Using Vercel Cron (Recommended for Vercel deployments)
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/check-alerts",
    "schedule": "0 */6 * * *"
  }]
}
```

### Using External Cron Service
Configure cron-job.org or similar to call:
```
GET https://your-domain.com/api/cron/check-alerts
Authorization: Bearer your-cron-secret
```

Recommended frequency: Every 6 hours or daily

## File Upload Configuration

Files are stored in `public/uploads/` organized by entity type:
- `public/uploads/inspection_request/`
- `public/uploads/checklist_item/`

**Production**: Consider using cloud storage (AWS S3, Cloudinary, etc.)

## Email Integration

The notification system is ready for email integration. Update `lib/notifications.ts` function `sendEmailNotification()` to integrate with:
- SendGrid
- AWS SES
- Mailgun
- Resend
- Or any SMTP service

## Performance Optimizations

1. **Database Indexes**: All foreign keys and frequently queried fields are indexed
2. **API Pagination**: Ready to implement with limit/offset parameters
3. **Real-time Updates**: 30-second polling on detail pages (can be upgraded to WebSockets)
4. **File Size Limits**: 10MB per file to prevent server overload

## Security Best Practices

1. **Change Default Admin Password**: Immediately after setup
2. **Use Strong Secrets**: Generate secure NEXTAUTH_SECRET and CRON_SECRET
3. **Enable HTTPS**: In production
4. **Rate Limiting**: Consider adding rate limiting to API routes
5. **File Validation**: Add additional file type validation as needed
6. **SQL Injection**: All queries use parameterized statements
7. **XSS Protection**: React's built-in escaping + Content Security Policy recommended

## Next Steps

1. **Email Integration**: Complete email notification setup
2. **PDF Generation**: Integrate library like puppeteer or react-pdf
3. **Advanced Analytics**: Add charts with recharts or chart.js
4. **Mobile App**: Use the API to build a mobile companion
5. **Barcode/QR Scanning**: For quick inspection item lookup
6. **Advanced Search**: Implement full-text search with PostgreSQL
7. **Bulk Operations**: Import/export inspections in bulk
8. **Custom Workflows**: Configurable approval workflows
9. **Integration**: Connect with other systems via REST API

## Support

For questions or issues:
- Check the code comments for detailed explanations
- Review the database schema in `database/schema.sql`
- Examine API routes in `app/api/`
- Test with the provided UI components in `app/dashboard/`

## License

Proprietary - TechFLUENT Solutions Pvt Ltd

