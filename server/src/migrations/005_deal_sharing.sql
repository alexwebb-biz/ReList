-- Deal Sharing Marketplace Tables
-- Community-powered deal sharing with reputation and commissions

-- ============================================
-- Shared Deals Table
-- ============================================
CREATE TABLE IF NOT EXISTS shared_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Deal information
  title VARCHAR(200) NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  image_url TEXT,
  platform VARCHAR(50) NOT NULL,

  -- Pricing
  buy_price DECIMAL(10,2) NOT NULL,
  estimated_sell_price DECIMAL(10,2) NOT NULL,
  estimated_profit DECIMAL(10,2) GENERATED ALWAYS AS (estimated_sell_price - buy_price) STORED,
  estimated_roi DECIMAL(10,2) GENERATED ALWAYS AS (
    CASE WHEN buy_price > 0 THEN ((estimated_sell_price - buy_price) / buy_price * 100) ELSE 0 END
  ) STORED,

  -- Categorization
  category VARCHAR(50) NOT NULL,
  location VARCHAR(100),
  condition VARCHAR(50),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  claimed_by UUID REFERENCES auth.users(id),
  claimed_at TIMESTAMPTZ,

  -- Outcome tracking
  actual_sell_price DECIMAL(10,2),
  actual_profit DECIMAL(10,2),
  commission_paid DECIMAL(10,2),
  outcome_reported_at TIMESTAMPTZ,

  -- Engagement metrics
  upvotes INT NOT NULL DEFAULT 0,
  downvotes INT NOT NULL DEFAULT 0,
  views INT NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Deal Votes Table
-- ============================================
CREATE TABLE IF NOT EXISTS deal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES shared_deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one vote per user per deal
  UNIQUE(deal_id, user_id)
);

-- ============================================
-- User Reputation Table
-- ============================================
CREATE TABLE IF NOT EXISTS user_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Reputation score
  reputation_score INT NOT NULL DEFAULT 0,

  -- Statistics
  deals_shared INT NOT NULL DEFAULT 0,
  deals_claimed INT NOT NULL DEFAULT 0,
  successful_sales INT NOT NULL DEFAULT 0,
  total_profit_generated DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_commission_earned DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Vote statistics
  upvotes_received INT NOT NULL DEFAULT 0,
  downvotes_received INT NOT NULL DEFAULT 0,

  -- Badges (stored as JSON array of badge names)
  badges JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

-- Shared deals indexes
CREATE INDEX IF NOT EXISTS idx_shared_deals_user_id ON shared_deals(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_deals_status ON shared_deals(status);
CREATE INDEX IF NOT EXISTS idx_shared_deals_category ON shared_deals(category);
CREATE INDEX IF NOT EXISTS idx_shared_deals_platform ON shared_deals(platform);
CREATE INDEX IF NOT EXISTS idx_shared_deals_created_at ON shared_deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_deals_estimated_profit ON shared_deals(estimated_profit DESC);
CREATE INDEX IF NOT EXISTS idx_shared_deals_upvotes ON shared_deals(upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_shared_deals_claimed_by ON shared_deals(claimed_by);
CREATE INDEX IF NOT EXISTS idx_shared_deals_expires_at ON shared_deals(expires_at);

-- Deal votes indexes
CREATE INDEX IF NOT EXISTS idx_deal_votes_deal_id ON deal_votes(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_votes_user_id ON deal_votes(user_id);

-- User reputation indexes
CREATE INDEX IF NOT EXISTS idx_user_reputation_score ON user_reputation(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_reputation_deals_shared ON user_reputation(deals_shared DESC);
CREATE INDEX IF NOT EXISTS idx_user_reputation_profit ON user_reputation(total_profit_generated DESC);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE shared_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reputation ENABLE ROW LEVEL SECURITY;

-- Shared deals policies
CREATE POLICY "Users can view all active deals"
  ON shared_deals FOR SELECT
  USING (status = 'active' OR user_id = auth.uid() OR claimed_by = auth.uid());

CREATE POLICY "Users can create deals"
  ON shared_deals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deals"
  ON shared_deals FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = claimed_by);

CREATE POLICY "Users can delete own unclaimed deals"
  ON shared_deals FOR DELETE
  USING (auth.uid() = user_id AND claimed_by IS NULL);

-- Deal votes policies
CREATE POLICY "Users can view all votes"
  ON deal_votes FOR SELECT
  USING (true);

CREATE POLICY "Users can create votes"
  ON deal_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes"
  ON deal_votes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes"
  ON deal_votes FOR DELETE
  USING (auth.uid() = user_id);

-- User reputation policies
CREATE POLICY "Users can view all reputations"
  ON user_reputation FOR SELECT
  USING (true);

CREATE POLICY "Users can create own reputation"
  ON user_reputation FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reputation"
  ON user_reputation FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- Triggers for auto-updating timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shared_deals_updated_at
  BEFORE UPDATE ON shared_deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_reputation_updated_at
  BEFORE UPDATE ON user_reputation
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- View for deals with user info
-- ============================================

CREATE OR REPLACE VIEW deal_feed AS
SELECT
  d.*,
  u.raw_user_meta_data->>'full_name' as sharer_name,
  u.email as sharer_email,
  r.reputation_score as sharer_reputation,
  r.badges as sharer_badges,
  (SELECT vote_type FROM deal_votes WHERE deal_id = d.id AND user_id = auth.uid()) as user_vote
FROM shared_deals d
LEFT JOIN auth.users u ON d.user_id = u.id
LEFT JOIN user_reputation r ON d.user_id = r.user_id
WHERE d.status = 'active' AND d.expires_at > NOW();
