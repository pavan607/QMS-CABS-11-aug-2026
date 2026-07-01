const xlsx = require("xlsx");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

// ----------- Helper functions -----------

function cleanValue(val) {
  if (val === undefined || val === null) return null;
  val = String(val).trim();
  if (val.endsWith(".0")) val = val.slice(0, -2);
  return val || null;
}

async function hashPassword(password) {
  if (!password) return null;
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

// ----------- Read Excel -----------

const workbook = xlsx.readFile("employee_data_updated.xlsx");
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

// ----------- DB Connection -----------

const client = new Client({
  host: "localhost",
  database: "QMS",
  user: "postgres",
  password: "root",
});

async function run() {
  await client.connect();

  for (const row of data) {
    try {
      const email = cleanValue(row.email);
      const name = cleanValue(row.name);
      const rawPassword = cleanValue(row.password);
      const employeeId = cleanValue(row.employee_id);

      // ❗ Required check
      if (!name || !rawPassword || !employeeId) {
        console.log("⚠️ Skipping invalid row:", row);
        continue;
      }

      const reportingTo = cleanValue(row.reporting_to);
      const phone = cleanValue(row.phone);
      const contactNumber = cleanValue(row.contact_number);

      // 🔐 Hash password
      const password = await hashPassword(rawPassword);

      let managerId = null;

      // Find manager
      if (reportingTo) {
        const res = await client.query(
          "SELECT id FROM users WHERE employee_id = $1",
          [reportingTo]
        );

        if (res.rows.length > 0) {
          managerId = res.rows[0].id;
        } else {
          console.log(
            `⚠️ Manager not found for ${email || employeeId}`
          );
        }
      }

      // ✅ Insert user
      await client.query(
        `INSERT INTO users (
          email, password, name, role, status, phone,
          department, position, employee_id, designation,
          scientist_rank, reporting_to, contact_number, signature_path
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
        )
        ON CONFLICT (email) DO NOTHING`,
        [
          email,
          password,
          name,
          cleanValue(row.role) || "initiator",
          cleanValue(row.status) || "active",
          phone,
          cleanValue(row.department),
          cleanValue(row.position),
          employeeId,
          cleanValue(row.designation),
          cleanValue(row.scientist_rank),
          managerId,
          contactNumber,
          cleanValue(row.signature_path),
        ]
      );

      console.log(`✅ Inserted: ${email || employeeId}`);
    } catch (err) {
      console.error("❌ Error:", err.message);
    }
  }

  await client.end();
  console.log("\n✅ Data import completed!");
}

run();