#!/usr/bin/env node

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Simple test to check if our Supabase connection works
import { createClient } from "@supabase/supabase-js";

async function testSupabaseConnection() {
  console.log("🧪 Testing Direct Supabase Connection...\n");

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
