-- Create listings table for cross-platform listing tracking
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  listing_url TEXT,
  listing_price DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'sold')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_inventory_id ON listings(inventory_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_platform ON listings(platform);

-- Unique constraint: only one active listing per platform per inventory item
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_unique_active
  ON listings(inventory_id, platform)
  WHERE status = 'active';

-- Enable RLS
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see their own listings
CREATE POLICY "Users can view own listings"
  ON listings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own listings"
  ON listings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own listings"
  ON listings FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own listings"
  ON listings FOR DELETE
  USING (user_id = auth.uid());
