#!/usr/bin/env node

// Direct table creation using authenticated Supabase client with service role
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
dotenv.config();

async function createTableDirectly() {
  console.log("🗄️ Attempting direct table creation with service role...\n");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // First check if the table exists
  try {
    const { data, error } = await supabase
      .from("widget_configurations")
      .select("count")
      .limit(1);

    if (!error) {
      console.log("✅ widget_configurations table already exists!");
      console.log("🎉 Domain restriction feature is ready to use!");
      return true;
    }
  } catch (e) {
    console.log("⚠️ Table doesn't exist, attempting creation...");
  }

  // Try to create a record to see what error we get (this can help identify the issue)
  try {
    const testRecord = {
      user_id: "00000000-0000-0000-0000-000000000000",
      platform: "web",
      element: "ai-agent",
      allowed_domains: ["test.com"],
      configuration_data: { test: true },
      is_active: true,
    };

    const { data, error } = await supabase
      .from("widget_configurations")
      .insert(testRecord)
      .select();

    if (error) {
      if (
        error.message.includes(
          'relation "widget_configurations" does not exist'
        )
      ) {
        console.log("❌ Confirmed: widget_configurations table does not exist");
        console.log(
          "📋 Since Supabase doesn't allow direct SQL execution via SDK,"
        );
        console.log(
          "   we need to create the table through the Supabase dashboard."
        );
        console.log("\n🔧 Please follow these steps:");
        console.log(
          "1. Go to: https://supabase.com/dashboard/project/vpqjrrbosaedeydqwhkf/sql/new"
        );
        console.log(
          "2. Paste and run the SQL from the widget-configurations-migration.sql file"
        );
        console.log("3. Or manually run the schema creation");
        return false;
      } else {
        console.log("❌ Unexpected error:", error.message);
        return false;
      }
    } else {
      // If successful, clean up the test record
      await supabase
        .from("widget_configurations")
        .delete()
        .eq("user_id", "00000000-0000-0000-0000-000000000000");

      console.log("✅ Table exists and working!");
      return true;
    }
  } catch (error) {
    console.error("❌ Error testing table:", error.message);
    return false;
  }
}

// Run the test
createTableDirectly()
  .then((success) => {
    if (success) {
      console.log("\n🎉 Database setup complete!");
      console.log("   ✅ widget_configurations table ready");
      console.log("   ✅ Domain restriction feature active");
      console.log("   🚀 Ready to test: npm run dev");
    } else {
      console.log("\n📋 Manual setup required - see instructions above");
    }
  })
  .catch(console.error);
