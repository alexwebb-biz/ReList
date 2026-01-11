-- Watched Items table - for price drop alerts
CREATE TABLE IF NOT EXISTS watched_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  alert_result_id UUID REFERENCES alert_results(id) ON DELETE SET NULL,
  external_id VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  image_url TEXT,
  initial_price DECIMAL(10, 2) NOT NULL,
  current_price DECIMAL(10, 2) NOT NULL,
  target_price DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'GBP',
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Price History table - track price changes over time
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watched_item_id UUID NOT NULL REFERENCES watched_items(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Goals table - for profit targets
CREATE TABLE IF NOT EXISTS user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  goal_type VARCHAR(50) NOT NULL, -- 'weekly_profit', 'monthly_profit', 'items_sold'
  target_value DECIMAL(10, 2) NOT NULL,
  current_value DECIMAL(10, 2) DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  is_achieved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_watched_items_user_id ON watched_items(user_id);
CREATE INDEX IF NOT EXISTS idx_watched_items_platform ON watched_items(platform);
CREATE INDEX IF NOT EXISTS idx_watched_items_is_active ON watched_items(is_active);
CREATE INDEX IF NOT EXISTS idx_watched_items_external_id ON watched_items(external_id);
CREATE INDEX IF NOT EXISTS idx_price_history_watched_item ON price_history(watched_item_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_period ON user_goals(period_start, period_end);

-- Unique constraint: one watch per external_id per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_watched_items_unique
  ON watched_items(user_id, platform, external_id)
  WHERE is_active = true;
