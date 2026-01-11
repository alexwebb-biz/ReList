# Export Your Exact Supabase Schema

Your Supabase project: **rtxgyvythaqmwfwlhcpv**
Dashboard: https://app.supabase.com/project/rtxgyvythaqmwfwlhcpv

## ⭐ RECOMMENDED METHOD: Using Supabase CLI

This is the easiest and most reliable method:

### Step 1: Install Supabase CLI
```bash
npm install -g supabase
```

### Step 2: Login and Link
```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref rtxgyvythaqmwfwlhcpv
```

### Step 3: Export Schema
```bash
# Export the complete schema
supabase db dump --schema public --file docker/init-db/001_schema_supabase.sql

# This will export:
# - All tables with exact column definitions
# - All indexes
# - All foreign keys and constraints
# - All triggers and functions
# - Everything needed for an exact replica
```

---

## Alternative Method: Using pg_dump Directly

If you prefer to use `pg_dump`:

### Step 1: Get Database Connection String

1. Go to: https://app.supabase.com/project/rtxgyvythaqmwfwlhcpv/settings/database
2. Scroll to "Connection string" section
3. Copy the **URI** format (it looks like):
   ```
   postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
4. Replace `[PASSWORD]` with your actual database password

### Step 2: Run pg_dump

```bash
# Windows (PowerShell)
pg_dump "postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres" --schema=public --no-owner --no-acl --clean --if-exists --file=docker/init-db/001_schema_supabase.sql

# Or if pg_dump is not installed, install PostgreSQL client tools first:
# Download from: https://www.postgresql.org/download/windows/
```

---

## Manual Method (if tools aren't available)

### Step 1: Run SQL Query in Supabase Dashboard

1. Go to: https://app.supabase.com/project/rtxgyvythaqmwfwlhcpv/sql/new
2. Paste this query:

```sql
-- Get complete CREATE TABLE statements for all tables
SELECT
  'CREATE TABLE ' || tablename || E' (\n' ||
  string_agg(
    '  ' || column_name || ' ' ||
    CASE
      WHEN data_type = 'character varying' THEN 'VARCHAR(' || character_maximum_length || ')'
      WHEN data_type = 'timestamp with time zone' THEN 'TIMESTAMP WITH TIME ZONE'
      WHEN data_type = 'ARRAY' THEN udt_name
      ELSE data_type
    END ||
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
    E',\n'
  ) || E'\n);\n'
FROM information_schema.columns
WHERE table_schema = 'public'
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE 'sql_%'
GROUP BY tablename
ORDER BY tablename;
```

3. Click "Run"
4. Copy all the results
5. Save to `docker/init-db/001_schema_supabase.sql`

### Step 2: Get Indexes and Constraints

```sql
-- Get all indexes
SELECT indexdef || ';'
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY indexname;

-- Get all foreign keys
SELECT
  'ALTER TABLE ' || tc.table_name ||
  ' ADD CONSTRAINT ' || tc.constraint_name ||
  ' FOREIGN KEY (' || kcu.column_name || ')' ||
  ' REFERENCES ' || ccu.table_name || '(' || ccu.column_name || ')' ||
  CASE
    WHEN rc.delete_rule = 'CASCADE' THEN ' ON DELETE CASCADE'
    WHEN rc.delete_rule = 'SET NULL' THEN ' ON DELETE SET NULL'
    ELSE ''
  END || ';'
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public';
```

---

## After Export

Once you have the schema file:

1. **Backup current database** (optional):
   ```bash
   docker exec relist-postgres pg_dump -U relist -d relist > backup_current.sql
   ```

2. **Stop and remove current database**:
   ```bash
   docker compose down
   docker volume rm relist-postgres-data
   ```

3. **Replace schema file**:
   ```bash
   # Rename or delete old schema
   mv docker/init-db/001_schema.sql docker/init-db/001_schema_OLD.sql

   # Move new schema
   mv docker/init-db/001_schema_supabase.sql docker/init-db/001_schema.sql
   ```

4. **Start containers** (will recreate database with new schema):
   ```bash
   docker compose up -d --build
   ```

5. **Test signup/login**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"test2@example.com","password":"test123456","full_name":"Test User"}'
   ```

---

## Need Help?

Let me know which method you'd like to use and I can guide you through it!
