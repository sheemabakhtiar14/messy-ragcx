#!/usr/bin/env node

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Database reader script
import { createClient } from "@supabase/supabase-js";

async function readDatabaseTables() {
  console.log("🗄️  Reading Database Tables...\n");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Method 1: Query information_schema to get all tables
    console.log("📋 Querying database schema...");

    const { data: tables, error: tablesError } = await supabase.rpc(
      "exec_sql",
      {
        query: `
          SELECT 
            table_name,
            table_type,
            table_schema
          FROM information_schema.tables 
          WHERE table_schema = 'public'
          ORDER BY table_name;
        `,
      }
    );

    if (tablesError) {
      // Fallback method: Try to query known tables directly
      console.log("Using fallback method to check tables...");

      const knownTables = [
        "documents",
        "document_chunks",
        "organizations",
        "organization_memberships",
      ];

      console.log("\n📊 Table Information:");
      console.log("=".repeat(50));

      for (const tableName of knownTables) {
        try {
          const { data, error, count } = await supabase
            .from(tableName)
            .select("*", { count: "exact", head: true });

          if (!error) {
            console.log(`✅ ${tableName}`);
            console.log(`   - Type: Table`);
            console.log(`   - Record count: ${count || 0}`);
            console.log("");
          } else {
            console.log(`❌ ${tableName} - ${error.message}`);
          }
        } catch (tableError) {
          console.log(`❌ ${tableName} - Error: ${tableError.message}`);
        }
      }

      // Also check for any additional tables by trying some common ones
      const additionalTables = [
        "users",
        "profiles",
        "auth.users",
        "storage.objects",
        "storage.buckets",
      ];

      console.log("🔍 Checking for additional tables:");
      for (const tableName of additionalTables) {
        try {
          const { error } = await supabase
            .from(tableName.replace("auth.", "").replace("storage.", ""))
            .select("*", { count: "exact", head: true });

          if (!error) {
            console.log(`✅ ${tableName} exists`);
          }
        } catch (error) {
          // Table doesn't exist or no access - skip
        }
      }
    } else {
      console.log("\n📊 Database Tables Found:");
      console.log("=".repeat(50));

      if (tables && tables.length > 0) {
        tables.forEach((table) => {
          console.log(`✅ ${table.table_name}`);
          console.log(`   - Type: ${table.table_type}`);
          console.log(`   - Schema: ${table.table_schema}`);
          console.log("");
        });
      } else {
        console.log("No tables found in public schema.");
      }
    }

    // Get detailed information about our main tables
    console.log("\n🔍 Detailed Table Analysis:");
    console.log("=".repeat(50));

    const mainTables = [
      "documents",
      "document_chunks",
      "organizations",
      "organization_memberships",
    ];

    for (const tableName of mainTables) {
      try {
        console.log(`\n📋 Table: ${tableName}`);

        // Get row count
        const { count, error: countError } = await supabase
          .from(tableName)
          .select("*", { count: "exact", head: true });

        if (!countError) {
          console.log(`   Records: ${count || 0}`);

          // Get sample data structure (first row)
          const { data: sampleData, error: sampleError } = await supabase
            .from(tableName)
            .select("*")
            .limit(1);

          if (!sampleError && sampleData && sampleData.length > 0) {
            const columns = Object.keys(sampleData[0]);
            console.log(
              `   Columns (${columns.length}): ${columns.join(", ")}`
            );
          } else {
            console.log("   Columns: Unable to determine (table may be empty)");
          }
        } else {
          console.log(`   Error: ${countError.message}`);
        }
      } catch (error) {
        console.log(`   Error accessing ${tableName}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error("❌ Database read error:", error.message);
    console.error("\n📝 Troubleshooting:");
    console.error("   1. Check SUPABASE_SERVICE_ROLE_KEY permissions");
    console.error("   2. Verify database connection");
    console.error("   3. Ensure tables exist in the database");
  }
}

// Main execution
async function main() {
  console.log("🗄️  RAGv2 Database Reader\n");
  await readDatabaseTables();
  console.log("\n✅ Database read complete!");
}

main().catch(console.error);
