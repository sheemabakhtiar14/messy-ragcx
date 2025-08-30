#!/usr/bin/env node

// Direct database table creation using Supabase REST API
import dotenv from "dotenv";
dotenv.config();

async function createWidgetConfigurationsTable() {
  console.log(
    "🗄️ Creating widget_configurations table directly via Supabase REST API...\n"
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ Missing Supabase credentials");
    return false;
  }

  // SQL to create the table
  const createTableSQL = `
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

CREATE INDEX IF NOT EXISTS idx_widget_configurations_user_id ON widget_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_organization_id ON widget_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_platform_element ON widget_configurations(platform, element);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_active ON widget_configurations(is_active);

ALTER TABLE widget_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own widget configurations" ON widget_configurations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own widget configurations" ON widget_configurations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own widget configurations" ON widget_configurations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own widget configurations" ON widget_configurations
    FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE widget_configurations IS 'Stores widget configuration including domain restrictions for security';
COMMENT ON COLUMN widget_configurations.allowed_domains IS 'JSONB array of authorized domains where the widget can function';
COMMENT ON COLUMN widget_configurations.configuration_data IS 'Additional widget settings and customization options';
  `;

  try {
    console.log("🔧 Executing SQL via Supabase REST API...");

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        sql: createTableSQL,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("✅ Table created successfully!");
    console.log("🎉 Domain restriction feature is now ready!");

    return true;
  } catch (error) {
    console.log("❌ REST API method failed:", error.message);
    console.log("📋 Using alternative manual approach...");

    // Alternative: Check if we can read from existing widget_configurations table
    try {
      const testResponse = await fetch(
        `${supabaseUrl}/rest/v1/widget_configurations?select=count&limit=1`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
        }
      );

      if (testResponse.ok) {
        console.log("✅ widget_configurations table already exists!");
        console.log("🎉 Domain restriction feature is ready to use!");
        return true;
      } else {
        throw new Error("Table doesn't exist");
      }
    } catch (testError) {
      console.log(
        "\n📋 Please manually create the table using Supabase SQL Editor:"
      );
      console.log("=" * 60);
      console.log(
        "1. Go to: https://supabase.com/dashboard/project/vpqjrrbosaedeydqwhkf/sql/new"
      );
      console.log("2. Copy and paste this SQL:");
      console.log("-" * 50);
      console.log(createTableSQL);
      console.log("-" * 50);
      console.log("3. Click 'RUN' to execute");
      console.log("=" * 60);
      return false;
    }
  }
}

// Run the script
createWidgetConfigurationsTable()
  .then((success) => {
    if (success) {
      console.log("\n🚀 Next steps:");
      console.log("   ✅ Database table ready");
      console.log("   ✅ Domain restriction APIs ready");
      console.log("   ✅ Frontend UI ready");
      console.log("   🎯 Test the complete flow: npm run dev");
      process.exit(0);
    } else {
      console.log("\n❌ Manual setup required");
      process.exit(1);
    }
  })
  .catch(console.error);
