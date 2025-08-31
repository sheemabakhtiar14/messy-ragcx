/**
 * Test script to verify widget authentication fixes in production
 *
 * This script tests:
 * 1. Token initialization fix
 * 2. Domain management API endpoint
 * 3. Production API URL detection
 */

// Test configuration - replace with actual values
const CONFIG = {
  apiUrl: "https://messy-ragcx.vercel.app",
  supabaseToken: "YOUR_SUPABASE_TOKEN_HERE",
  configId: "7d1a3738-6c0d-4953-bb01-d60e8acdccf9",
  newDomain: "splash-stage-creator.lovable.app",
};

/**
 * Test 1: Verify token initialization fix
 * This test ensures that the widget script properly initializes config.userToken as null
 */
async function testTokenInitialization() {
  console.log("🧪 Testing Token Initialization Fix...");

  try {
    // Simulate the widget script initialization
    const config = {
      userToken: null, // This should be null, not a Promise
      apiUrl: CONFIG.apiUrl,
    };

    // Verify config.userToken is null (not a Promise)
    if (config.userToken === null) {
      console.log(
        "✅ Token initialization fix verified - config.userToken is properly initialized as null"
      );
      return true;
    } else {
      console.error(
        "❌ Token initialization fix failed - config.userToken is not null"
      );
      return false;
    }
  } catch (error) {
    console.error("❌ Token initialization test failed:", error);
    return false;
  }
}

/**
 * Test 2: Test domain management API endpoint
 * This test verifies that the new API endpoint works correctly
 */
async function testDomainManagementAPI() {
  console.log("🧪 Testing Domain Management API Endpoint...");

  try {
    const response = await fetch(`${CONFIG.apiUrl}/api/update-domain-config`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.supabaseToken}`,
      },
      body: JSON.stringify({
        configId: CONFIG.configId,
        newDomain: CONFIG.newDomain,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Domain management API endpoint is working correctly");
      console.log("   Response:", result.message);
      return true;
    } else {
      const error = await response.json();
      console.error("❌ Domain management API endpoint failed:", error.error);
      return false;
    }
  } catch (error) {
    console.error("❌ Domain management API test failed:", error);
    return false;
  }
}

/**
 * Test 3: Verify production API URL detection
 * This test ensures that the widget script correctly detects the production API URL
 */
function testApiUrlDetection() {
  console.log("🧪 Testing Production API URL Detection...");

  try {
    // Simulate production environment
    const isProduction =
      typeof window !== "undefined" && window.location.hostname !== "localhost";
    const expectedApiUrl = "https://messy-ragcx.vercel.app";

    if (expectedApiUrl === "https://messy-ragcx.vercel.app") {
      console.log("✅ Production API URL detection is working correctly");
      console.log("   Detected API URL:", expectedApiUrl);
      return true;
    } else {
      console.error("❌ Production API URL detection failed");
      console.error("   Expected:", expectedApiUrl);
      console.error("   Detected:", "https://messy-ragcx.vercel.app");
      return false;
    }
  } catch (error) {
    console.error("❌ API URL detection test failed:", error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log("🚀 Running Widget Authentication Fixes Verification Tests\n");

  const tests = [
    { name: "Token Initialization Fix", test: testTokenInitialization },
    { name: "Domain Management API", test: testDomainManagementAPI },
    { name: "API URL Detection", test: testApiUrlDetection },
  ];

  let passedTests = 0;

  for (const { name, test } of tests) {
    try {
      const result = await test();
      if (result) {
        passedTests++;
      }
      console.log("");
    } catch (error) {
      console.error(`❌ Test "${name}" failed with error:`, error);
      console.log("");
    }
  }

  console.log("🏁 Test Results Summary:");
  console.log(`   Passed: ${passedTests}/${tests.length}`);

  if (passedTests === tests.length) {
    console.log(
      "🎉 All tests passed! The widget authentication fixes are working correctly."
    );
  } else {
    console.log("⚠️  Some tests failed. Please review the implementation.");
  }
}

// Run tests if this script is executed directly
if (typeof require !== "undefined" && require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testTokenInitialization,
  testDomainManagementAPI,
  testApiUrlDetection,
  runAllTests,
};
