-- Migration: 001_initial_schema
-- Description: Complete database schema for ReList
-- Created: 2026-02-08
-- Note: Uses IF NOT EXISTS for idempotency - safe to run on existing databases

DO $$
BEGIN
    -- Skip if already executed
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE migration_name = '001_initial_schema.sql') THEN
        RAISE NOTICE 'Migration 001_initial_schema already executed, skipping...';
        RETURN;
    END IF;

    RAISE NOTICE 'Running migration 001_initial_schema...';

    -- ============================================
    -- 1. USERS TABLE
    -- ============================================
    CREATE TABLE IF NOT EXISTS users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        location_postcode VARCHAR(10),
        location_lat NUMERIC,
        location_lng NUMERIC,
        subscription_tier VARCHAR(50) DEFAULT 'free',
        subscription_status VARCHAR(50) DEFAULT 'inactive',
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        ai_credits_remaining INTEGER DEFAULT 10,
        notification_email BOOLEAN DEFAULT true,
        notification_push BOOLEAN DEFAULT false,
        notification_telegram BOOLEAN DEFAULT false,
        telegram_chat_id TEXT,
        notification_discord BOOLEAN DEFAULT false,
        discord_webhook_url TEXT,
        reset_token_hash VARCHAR(255),
        reset_token_expires TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_login_at TIMESTAMPTZ
    );

    -- Enable RLS if not already
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- 2. INVENTORY TABLE
    -- ============================================
    CREATE TABLE IF NOT EXISTS inventory (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        brand VARCHAR(100),
        condition VARCHAR(50),
        purchase_price NUMERIC,
        purchase_date DATE,
        purchase_platform VARCHAR(50),
        purchase_location VARCHAR(255),
        selling_price NUMERIC,
        sold_price NUMERIC,
        sold_date DATE,
        sold_platform VARCHAR(50),
        fees_total NUMERIC DEFAULT 0,
        postage_cost NUMERIC DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft',
        images TEXT[],
        notes TEXT,
        first_listed_at TIMESTAMPTZ,
        listing_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- 3. ALERTS TABLE
    -- ============================================
    CREATE TABLE IF NOT EXISTS alerts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        keywords TEXT[] NOT NULL,
        exclude_keywords TEXT[],
        platforms TEXT[] NOT NULL,
        categories TEXT[],
        price_min NUMERIC,
        price_max NUMERIC,
        condition TEXT[],
        radius_miles INTEGER DEFAULT 25,
        location_postcode VARCHAR(10),
        check_frequency_minutes INTEGER DEFAULT 5,
        is_active BOOLEAN DEFAULT true,
        notification_channels TEXT[],
        last_checked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- 4. ALERT RESULTS TABLE
    -- ============================================
    CREATE TABLE IF NOT EXISTS alert_results (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
        external_id VARCHAR(255) NOT NULL,
        platform VARCHAR(50) NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        price NUMERIC NOT NULL,
        currency VARCHAR(3) DEFAULT 'GBP',
        location VARCHAR(255),
        condition VARCHAR(50),
        image_urls TEXT[],
        url TEXT NOT NULL,
        seller_name VARCHAR(255),
        posted_at TIMESTAMPTZ,
        notified_at TIMESTAMPTZ,
        is_read BOOLEAN DEFAULT false,
        is_saved BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE alert_results ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- 5. INVENTORY ACTIVITY LOGS
    -- ============================================
    CREATE TABLE IF NOT EXISTS inventory_activity_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        activity_type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE inventory_activity_logs ENABLE ROW LEVEL SECURITY;

    CREATE INDEX IF NOT EXISTS idx_activity_logs_inventory_id ON inventory_activity_logs(inventory_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON inventory_activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON inventory_activity_logs(created_at DESC);

    -- ============================================
    -- 6. LISTINGS TABLE
    -- ============================================
    CREATE TABLE IF NOT EXISTS listings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
        user_id UUID,
        platform VARCHAR(50) NOT NULL,
        external_id VARCHAR(255),
        title VARCHAR(500) NOT NULL,
        description TEXT,
        price NUMERIC NOT NULL,
        url TEXT,
        status VARCHAR(50) DEFAULT 'active',
        listed_at TIMESTAMPTZ DEFAULT NOW(),
        sold_at TIMESTAMPTZ,
        views_count INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- 7. CROSS LISTINGS TABLE
    -- ============================================
    CREATE TABLE IF NOT EXISTS cross_listings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL,
        external_listing_id VARCHAR(255),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        price NUMERIC NOT NULL,
        url TEXT,
        status VARCHAR(20) DEFAULT 'draft',
        error_message TEXT,
        listed_at TIMESTAMPTZ,
        synced_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE cross_listings ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- 8. WATCHED ITEMS TABLE
    -- ============================================
    CREATE TABLE IF NOT EXISTS watched_items (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL,
        alert_result_id UUID REFERENCES alert_results(id) ON DELETE SET NULL,
        external_id VARCHAR(255) NOT NULL,
        platform VARCHAR(50) NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        image_url TEXT,
        initial_price NUMERIC NOT NULL,
        current_price NUMERIC NOT NULL,
        target_price NUMERIC,
        currency VARCHAR(10) DEFAULT 'GBP',
        last_checked_at TIMESTAMPTZ DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE watched_items ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- 9. PRICE HISTORY TABLE
    -- ============================================
    CREATE TABLE IF NOT EXISTS price_history (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        watched_item_id UUID NOT NULL REFERENCES watched_items(id) ON DELETE CASCADE,
        price NUMERIC NOT NULL,
        recorded_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- 10. SHARED DEALS TABLE
    -- ============================================
    CREATE TABLE IF NOT EXISTS shared_deals (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        url TEXT NOT NULL,
        image_url TEXT,
        platform VARCHAR(50) NOT NULL,
        buy_price NUMERIC NOT NULL,
        estimated_sell_price NUMERIC NOT NULL,
        estimated_profit NUMERIC,
        estimated_roi NUMERIC,
        category VARCHAR(50),
        location VARCHAR(100),
        condition VARCHAR(50),
        status VARCHAR(20) DEFAULT 'active',
        claimed_by UUID,
        claimed_at TIMESTAMPTZ,
        actual_sell_price NUMERIC,
        actual_profit NUMERIC,
        commission_paid NUMERIC,
        outcome_reported_at TIMESTAMPTZ,
        upvotes INTEGER DEFAULT 0,
        downvotes INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE shared_deals ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- 11. DEAL VOTES TABLE
    -- ============================================
    CREATE TABLE IF NOT EXISTS deal_votes (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        deal_id UUID NOT NULL REFERENCES shared_deals(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        vote_type VARCHAR(10) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE deal_votes ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- 12. USER REPUTATION TABLE
    -- ============================================
    CREATE TABLE IF NOT EXISTS user_reputation (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL UNIQUE,
        reputation_score INTEGER DEFAULT 0,
        deals_shared INTEGER DEFAULT 0,
        deals_claimed INTEGER DEFAULT 0,
        successful_sales INTEGER DEFAULT 0,
        total_profit_generated NUMERIC DEFAULT 0,
        total_commission_earned NUMERIC DEFAULT 0,
        upvotes_received INTEGER DEFAULT 0,
        downvotes_received INTEGER DEFAULT 0,
        badges JSONB,
        level VARCHAR(50) DEFAULT 'newcomer',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE user_reputation ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- 13. NOTIFICATIONS TABLE
    -- ============================================
    CREATE TABLE IF NOT EXISTS notifications (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        data JSONB,
        channels TEXT[],
        is_read BOOLEAN DEFAULT false,
        sent_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- 14. SCRAPING JOBS TABLE
    -- ============================================
    CREATE TABLE IF NOT EXISTS scraping_jobs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
        platform VARCHAR(50) NOT NULL,
        search_params JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        results_count INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE scraping_jobs ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- 15. AI ENHANCEMENTS TABLE
    -- ============================================
    CREATE TABLE IF NOT EXISTS ai_enhancements (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
        enhancement_type VARCHAR(50) NOT NULL,
        input_data JSONB,
        output_data JSONB,
        platform_variant VARCHAR(50),
        cost_credits INTEGER DEFAULT 1,
        processing_time_ms INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE ai_enhancements ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- 16. USER GOALS TABLE
    -- ============================================
    CREATE TABLE IF NOT EXISTS user_goals (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        goal_type VARCHAR(50) NOT NULL,
        target_value NUMERIC NOT NULL,
        current_value NUMERIC DEFAULT 0,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        is_achieved BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

    -- ============================================
    -- GRANT PERMISSIONS
    -- ============================================
    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

    -- ============================================
    -- RECORD THIS MIGRATION
    -- ============================================
    INSERT INTO schema_migrations (migration_name, batch_number)
    VALUES ('001_initial_schema.sql', 1)
    ON CONFLICT (migration_name) DO NOTHING;

    RAISE NOTICE '✅ Migration 001_initial_schema completed successfully';

END $$;

-- Verification
SELECT 'Initial schema migration complete' as status, 
       (SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as table_count;
