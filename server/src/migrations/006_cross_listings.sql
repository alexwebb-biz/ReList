-- Cross-Platform Listings Table
-- Stores listings across multiple marketplaces with sync capability

CREATE TABLE IF NOT EXISTS cross_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('eBay', 'Vinted', 'Depop', 'Facebook', 'Gumtree', 'Shpock')),
  external_listing_id VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'sold', 'ended', 'error')),
  error_message TEXT,
  listed_at TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate active listings on same platform for same inventory item
  CONSTRAINT unique_active_platform_listing UNIQUE (inventory_id, platform, status)
    DEFERRABLE INITIALLY DEFERRED
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cross_listings_user_id ON cross_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_cross_listings_inventory_id ON cross_listings(inventory_id);
CREATE INDEX IF NOT EXISTS idx_cross_listings_status ON cross_listings(status);
CREATE INDEX IF NOT EXISTS idx_cross_listings_platform ON cross_listings(platform);
CREATE INDEX IF NOT EXISTS idx_cross_listings_user_status ON cross_listings(user_id, status);

-- Row Level Security
ALTER TABLE cross_listings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own cross-listings
CREATE POLICY cross_listings_select_policy ON cross_listings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY cross_listings_insert_policy ON cross_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY cross_listings_update_policy ON cross_listings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY cross_listings_delete_policy ON cross_listings
  FOR DELETE USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cross_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS cross_listings_updated_at_trigger ON cross_listings;
CREATE TRIGGER cross_listings_updated_at_trigger
  BEFORE UPDATE ON cross_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_cross_listings_updated_at();

-- Comments
COMMENT ON TABLE cross_listings IS 'Cross-platform marketplace listings for inventory items';
COMMENT ON COLUMN cross_listings.platform IS 'The marketplace platform (eBay, Vinted, Depop, etc.)';
COMMENT ON COLUMN cross_listings.external_listing_id IS 'The listing ID on the external platform';
COMMENT ON COLUMN cross_listings.status IS 'Listing status: draft, active, sold, ended, error';
COMMENT ON COLUMN cross_listings.synced_at IS 'Last time this listing was synced with the platform';
