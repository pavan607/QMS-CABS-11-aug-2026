import 'dotenv/config';
import pool from '@/lib/db';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export async function initDatabase() {
  try {
    console.log('Initializing database...');
    
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await pool.query(schema);
    
    const migrationsDir = path.join(process.cwd(), 'database', 'migrations');
    if (fs.existsSync(migrationsDir)) {
      console.log('Running database migrations...');
      const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      
      for (const file of migrationFiles) {
        console.log(`  Running migration: ${file}`);
        const migrationPath = path.join(migrationsDir, file);
        const migration = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(migration);
      }
      console.log('All migrations completed successfully!');
    }
    
    const pw = await bcrypt.hash('admin123', 10);

    const upsert = async (values: any[]) => {
      await pool.query(
        `INSERT INTO users (employee_id, email, password, name, role, designation, scientist_rank, department)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (employee_id) DO UPDATE SET
           password = EXCLUDED.password,
           name = EXCLUDED.name, designation = EXCLUDED.designation,
           scientist_rank = EXCLUDED.scientist_rank, department = EXCLUDED.department,
           role = EXCLUDED.role, email = EXCLUDED.email`,
        values
      );
    };

    // ── Admin (System Administrator) ─────────────────
    await upsert(['ADM001', 'admin@qms.com',            pw, 'Admin',              'administrator', null,  null,    'ORDAQA']);

    // ── GD001 Team (User Department) ─────────────────
    await upsert(['GD001',  'rajesh.sharma@qms.com',   pw, 'Rajesh Sharma',      'qa_approver', 'GD',  'Sc-H', 'User Department']);
    await upsert(['DGD001', 'arvind.patel@qms.com',    pw, 'Arvind Patel',       'request_approver', 'DGD', 'Sc-G', 'User Department']);
    await upsert(['DH001',  'vikram.nair@qms.com',     pw, 'Vikram Nair',        'request_approver', 'DH',  'Sc-G', 'User Department']);
    await upsert(['DH002',  'priya.menon@qms.com',     pw, 'Priya Menon',        'request_approver', 'DH',  'Sc-G', 'User Department']);
    await upsert(['TH001',  'deepak.joshi@qms.com',    pw, 'Deepak Joshi',       'inspector', 'TH', 'Sc-F', 'User Department']);
    await upsert(['TH002',  'kavitha.rao@qms.com',     pw, 'Kavitha Rao',        'inspector', 'TH', 'Sc-F', 'User Department']);
    await upsert(['TH004',  'neha.gupta@qms.com',      pw, 'Neha Gupta',         'inspector', 'TH', 'Sc-F', 'User Department']);
    await upsert(['DES001', 'amit.verma@qms.com',      pw, 'Amit Verma',         'initiator', 'Designer', 'Sc-E', 'User Department']);
    await upsert(['DES002', 'pooja.singh@qms.com',     pw, 'Pooja Singh',        'initiator', 'Designer', 'Sc-D', 'User Department']);
    await upsert(['DES003', 'rahul.mishra@qms.com',    pw, 'Rahul Mishra',       'initiator', 'Designer', 'Sc-E', 'User Department']);
    await upsert(['DES004', 'divya.krishnan@qms.com',  pw, 'Divya Krishnan',     'initiator', 'Designer', 'Sc-D', 'User Department']);
    await upsert(['DES006', 'lakshmi.prasad@qms.com',  pw, 'Lakshmi Prasad',     'initiator', 'Designer', 'Sc-D', 'User Department']);

    // ── GD002 Team (QA) ─────────────────────────────
    await upsert(['GD002',  'meena.iyer@qms.com',      pw, 'Meena Iyer',         'qa_approver', 'GD',  'Sc-H', 'QA']);
    await upsert(['DGD002', 'sunita.reddy@qms.com',    pw, 'Sunita Reddy',       'qa_approver', 'DGD', 'Sc-G', 'QA']);
    await upsert(['DH003',  'anand.kulkarni@qms.com',  pw, 'Anand Kulkarni',     'qa_approver', 'DH',  'Sc-F', 'QA']);
    await upsert(['TH003',  'suresh.pillai@qms.com',   pw, 'Suresh Pillai',      'inspector', 'TH', 'Sc-E', 'QA']);
    await upsert(['DES005', 'manoj.tiwari@qms.com',    pw, 'Manoj Tiwari',       'initiator', 'Designer', 'Sc-E', 'QA']);

    // ── Set up reporting hierarchy ───────────────────
    const setReporting = async (empId: string, mgrEmpId: string) => {
      await pool.query(
        `UPDATE users SET reporting_to = (SELECT id FROM users WHERE employee_id = $2)
         WHERE employee_id = $1`,
        [empId, mgrEmpId]
      );
    };

    // GDs are top level
    await pool.query(`UPDATE users SET reporting_to = NULL WHERE employee_id IN ('GD001','GD002')`);

    // DGDs report to GDs
    await setReporting('DGD001', 'GD001');
    await setReporting('DGD002', 'GD002');

    // DHs report to DGDs
    await setReporting('DH001', 'DGD001');
    await setReporting('DH002', 'DGD001');
    await setReporting('DH003', 'DGD002');

    // THs report to DHs
    await setReporting('TH001', 'DH001');
    await setReporting('TH002', 'DH002');
    await setReporting('TH003', 'DH003');
    await setReporting('TH004', 'DH001');

    // Designers report to THs
    await setReporting('DES001', 'TH001');
    await setReporting('DES002', 'TH001');
    await setReporting('DES003', 'TH002');
    await setReporting('DES004', 'TH002');
    await setReporting('DES005', 'TH003');
    await setReporting('DES006', 'TH004');

    console.log('Database initialized successfully!');
    console.log('\n=== Default User Credentials (password: admin123) ===');
    console.log('Admin:    ADM001 (Admin)');
    console.log('GD:       GD001 (Rajesh Sharma),  GD002 (Meena Iyer)');
    console.log('DGD:      DGD001 (Arvind Patel),  DGD002 (Sunita Reddy)');
    console.log('DH:       DH001 (Vikram Nair),    DH002 (Priya Menon),   DH003 (Anand Kulkarni)');
    console.log('TH:       TH001 (Deepak Joshi),   TH002 (Kavitha Rao),   TH003 (Suresh Pillai),  TH004 (Neha Gupta)');
    console.log('Designer: DES001 (Amit Verma),    DES002 (Pooja Singh),  DES003 (Rahul Mishra)');
    console.log('          DES004 (Divya Krishnan), DES005 (Manoj Tiwari), DES006 (Lakshmi Prasad)');
    console.log('\n⚠️  IMPORTANT: Change these passwords immediately!\n');
    
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
