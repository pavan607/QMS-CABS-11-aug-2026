import pandas as pd
import psycopg2
import bcrypt

# ----------- Helper functions -----------

def clean_value(val):
    if pd.isna(val) or val is None:
        return None
    val = str(val).strip()
    if val.endswith('.0'):
        val = val[:-2]
    return val


def hash_password(password):
    if password is None:
        return None
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# ----------- Read Excel -----------
df = pd.read_excel('employee_data_updated.xlsx', dtype=str)

# Clean columns
for col in ['employee_id', 'reporting_to', 'phone', 'contact_number']:
    if col in df.columns:
        df[col] = df[col].apply(clean_value)

# Remove fully empty rows
df = df.dropna(how='all')

# ----------- DB Connection -----------
conn = psycopg2.connect(
    host="localhost",
    database="QMS",
    user="postgres",
    password="root"
)
cur = conn.cursor()

# ----------- Insert Loop -----------
for row in df.to_dict(orient="records"):
    try:
        # ✅ Email optional
        email = clean_value(row.get('email')) or None

        name = clean_value(row.get('name'))
        raw_password = clean_value(row.get('password'))
        employee_id = clean_value(row.get('employee_id'))

        # ❗ Required fields check
        if not name or not raw_password or not employee_id:
            print(f"⚠️ Skipping invalid row: {row}")
            continue

        reporting_to = clean_value(row.get('reporting_to'))
        phone = clean_value(row.get('phone'))
        contact_number = clean_value(row.get('contact_number'))

        # 🔐 Hash password
        password = hash_password(raw_password)

        manager_id = None

        # Find manager (if exists)
        if reporting_to:
            cur.execute(
                "SELECT id FROM users WHERE employee_id = %s",
                (reporting_to,)
            )
            result = cur.fetchone()

            if result:
                manager_id = result[0]
            else:
                print(f"⚠️ Manager not found for {email or employee_id} → inserting with NULL")

        # ✅ Insert user
        cur.execute("""
            INSERT INTO users (
                email, password, name, role, status, phone,
                department, position, employee_id, designation,
                scientist_rank, reporting_to, contact_number, signature_path
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (email) DO NOTHING;
        """, (
            email,
            password,
            name,
            clean_value(row.get('role')) or 'initiator',
            clean_value(row.get('status')) or 'active',
            phone,
            clean_value(row.get('department')),
            clean_value(row.get('position')),
            employee_id,
            clean_value(row.get('designation')),
            clean_value(row.get('scientist_rank')),
            manager_id,   # NULL if manager not found
            contact_number,
            clean_value(row.get('signature_path'))
        ))

        conn.commit()

    except Exception as e:
        print(f"❌ Error inserting {row.get('email')}: {e}")
        conn.rollback()

# ----------- Done -----------
print("\n✅ Data import completed successfully!")

cur.close()
conn.close()