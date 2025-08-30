-- Database migration to add widget_token column for cross-domain authentication
-- Run this SQL in your Supabase SQL Editor

-- Add widget_token column to existing widget_configurations table
ALTER TABLE widget_configurations 
ADD COLUMN IF NOT EXISTS widget_token TEXT;

-- Add index for widget token lookups (for better performance)
CREATE INDEX IF NOT EXISTS idx_widget_configurations_widget_token 
ON widget_configurations(widget_token);

-- Add comment for the new column
COMMENT ON COLUMN widget_configurations.widget_token IS 'Persistent widget authentication token for cross-domain usage';

-- Update any existing rows to generate tokens (optional, for existing configurations)
-- This would typically be done through the application when the user next saves their config

-- Example of how tokens will be structured (for reference):
-- {
--   "userId": "user-uuid",
--   "email": "user@example.com",
--   "type": "persistent_widget",
--   "configId": "config-uuid",
--   "domains": ["example.com", "subdomain.example.com"],
--   "iat": 1234567890,
--   "exp": 1234567890
-- }

-- Verification query (run after migration)
-- SELECT id, user_id, platform, element, allowed_domains, 
--        CASE WHEN widget_token IS NOT NULL THEN 'HAS_TOKEN' ELSE 'NO_TOKEN' END as token_status,
--        created_at
-- FROM widget_configurations 
-- ORDER BY created_at DESC;