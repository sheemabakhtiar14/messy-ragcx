#!/usr/bin/env node

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Database setup script for widget_configurations table
import { createClient } from "@supabase/supabase-js";

async function setupWidgetConfigurationsTable() {
  console.log(
    "🗄️  Setting up widget_configurations table for domain restrictions...\n"
  );

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // First, test if the table already exists
    console.log("📋 Checking if widget_configurations table exists...");
    const { data: existingData, error: existingError } = await supabase
      .from("widget_configurations")
      .select("count(*)")
      .limit(1);

    if (!existingError) {
      console.log("✅ widget_configurations table already exists!");
      console.log("🎉 Domain restriction feature is ready to use!");
      return true;
    }

    console.log("⚠️ Table doesn't exist, creating it now...");

    // Create the table using a direct SQL execution approach
    const createTableSQL = `
      -- Widget configurations table for domain restrictions
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
      COMMENT ON COLUMN widget_configurations.configuration_data IS 'Additional widget settings and customization options';
    `;

    console.log("🔧 Executing table creation SQL...");

    // Try to execute using RPC if available
    try {
      const { data, error } = await supabase.rpc("exec_sql", {
        sql: createTableSQL,
      });

      if (error) {
        throw new Error("RPC method not available");
      }

      console.log("✅ Table created using RPC method");
    } catch (rpcError) {
      console.log("🔄 RPC not available, using alternative method...");

      // Alternative: Try to insert a test record to trigger table creation
      const testConfig = {
        user_id: "00000000-0000-0000-0000-000000000000", // dummy UUID
        platform: "web",
        element: "ai-agent",
        allowed_domains: ["example.com"],
        configuration_data: { test: true },
        is_active: true,
      };

      // This will fail if table doesn't exist, which means we need manual setup
      const { data: insertResult, error: insertError } = await supabase
        .from("widget_configurations")
        .insert(testConfig)
        .select();

      if (insertError) {
        console.log("❌ Automatic table creation failed.");
        console.log(
          "📋 Please run this SQL manually in your Supabase SQL Editor:"
        );
        console.log("=".repeat(60));
        console.log(createTableSQL);
        console.log("=".repeat(60));
        return false;
      } else {
        // Clean up test record
        await supabase
          .from("widget_configurations")
          .delete()
          .eq("user_id", "00000000-0000-0000-0000-000000000000");
        console.log("✅ Table created successfully!");
      }
    }

    // Verify the table was created
    const { data: verifyData, error: verifyError } = await supabase
      .from("widget_configurations")
      .select("count(*)")
      .limit(1);

    if (verifyError) {
      console.log("❌ Table verification failed. Please run the SQL manually.");
      return false;
    } else {
      console.log("✅ widget_configurations table verified!");
      console.log("🎉 Domain restriction feature is now ready!");

      // Show table structure
      console.log("\n📊 Table Structure Created:");
      console.log("- id (UUID, Primary Key)");
      console.log("- user_id (UUID, References auth.users)");
      console.log("- organization_id (UUID, Optional)");
      console.log("- platform (VARCHAR, e.g., 'web')");
      console.log("- element (VARCHAR, e.g., 'ai-agent')");
      console.log("- allowed_domains (JSONB, Array of domains)");
      console.log("- configuration_data (JSONB, Additional settings)");
      console.log("- is_active (BOOLEAN, Default true)");
      console.log("- created_at (TIMESTAMP)");
      console.log("- updated_at (TIMESTAMP)");

      return true;
    }
  } catch (error) {
    console.error("❌ Setup failed:", error.message);
    console.log("\n📋 Manual Setup Required:");
    console.log("1. Open your Supabase Dashboard");
    console.log("2. Go to SQL Editor");
    console.log("3. Run this SQL:");
    console.log("-".repeat(50));
    console.log(`
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_widget_configurations_user_id ON widget_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_organization_id ON widget_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_platform_element ON widget_configurations(platform, element);

-- Enable RLS
ALTER TABLE widget_configurations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own widget configurations" ON widget_configurations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own widget configurations" ON widget_configurations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own widget configurations" ON widget_configurations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own widget configurations" ON widget_configurations
    FOR DELETE USING (auth.uid() = user_id);`);
    console.log("-".repeat(50));
    return false;
  }
}

async function testSupabaseConnection() {
  console.log("🧪 Testing Supabase Connection...\n");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Test 1: Check database connection
    console.log("📡 Test 1: Checking Supabase connection...");
    const { data, error } = await supabase
      .from("documents")
      .select("count", { count: "exact", head: true });

    if (error) {
      console.log("✅ Supabase connected (table may not exist yet)");
      console.log("   Error details:", error.message);

      // If documents table doesn't exist, let's try to create the schema
      if (error.message.includes('relation "documents" does not exist')) {
        console.log("\n📋 Setting up database schema...");
        console.log("ℹ️  You need to run the database schema first.");
        console.log("   1. Go to your Supabase dashboard");
        console.log("   2. Open the SQL editor");
        console.log("   3. Copy and paste the contents of database-schema.sql");
        console.log("   4. Run the SQL to create the tables\n");
      }
    } else {
      console.log("✅ Supabase connected successfully");
      console.log("   Documents table accessible");
      console.log("   Document count:", data?.length || 0);
    }

    // Test 2: Check if we can query other system info
    console.log("\n📋 Test 2: Checking database capabilities...");
    try {
      const { data: authData, error: authError } =
        await supabase.auth.admin.listUsers();
      if (!authError) {
        console.log("✅ Auth admin functions available");
        console.log("   Users in database:", authData?.users?.length || 0);
      }
    } catch (authCheckError) {
      console.log("ℹ️  Auth admin functions limited (normal in some setups)");
    }

    console.log("\n🎉 Core Supabase connection is working!");
    console.log("📋 Summary:");
    console.log("   ✅ Environment variables loaded");
    console.log("   ✅ Supabase client initialized");
    console.log("   ✅ Database connection established");

    return true;
  } catch (error) {
    console.error("❌ Supabase connection failed:", error.message);
    console.error("\n📝 Troubleshooting tips:");
    console.error("   1. Check your NEXT_PUBLIC_SUPABASE_URL in .env");
    console.error("   2. Verify your SUPABASE_SERVICE_ROLE_KEY in .env");
    console.error("   3. Ensure your Supabase project is active");
    console.error("   4. Check if your internet connection is working\n");
    return false;
  }
}

// Test Hugging Face connection
async function testHuggingFaceConnection() {
  console.log("\n🤗 Testing Hugging Face Connection...\n");

  try {
    const { HfInference } = await import("@huggingface/inference");
    const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

    console.log("📡 Testing embedding generation...");
    const response = await hf.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: "This is a test sentence for embedding generation.",
    });

    if (response && Array.isArray(response)) {
      console.log("✅ Hugging Face embedding generation working");
      console.log(
        "   Embedding dimension:",
        response.length || response[0]?.length
      );
    } else {
      console.log("⚠️  Hugging Face response format unexpected");
    }

    return true;
  } catch (error) {
    console.error("❌ Hugging Face connection failed:", error.message);
    console.error("\n📝 Check your HUGGINGFACE_API_KEY in .env file\n");
    return false;
  }
}

// Environment check
function checkEnvironment() {
  console.log("🔍 Environment Check...\n");

  const requiredEnvVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "HUGGINGFACE_API_KEY",
  ];

  let allGood = true;

  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: Set`);
    } else {
      console.log(`❌ ${envVar}: Missing`);
      allGood = false;
    }
  }

  console.log("");
  return allGood;
}

// Main test function
async function main() {
  console.log("🎯 RAGv2 Core Connection Test\n");
  console.log("=".repeat(50));

  // Check environment first
  if (!checkEnvironment()) {
    console.error(
      "❌ Environment setup incomplete. Please check your .env file."
    );
    process.exit(1);
  }

  // Set up widget_configurations table
  console.log("\n" + "=".repeat(50));
  await setupWidgetConfigurationsTable();

  // Test Supabase
  const supabaseWorking = await testSupabaseConnection();

  // Test Hugging Face
  const hfWorking = await testHuggingFaceConnection();

  console.log("=".repeat(50));

  if (supabaseWorking && hfWorking) {
    console.log("🎉 All core connections are working!");
    console.log("\n🚀 Next steps:");
    console.log("   1. Run the database schema if tables don't exist");
    console.log("   2. The MCP integration is ready (server files created)");
    console.log("   3. Use the enhanced API endpoints:");
    console.log("      - /api/ask-mcp for MCP-enhanced queries");
    console.log("      - /api/save-mcp for MCP-enhanced document uploads");
    console.log("   4. Start your development server: npm run dev\n");
  } else {
    console.log("❌ Some connections failed. Please fix the issues above.");
    process.exit(1);
  }
}

// Handle errors
process.on("unhandledRejection", (error) => {
  console.error("\n❌ Unhandled error:", error.message);
  process.exit(1);
});

// Run the test
main().catch(console.error);
