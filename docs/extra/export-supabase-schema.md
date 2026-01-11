# Export Complete Supabase Schema

## Method 1: Via Supabase Dashboard (Recommended)

1. **Go to your Supabase project dashboard**
   - Visit: https://app.supabase.com/project/YOUR_PROJECT_ID

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar

3. **Run this query to get the complete schema**:
   ```sql
   -- Get complete schema including tables, indexes, foreign keys, triggers
   SELECT
     pg_catalog.pg_get_functiondef(p.oid) as function_def
   FROM pg_catalog.pg_proc p
   JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public';
   ```

4. **Better option - Use pg_dump via Supabase CLI**:
   ```bash
   # Install Supabase CLI
   npm install -g supabase

   # Login to Supabase
   supabase login

   # Link to your project
   supabase link --project-ref YOUR_PROJECT_REF

   # Export schema
   supabase db dump --schema public > docker/init-db/001_schema.sql
   ```

## Method 2: Via SQL Query (Copy-Paste)

Run this in Supabase SQL Editor and save the output:

```sql
-- Export complete schema
SELECT
  'CREATE TABLE ' || tablename || E' (\n' ||
  array_to_string(
    array_agg(
      '  ' || column_name || ' ' || data_type ||
      CASE
        WHEN character_maximum_length IS NOT NULL
        THEN '(' || character_maximum_length || ')'
        ELSE ''
      END ||
      CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
      CASE
        WHEN column_default IS NOT NULL
        THEN ' DEFAULT ' || column_default
        ELSE ''
      END
    ),
    E',\n'
  ) || E'\n);'
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
GROUP BY tablename;
```

## Method 3: Direct PostgreSQL Connection

If you have Supabase database credentials:

```bash
# Get connection string from Supabase Dashboard > Settings > Database
# Format: postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Use pg_dump
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  --schema=public \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  > docker/init-db/001_schema_complete.sql
```

## Method 4: Use Supabase Management API

I can create a script that uses your Supabase credentials to export the schema programmatically.

---

## Which method would you prefer?

1. **Easiest**: Give me your Supabase project URL and I'll help you get the database connection string to run pg_dump
2. **Manual**: You run the pg_dump command yourself and share the output
3. **SQL Query**: You run a SQL query in Supabase dashboard and share the results

Let me know which approach works best for you!
