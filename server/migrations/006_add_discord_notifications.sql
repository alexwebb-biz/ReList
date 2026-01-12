-- Add Discord notification fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS notification_discord BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT;

-- Add comment
COMMENT ON COLUMN users.notification_discord IS 'Enable Discord webhook notifications';
COMMENT ON COLUMN users.discord_webhook_url IS 'Discord webhook URL for notifications';
