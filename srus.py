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

df = pd.read_excel("srus.xlsx")

insert_query = """
INSERT INTO srus (
    id, lru_id, name, code, part_number, description,
    status, created_by, created_at, updated_at, serial_numbers
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (lru_id, code) DO NOTHING;
"""

for _, row in df.iterrows():
    cursor.execute(insert_query, (
        int(row['id']),
        int(row['lru_id']),
        row['name'],
        row['code'],
        row['part_number'],
        row['description'],
        row['status'],
        int(row['created_by']) if not pd.isna(row['created_by']) else None,
        row['created_at'],
        row['updated_at'],
        row['serial_numbers']  # JSON string
    ))

conn.commit()
cursor.close()
conn.close()

print("✅ SRUs data imported successfully!")