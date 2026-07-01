# Quick Setup Guide

## Step-by-Step Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup PostgreSQL Database

**Create Database:**
```bash
createdb qms_db
```

**Or using psql:**
```bash
psql -U postgres
CREATE DATABASE qms_db;
\q
```

### 3. Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings:
```env
DATABASE_URL=postgresql://your_username:your_password@localhost:5432/qms_db
NEXTAUTH_SECRET=run_openssl_rand_-base64_32_to_generate
NEXTAUTH_URL=http://localhost:3000
```

### 4. Initialize Database
```bash
npm run db:init
```

You should see:
```
Database initialized successfully!
Default admin credentials:
Email: admin@qms.com
Password: admin123
```

### 5. Start Development Server
```bash
npm run dev
```

### 6. Login

Open [http://localhost:3000](http://localhost:3000)

Use the default credentials:
- **Email**: admin@qms.com
- **Password**: admin123

## Troubleshooting

### "Connection refused" error
- Make sure PostgreSQL is running: `brew services start postgresql` (macOS) or `sudo service postgresql start` (Linux)
- Check if PostgreSQL is listening: `pg_isready`

### "Database does not exist" error
- Create the database: `createdb qms_db`

### "Invalid credentials" error
- Make sure you ran `npm run db:init`
- Check the database has the users table: `psql qms_db -c "\dt"`

### Port already in use
- Change the port: `npm run dev -- -p 3001`

## Database Commands

### View all tables
```bash
psql qms_db -c "\dt"
```

### View users
```bash
psql qms_db -c "SELECT * FROM users;"
```

### Reset database
```bash
dropdb qms_db
createdb qms_db
npm run db:init
```

## Development Tips

- The sidebar is collapsible - click the menu button in the header
- Dark mode is automatically supported
- All routes under `/dashboard` are protected
- The middleware handles authentication automatically

## Next Steps

1. Change the default admin password
2. Create additional users via the Users page
3. Customize the menu items in `app/dashboard/layout.tsx`
4. Add your own pages and features
5. Configure the settings in the Settings page

Enjoy building your Quality Management System! 🚀

