#!/usr/bin/env node

// Use curl to execute SQL via Supabase API
import { spawn } from "child_process";
import dotenv from "dotenv";
dotenv.config();

async function createTableWithCurl() {
  console.log("🗄️ Creating widget_configurations table using curl...\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Simplified SQL that should work
  const sql = `CREATE TABLE IF NOT EXISTS widget_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    organization_id UUID DEFAULT NULL,
    platform VARCHAR(50) NOT NULL,
    element VARCHAR(50) NOT NULL,
    allowed_domains JSONB NOT NULL DEFAULT '[]',
    configuration_data JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );`;

  const payload = JSON.stringify({ sql });

  // Use curl via child_process
  const curlArgs = [
    "-X",
    "POST",
    `${supabaseUrl}/rest/v1/rpc/exec_sql`,
    "-H",
    "Content-Type: application/json",
    "-H",
    `Authorization: Bearer ${serviceRoleKey}`,
    "-H",
    `apikey: ${serviceRoleKey}`,
    "-d",
    payload,
  ];

  console.log("🔧 Executing SQL via curl...");

  try {
    const curl = spawn("curl", curlArgs);

    let output = "";
    let error = "";

    curl.stdout.on("data", (data) => {
      output += data.toString();
    });

    curl.stderr.on("data", (data) => {
      error += data.toString();
    });

    curl.on("close", (code) => {
      if (code !== 0) {
        console.log("❌ Curl failed with code:", code);
        console.log("Error:", error);
        console.log("\n📋 Please create the table manually:");
        console.log(
          "1. Go to: https://supabase.com/dashboard/project/vpqjrrbosaedeydqwhkf/sql/new"
        );
        console.log("2. Run the SQL from widget-configurations-migration.sql");
        return;
      }

      console.log("Response:", output);

      if (output.includes("error") || output.includes("404")) {
        console.log("❌ API call failed - RPC function not available");
        console.log("📋 Manual setup required:");
        console.log(
          "1. Go to: https://supabase.com/dashboard/project/vpqjrrbosaedeydqwhkf/sql/new"
        );
        console.log("2. Copy and paste this SQL:");
        console.log("-".repeat(50));
        console.log(sql);
        console.log("-".repeat(50));
        console.log("3. Click 'RUN' to execute");
      } else {
        console.log("✅ Table creation request sent!");
        console.log("🔄 Testing if table was created...");
        testTableCreation();
      }
    });
  } catch (err) {
    console.error("❌ Error running curl:", err.message);
    showManualInstructions();
  }
}

function testTableCreation() {
  // Test if table now exists
  import("@supabase/supabase-js").then(({ createClient }) => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    supabase
      .from("widget_configurations")
      .select("count")
      .limit(1)
      .then(({ data, error }) => {
        if (!error) {
          console.log("✅ Table verified successfully!");
          console.log("🎉 Domain restriction feature is ready!");
          console.log("🚀 Next steps: npm run dev");
        } else {
          console.log("⚠️ Table not found, manual creation needed");
          showManualInstructions();
        }
      });
  });
}

function showManualInstructions() {
  console.log("\n📋 Manual Setup Instructions:");
  console.log(
    "1. Open Supabase Dashboard: https://supabase.com/dashboard/project/vpqjrrbosaedeydqwhkf/sql/new"
  );
  console.log("2. Copy the SQL from widget-configurations-migration.sql");
  console.log("3. Paste it in the SQL Editor and click 'RUN'");
  console.log("4. Test with: node test-table-creation.js");
}

// Run the script
createTableWithCurl();
