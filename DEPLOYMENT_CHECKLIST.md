# QMS Deployment Checklist

Use this checklist when deploying QMS to a new system.

## Pre-Deployment Preparation

### Files to Include in Distribution

- [ ] All source code files (app/, components/, lib/, etc.)
- [ ] Configuration files (package.json, tsconfig.json, etc.)
- [ ] Database files (database/, scripts/)
- [ ] Setup scripts (setup.js, setup.ps1, setup.sh)
- [ ] Documentation (*.md files)
- [ ] Environment template (env.template)
- [ ] Public assets (public/, excluding uploads/)

### Files to EXCLUDE from Distribution

- [ ] node_modules/ (will be installed during setup)
- [ ] .env (contains sensitive data)
- [ ] .next/ (build artifacts)
- [ ] public/uploads/* (user data)
- [ ] *.log files
- [ ] .DS_Store, Thumbs.db (OS files)

## System Requirements Verification

- [ ] Node.js 18 or higher installed
- [ ] PostgreSQL 12 or higher installed
- [ ] PostgreSQL service is running
- [ ] Database created for QMS
- [ ] Sufficient disk space (minimum 1GB)
- [ ] Network access (if applicable)

## Installation Steps

- [ ] Copy project folder to target system
- [ ] Open terminal/command prompt in project directory
- [ ] Run setup script: `npm run setup`
  - Alternative: `node setup.js`
  - Windows: `.\setup.ps1`
  - Linux/Mac: `./setup.sh`
- [ ] Follow interactive prompts

## Configuration Steps

### Environment Variables (.env)

- [ ] DATABASE_URL configured correctly
  ```
  Format: postgresql://username:password@host:port/database
  Example: postgresql://postgres:mypassword@localhost:5432/qms_db
  ```
- [ ] NEXTAUTH_SECRET generated (min 32 characters)
  ```bash
  # Generate with:
  openssl rand -base64 32
  ```
- [ ] NEXTAUTH_URL set to correct domain
  - Development: `http://localhost:3000`
  - Production: `https://yourdomain.com`
- [ ] AUTH_TRUST_HOST set to `true`
- [ ] Optional: Email configuration (SENDGRID_API_KEY, EMAIL_FROM)
- [ ] Optional: CRON_SECRET for automated jobs

### Database Initialization

- [ ] Database connection tested: `npm run db:test`
- [ ] Database initialized: `npm run db:init`
- [ ] Default users created successfully
- [ ] Users verified: `npm run db:check-users`

### Directory Structure

- [ ] public/uploads/ directory exists
- [ ] public/uploads/inspection_request/ exists
- [ ] public/uploads/quality_check/ exists
- [ ] public/uploads/document/ exists
- [ ] Proper file permissions set (read/write for app)

## Testing

### Basic Tests

- [ ] Application starts: `npm run dev`
- [ ] Application accessible at http://localhost:3000
- [ ] Login page loads correctly
- [ ] Can login with admin@qms.com / admin123
- [ ] Dashboard displays without errors
- [ ] Navigation menu works

### User Access Tests

- [ ] Admin login works (admin@qms.com)
- [ ] Inspector login works (inspector@qms.com)
- [ ] Approver login works (approver@qms.com)
- [ ] Initiator login works (initiator@qms.com)

### Functionality Tests

- [ ] Can create new user
- [ ] Can create inspection request
- [ ] Can upload attachments
- [ ] Can create inspection checklist
- [ ] Can perform quality checks
- [ ] Can generate reports
- [ ] Can view documents

## Security Configuration

### Immediate Security Steps

- [ ] Change all default passwords
  - admin@qms.com
  - inspector@qms.com
  - approver@qms.com
  - initiator@qms.com
- [ ] Verify NEXTAUTH_SECRET is unique and strong
- [ ] Review database user permissions
- [ ] Ensure .env is not accessible publicly

### Production Security (if applicable)

- [ ] HTTPS enabled
- [ ] SSL certificate installed and valid
- [ ] Firewall configured
- [ ] Database backups scheduled
- [ ] Update server OS and packages
- [ ] Disable unnecessary services
- [ ] Configure rate limiting
- [ ] Set up monitoring and logging
- [ ] Review and harden PostgreSQL configuration

## Production Build (Optional)

For production deployment:

- [ ] Build application: `npm run build`
- [ ] Test production build: `npm start`
- [ ] Configure process manager (PM2, systemd, etc.)
- [ ] Set up reverse proxy (nginx, Apache, etc.)
- [ ] Configure auto-restart on failure
- [ ] Set up log rotation

## Post-Deployment

### System Configuration

- [ ] Company information configured in settings
- [ ] Departments added
- [ ] Positions defined
- [ ] User roles assigned correctly
- [ ] Email notifications configured (if applicable)
- [ ] Cron jobs set up (if applicable)

### User Setup

- [ ] Admin accounts created
- [ ] Inspector accounts created
- [ ] Approver accounts created
- [ ] Initiator accounts created
- [ ] User permissions verified
- [ ] Users trained on system

### Documentation

- [ ] Users have access to USER_GUIDE.md
- [ ] Administrators familiar with system
- [ ] Backup procedures documented
- [ ] Support contact information provided

## Backup Plan

- [ ] Database backup strategy established
- [ ] File upload backup strategy established
- [ ] Backup restoration tested
- [ ] Backup schedule automated
- [ ] Off-site backup configured (if applicable)

## Monitoring & Maintenance

- [ ] System monitoring set up
- [ ] Error logging configured
- [ ] Disk space monitoring enabled
- [ ] Database performance monitoring
- [ ] Regular maintenance schedule established
- [ ] Update procedure documented

## Troubleshooting Contacts

Record important information:

- **System Administrator:** ___________________
- **Database Administrator:** ___________________
- **Support Email:** ___________________
- **Database Server:** ___________________
- **Application Server:** ___________________

## Common Issues Reference

### Database Connection Failed
1. Check PostgreSQL is running
2. Verify DATABASE_URL in .env
3. Test connection: `npm run db:test`
4. Check firewall rules

### Authentication Errors
1. Verify NEXTAUTH_SECRET is set
2. Check NEXTAUTH_URL matches domain
3. Ensure AUTH_TRUST_HOST=true
4. Clear browser cookies/cache

### File Upload Issues
1. Check uploads directory exists
2. Verify write permissions
3. Check disk space
4. Review file size limits

### Performance Issues
1. Check database indexes
2. Review query performance
3. Monitor server resources
4. Check network latency

## Sign-off

- [ ] Installation completed by: _____________ Date: _______
- [ ] Configuration verified by: _____________ Date: _______
- [ ] Security review completed by: _________ Date: _______
- [ ] User training completed by: ___________ Date: _______
- [ ] System accepted by: __________________ Date: _______

---

**Version:** 1.0
**Last Updated:** October 2025

For additional help, see:
- INSTALLATION.md - Detailed installation guide
- TROUBLESHOOTING.md - Common issues and solutions
- docs/USER_GUIDE.md - End user documentation

