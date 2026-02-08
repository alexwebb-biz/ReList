-- Migration System Setup
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    batch_number INTEGER NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations(migration_name);

-- Function to safely run migrations
CREATE OR REPLACE FUNCTION run_migration(migration_name TEXT, batch_num INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE schema_migrations.migration_name = $1) THEN
        RETURN false;
    END IF;
    
    INSERT INTO schema_migrations (migration_name, batch_number) VALUES ($1, $2);
    RETURN true;
END;
$$ LANGUAGE plpgsql;
