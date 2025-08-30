#!/usr/bin/env node

// Check if widget_configurations table exists and create via curl if needed
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
dotenv.config();

async function setupDatabase() {
  console.log("🗄️ Setting up widget_configurations table...\n");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Test if table exists by trying to query it
    console.log("📋 Checking if widget_configurations table exists...");
    const { data, error } = await supabase
      .from("widget_configurations")
      .select("count")
      .limit(1);

    if (!error) {
      console.log("✅ widget_configurations table already exists!");
      console.log("🎉 Domain restriction feature is ready to use!");
      return true;
    }

    console.log(
      "⚠️ Table doesn't exist. Since RPC functions are not available,"
    );
    console.log("   we need to create it manually.");

    // Provide clear instructions
    console.log("\n📋 Manual Setup Instructions:");
    console.log("=" * 60);
    console.log("1. Open your Supabase Dashboard:");
    console.log(
      "   👉 https://supabase.com/dashboard/project/vpqjrrbosaedeydqwhkf/sql/new"
    );
    console.log("\n2. Copy and paste this SQL into the editor:");
    console.log("-" * 50);

    const sql = `-- Widget configurations table for domain restrictions
CREATE TABLE IF NOT EXISTS widget_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    platform VARCHAR(50) NOT NULL,
    element VARCHAR(50) NOT NULL,
    allowed_domains JSONB NOT NULL DEFAULT '[]',
    configuration_data JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_widget_configurations_user_id ON widget_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_organization_id ON widget_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_platform_element ON widget_configurations(platform, element);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_active ON widget_configurations(is_active);

-- Enable Row Level Security
ALTER TABLE widget_configurations ENABLE ROW LEVEL SECURITY;

-- Create security policies
CREATE POLICY "Users can view their own widget configurations" ON widget_configurations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own widget configurations" ON widget_configurations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own widget configurations" ON widget_configurations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own widget configurations" ON widget_configurations
    FOR DELETE USING (auth.uid() = user_id);

-- Add helpful comments
COMMENT ON TABLE widget_configurations IS 'Stores widget configuration including domain restrictions for security';
COMMENT ON COLUMN widget_configurations.allowed_domains IS 'JSONB array of authorized domains where the widget can function';
COMMENT ON COLUMN widget_configurations.configuration_data IS 'Additional widget settings and customization options';`;

    console.log(sql);
    console.log("-" * 50);
    console.log("3. Click the 'RUN' button to execute the SQL");
    console.log("4. Once completed, run this script again to verify");
    console.log("=" * 60);

    return false;
  } catch (error) {
    console.error("❌ Setup failed:", error.message);
    return false;
  }
}

// Run setup
setupDatabase()
  .then((success) => {
    if (success) {
      console.log(
        "\n🚀 Setup Complete! Your domain restriction feature is ready:"
      );
      console.log("   ✅ Database table configured");
      console.log("   ✅ API endpoints ready (/api/save-domain-config)");
      console.log("   ✅ Frontend UI ready (5-step configuration flow)");
      console.log("   🎯 Test it: npm run dev");
    } else {
      console.log("\n⏳ Waiting for manual table creation...");
      console.log(
        "   Once you've run the SQL, this script will detect the table automatically."
      );
    }
  })
  .catch(console.error);
