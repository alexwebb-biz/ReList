-- Update default alert check frequency from 60 to 5 minutes
ALTER TABLE alerts ALTER COLUMN check_frequency_minutes SET DEFAULT 5;

-- Update existing alerts to 5 minutes if they're still at 60
UPDATE alerts SET check_frequency_minutes = 5 WHERE check_frequency_minutes = 60;
