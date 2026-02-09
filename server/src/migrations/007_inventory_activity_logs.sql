-- Migration: Add inventory activity logs table
-- Created: 2026-02-04
-- Purpose: Track item notes and activity history

-- Create activity logs table
CREATE TABLE IF NOT EXISTS inventory_activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- 'note', 'status_change', 'price_change', 'listed', 'sold', 'relisted'
  content TEXT NOT NULL, -- The note text or description of the activity
  metadata JSONB DEFAULT NULL, -- Additional data like old_price, new_price, platform, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_inventory_id ON inventory_activity_logs(inventory_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON inventory_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON inventory_activity_logs(created_at DESC);

-- Add index on activity type for filtering
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON inventory_activity_logs(activity_type);

-- Add column to inventory for first_listed_at (to track when item was first listed)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS first_listed_at TIMESTAMP WITH TIME ZONE;

-- Add column for listing count (how many times it has been listed/sold/relisted)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS listing_count INTEGER DEFAULT 0;
