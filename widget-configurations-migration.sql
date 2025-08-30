-- Migration: Add widget_configurations table for domain restrictions
-- Run this SQL in your Supabase SQL Editor

-- Widget configurations table for domain restrictions
CREATE TABLE IF NOT EXISTS widget_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- References auth.users
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    platform VARCHAR(50) NOT NULL, -- web, mobile, ar
    element VARCHAR(50) NOT NULL, -- search, ai-agent, support-agent
    allowed_domains JSONB NOT NULL DEFAULT '[]', -- Array of authorized domains
    widget_token TEXT, -- NEW: Persistent widget token for cross-domain auth
    configuration_data JSONB DEFAULT '{}', -- Additional configuration options
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Widget configurations indexes
CREATE INDEX IF NOT EXISTS idx_widget_configurations_user_id ON widget_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_organization_id ON widget_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_platform_element ON widget_configurations(platform, element);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_active ON widget_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_widget_token ON widget_configurations(widget_token); -- NEW: Index for token lookups

-- Update trigger for widget configurations
CREATE TRIGGER trigger_update_widget_configurations_updated_at
    BEFORE UPDATE ON widget_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_documents_updated_at();

-- Enable Row Level Security
ALTER TABLE widget_configurations ENABLE ROW LEVEL SECURITY;

-- Widget configurations policies
CREATE POLICY "Users can view their own widget configurations" ON widget_configurations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view organization widget configurations they have access to" ON widget_configurations
    FOR SELECT USING (
        organization_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM organization_memberships 
            WHERE user_id = auth.uid() AND organization_id = widget_configurations.organization_id
        )
    );

CREATE POLICY "Users can insert their own widget configurations" ON widget_configurations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own widget configurations" ON widget_configurations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own widget configurations" ON widget_configurations
    FOR DELETE USING (auth.uid() = user_id);

-- Comment with usage examples
COMMENT ON TABLE widget_configurations IS 'Stores widget configuration including domain restrictions for security';
COMMENT ON COLUMN widget_configurations.allowed_domains IS 'JSONB array of authorized domains where the widget can function';
COMMENT ON COLUMN widget_configurations.widget_token IS 'Persistent widget authentication token for cross-domain usage';
COMMENT ON COLUMN widget_configurations.configuration_data IS 'Additional widget settings and customization options';

-- Example insert (for reference):
-- INSERT INTO widget_configurations (user_id, platform, element, allowed_domains) 
-- VALUES (auth.uid(), 'web', 'ai-agent', '["example.com", "subdomain.example.com", "localhost"]'::jsonb);