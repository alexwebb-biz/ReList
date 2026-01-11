-- =============================================================================
-- RELIST Database Schema
-- Exported from Supabase - matches production exactly
-- =============================================================================

-- Enable UUID extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- USERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    location_postcode VARCHAR(10),
    location_lat NUMERIC(10,6),
    location_lng NUMERIC(11,6),
    subscription_tier VARCHAR(50) DEFAULT 'free',
    subscription_status VARCHAR(50) DEFAULT 'inactive',
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    ai_credits_remaining INTEGER DEFAULT 10,
    notification_email BOOLEAN DEFAULT true,
    notification_push BOOLEAN DEFAULT false,
    notification_telegram BOOLEAN DEFAULT false,
    telegram_chat_id TEXT,
    reset_token_hash VARCHAR(255),
    reset_token_expires TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================================================
-- ALERTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    keywords TEXT[] NOT NULL,
    exclude_keywords TEXT[],
    platforms TEXT[] NOT NULL,
    categories TEXT[],
    price_min NUMERIC(10,2),
    price_max NUMERIC(10,2),
    condition TEXT[],
    radius_miles INTEGER DEFAULT 25,
    location_postcode VARCHAR(10),
    check_frequency_minutes INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    notification_channels TEXT[] DEFAULT '{email}',
    last_checked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================================================
-- ALERT RESULTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS alert_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    external_id VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GBP',
    location VARCHAR(255),
    condition VARCHAR(50),
    image_urls TEXT[],
    url TEXT NOT NULL,
    seller_name VARCHAR(255),
    posted_at TIMESTAMP WITH TIME ZONE,
    notified_at TIMESTAMP WITH TIME ZONE,
    is_read BOOLEAN DEFAULT false,
    is_saved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================================================
-- INVENTORY
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    brand VARCHAR(100),
    condition VARCHAR(50),
    purchase_price NUMERIC(10,2),
    purchase_date DATE,
    purchase_platform VARCHAR(50),
    purchase_location VARCHAR(255),
    selling_price NUMERIC(10,2),
    sold_price NUMERIC(10,2),
    sold_date DATE,
    sold_platform VARCHAR(50),
    fees_total NUMERIC(10,2) DEFAULT 0,
    postage_cost NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft',
    images TEXT[],
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================================================
-- LISTINGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    external_id VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    url TEXT,
    status VARCHAR(50) DEFAULT 'active',
    listed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    sold_at TIMESTAMP WITH TIME ZONE,
    views_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================================================
-- WATCHED ITEMS (Price Watch)
-- =============================================================================
CREATE TABLE IF NOT EXISTS watched_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_result_id UUID REFERENCES alert_results(id) ON DELETE SET NULL,
    external_id VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    image_url TEXT,
    initial_price NUMERIC(10,2) NOT NULL,
    current_price NUMERIC(10,2) NOT NULL,
    target_price NUMERIC(10,2),
    currency VARCHAR(10) DEFAULT 'GBP',
    last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================================================
-- PRICE HISTORY
-- =============================================================================
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    watched_item_id UUID NOT NULL REFERENCES watched_items(id) ON DELETE CASCADE,
    price NUMERIC(10,2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB,
    channels TEXT[],
    is_read BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================================================
-- USER GOALS
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_type VARCHAR(50) NOT NULL,
    target_value NUMERIC(10,2) NOT NULL,
    current_value NUMERIC(10,2) DEFAULT 0,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    is_achieved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================================================
-- AI ENHANCEMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_enhancements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
    enhancement_type VARCHAR(50) NOT NULL,
    input_data JSONB,
    output_data JSONB,
    platform_variant VARCHAR(50),
    cost_credits INTEGER DEFAULT 1,
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================================================
-- SCRAPING JOBS
-- =============================================================================
CREATE TABLE IF NOT EXISTS scraping_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    search_params JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    results_count INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);

-- Alerts
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_active ON alerts(is_active);

-- Alert Results
CREATE INDEX IF NOT EXISTS idx_alert_results_alert_id ON alert_results(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_results_external_id ON alert_results(external_id);
CREATE INDEX IF NOT EXISTS idx_alert_results_created_at ON alert_results(created_at);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_created_at ON inventory(created_at);

-- Listings
CREATE INDEX IF NOT EXISTS idx_listings_inventory_id ON listings(inventory_id);
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_platform ON listings(platform);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);

-- Watched Items
CREATE INDEX IF NOT EXISTS idx_watched_items_user_id ON watched_items(user_id);
CREATE INDEX IF NOT EXISTS idx_watched_items_is_active ON watched_items(is_active);

-- Price History
CREATE INDEX IF NOT EXISTS idx_price_history_watched_item ON price_history(watched_item_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- User Goals
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_goals(user_id);

-- AI Enhancements
CREATE INDEX IF NOT EXISTS idx_ai_enhancements_user_id ON ai_enhancements(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_enhancements_inventory_id ON ai_enhancements(inventory_id);

-- Scraping Jobs
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_alert_id ON scraping_jobs(alert_id);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_status ON scraping_jobs(status);

-- =============================================================================
-- UNIQUE CONSTRAINTS
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_results_unique
    ON alert_results(alert_id, external_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_watched_items_unique
    ON watched_items(user_id, platform, external_id)
    WHERE is_active = true;

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers (with DROP IF EXISTS to avoid errors on re-run)
DO $$
BEGIN
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
    DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
    DROP TRIGGER IF EXISTS update_listings_updated_at ON listings;
    DROP TRIGGER IF EXISTS update_watched_items_updated_at ON watched_items;
    DROP TRIGGER IF EXISTS update_user_goals_updated_at ON user_goals;
END $$;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_listings_updated_at
    BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_watched_items_updated_at
    BEFORE UPDATE ON watched_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_goals_updated_at
    BEFORE UPDATE ON user_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO relist;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO relist;
GRANT USAGE ON SCHEMA public TO relist;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✓ Relist database schema created successfully!';
END $$;
