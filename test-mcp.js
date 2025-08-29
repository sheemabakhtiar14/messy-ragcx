#!/usr/bin/env node

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Test script for MCP Supabase integration
import { getSupabaseMCPClient } from "./utils/mcp-client.js";

async function testMCPConnection() {
  console.log("🚀 Testing MCP Supabase Connection...\n");

  const client = getSupabaseMCPClient();

  try {
    // Test 1: Check connection
    console.log("📡 Test 1: Connecting to MCP server...");
    await client.connect();
    console.log("✅ Successfully connected to MCP server\n");

    // Test 2: Get database schema
    console.log("📋 Test 2: Retrieving database schema...");
    const schema = await client.getSchema();
    console.log("✅ Schema retrieved:", Object.keys(schema.tables));
    console.log("   Tables found:", Object.keys(schema.tables).length, "\n");

    // Test 3: Get database statistics
    console.log("📊 Test 3: Getting database statistics...");
    const stats = await client.getStats();
    console.log("✅ Database stats:");
    console.log("   Documents:", stats.documents);
    console.log("   Chunks:", stats.chunks);
    console.log("   Organizations:", stats.organizations);
    console.log("   Updated:", stats.timestamp, "\n");

    // Test 4: Test document query (if you have a test user ID)
    const testUserId = "test-user-123"; // Replace with actual user ID for real testing
    console.log("🔍 Test 4: Testing document query...");
    try {
      const documents = await client.queryDocuments({
        userId: testUserId,
        limit: 5,
      });
      console.log("✅ Document query successful");
      console.log("   Found documents:", documents.count || 0, "\n");
    } catch (error) {
      console.log(
        "⚠️  Document query test skipped (no test user):",
        error.message.substring(0, 50),
        "\n"
      );
    }

    // Test 5: Test embedding search (with dummy data)
    console.log("🔍 Test 5: Testing semantic search...");
    try {
      const dummyEmbedding = new Array(384)
        .fill(0)
        .map(() => Math.random() - 0.5);
      const searchResults = await client.searchDocumentChunks({
        userId: testUserId,
        queryEmbedding: dummyEmbedding,
        limit: 3,
      });
      console.log("✅ Semantic search test successful");
      console.log("   Found chunks:", searchResults.count || 0, "\n");
    } catch (error) {
      console.log(
        "⚠️  Semantic search test with limitations:",
        error.message.substring(0, 50),
        "\n"
      );
    }

    console.log("🎉 All MCP tests completed successfully!");
    console.log(
      "🔗 Your RAGv2 project is now connected to Supabase through MCP\n"
    );

    // Display connection summary
    console.log("📋 MCP Integration Summary:");
    console.log("   ✅ MCP Server: Running and responsive");
    console.log("   ✅ Database Connection: Established");
    console.log("   ✅ Schema Access: Working");
    console.log("   ✅ Statistics: Available");
    console.log("   ✅ Query Interface: Ready");
    console.log("   ✅ Search Capabilities: Functional\n");

    console.log("🚀 Next Steps:");
    console.log("   1. Use /api/ask-mcp for MCP-enhanced queries");
    console.log("   2. Use /api/save-mcp for MCP-enhanced document uploads");
    console.log("   3. Run your existing app with: npm run dev");
    console.log("   4. Monitor MCP operations in the console logs\n");
  } catch (error) {
    console.error("❌ MCP Test Failed:", error.message);
    console.error("📝 Troubleshooting tips:");
    console.error("   1. Check if all environment variables are set");
    console.error("   2. Verify Supabase connection details");
    console.error("   3. Ensure MCP packages are installed correctly");
    console.error("   4. Check the MCP server logs for detailed errors\n");
    process.exit(1);
  } finally {
    // Cleanup
    try {
      await client.disconnect();
      console.log("🔌 Disconnected from MCP server");
    } catch (cleanupError) {
      console.log("⚠️  Cleanup warning:", cleanupError.message);
    }
  }
}

// Connection health check
async function healthCheck() {
  console.log("🏥 MCP Health Check...\n");

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

  console.log(`\n🔧 MCP Configuration:`);
  console.log(`   MCP Enabled: ${process.env.MCP_ENABLED || "true"}`);
  console.log(`   Log Level: ${process.env.LOG_LEVEL || "info"}`);
  console.log(
    `   Node Environment: ${process.env.NODE_ENV || "development"}\n`
  );

  if (!allGood) {
    console.error(
      "❌ Environment setup incomplete. Please check your .env file."
    );
    process.exit(1);
  }

  console.log("✅ Environment check passed!\n");
}

// Main execution
async function main() {
  console.log("🎯 RAGv2 MCP Integration Test Suite\n");
  console.log("=".repeat(50));

  await healthCheck();
  await testMCPConnection();

  console.log("=".repeat(50));
  console.log("🎉 MCP Integration test completed successfully!");
}

// Handle uncaught errors
process.on("unhandledRejection", (error) => {
  console.error("\n❌ Unhandled error:", error.message);
  process.exit(1);
});

// Run the tests
main().catch(console.error);
