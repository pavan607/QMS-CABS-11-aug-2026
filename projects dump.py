import pandas as pd
import psycopg2  # pyright: ignore[reportMissingModuleSource]

# 🔹 DB connection
conn = psycopg2.connect(
    host="localhost",
    database="your_db_name",
    user="your_username",
    password="your_password",
    port="5432"
)

cursor = conn.cursor()

# 🔹 Read Excel file
file_path = "projects.xlsx"   # update path if needed
df = pd.read_excel(file_path)

# 🔹 Insert query
insert_query = """
INSERT INTO projects (
    id, name, code, description, status, created_by, created_at, updated_at
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (id) DO NOTHING;
"""

# 🔹 Loop through rows
for _, row in df.iterrows():
    cursor.execute(insert_query, (
        int(row['id']),
        row['name'],
        row['code'],
        row['description'],
        row['status'],
        int(row['created_by']) if not pd.isna(row['created_by']) else None,
        row['created_at'],
        row['updated_at']
    ))

# 🔹 Commit & close
conn.commit()
cursor.close()
conn.close()

print("✅ Data imported successfully!")