import pandas as pd
import psycopg2  # pyright: ignore[reportMissingModuleSource]

conn = psycopg2.connect(
    host="localhost",
    database="your_db_name",
    user="your_username",
    password="your_password",
    port="5432"
)

cursor = conn.cursor()

df = pd.read_excel("subsystems.xlsx")

insert_query = """
INSERT INTO subsystems (
    id, project_id, name, code, description, status,
    created_by, created_at, updated_at
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (project_id, code) DO NOTHING;
"""

for _, row in df.iterrows():
    cursor.execute(insert_query, (
        int(row['id']),
        int(row['project_id']),
        row['name'],
        row['code'],
        row['description'],
        row['status'],
        int(row['created_by']) if not pd.isna(row['created_by']) else None,
        row['created_at'],
        row['updated_at']
    ))

conn.commit()
cursor.close()
conn.close()

print("✅ Subsystems data imported successfully!")