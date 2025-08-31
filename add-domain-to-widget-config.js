/**
 * Script to add any domain to a widget configuration
 *
 * Usage: node add-domain-to-widget-config.js [domain-name]
 * Example: node add-domain-to-widget-config.js my-new-domain.lovable.app
 */

// Read environment variables directly
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to parse .env file
function parseEnvFile() {
  const envPath = path.resolve(__dirname, ".env");
  const envContent = fs.readFileSync(envPath, "utf8");
  const envVars = {};

  envContent.split("\n").forEach((line) => {
    if (line.trim() && !line.startsWith("#")) {
      const [key, value] = line.split("=");
      if (key && value) {
        envVars[key.trim()] = value.trim().replace(/['"]/g, "");
      }
    }
  });

  return envVars;
}

// Parse environment variables
const envVars = parseEnvFile();

// Initialize Supabase client
const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

// Get domain from command line arguments
const NEW_DOMAIN = process.argv[2];

if (!NEW_DOMAIN) {
  console.log("Usage: node add-domain-to-widget-config.js [domain-name]");
  console.log(
    "Example: node add-domain-to-widget-config.js my-new-domain.lovable.app"
  );
  process.exit(1);
}

async function addDomainToLatestConfiguration() {
  try {
    console.log(`Adding domain ${NEW_DOMAIN} to widget configuration...`);

    // Get the most recent widget configuration
    const { data: configurations, error } = await supabase
      .from("widget_configurations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error fetching configurations:", error);
      return;
    }

    if (!configurations || configurations.length === 0) {
      console.log("No widget configurations found");
      return;
    }

    const config = configurations[0];
    console.log(`Found configuration ID: ${config.id}`);

    // Check if domain already exists
    const allowedDomains = config.allowed_domains || [];
    if (allowedDomains.includes(NEW_DOMAIN)) {
      console.log(`Domain ${NEW_DOMAIN} already exists in configuration`);
      return;
    }

    // Add new domain
    const updatedDomains = [...allowedDomains, NEW_DOMAIN];

    console.log(`Current allowed domains: ${allowedDomains.join(", ")}`);
    console.log(`Adding new domain: ${NEW_DOMAIN}`);

    // Update configuration
    const { error: updateError } = await supabase
      .from("widget_configurations")
      .update({
        allowed_domains: updatedDomains,
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    if (updateError) {
      console.error("Error updating configuration:", updateError);
      return;
    }

    console.log(
      `✅ Successfully added domain ${NEW_DOMAIN} to configuration ${config.id}`
    );
    console.log(`Updated allowed domains: ${updatedDomains.join(", ")}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the script
addDomainToLatestConfiguration();
