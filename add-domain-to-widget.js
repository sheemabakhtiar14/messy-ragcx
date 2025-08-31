/**
 * Script to add a new domain to an existing widget configuration
 *
 * This script will:
 * 1. Fetch existing widget configurations from Supabase
 * 2. Allow user to select which configuration to update
 * 3. Add the new domain to the selected configuration
 */

import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Fetch all widget configurations
 */
async function getWidgetConfigurations() {
  try {
    const { data, error } = await supabase
      .from("widget_configurations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching widget configurations:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

/**
 * Add a new domain to a widget configuration
 */
async function addDomainToConfiguration(configId, newDomain) {
  try {
    // Get existing configuration
    const { data: config, error: fetchError } = await supabase
      .from("widget_configurations")
      .select("allowed_domains")
      .eq("id", configId)
      .single();

    if (fetchError) {
      console.error("Error fetching configuration:", fetchError);
      return false;
    }

    // Check if domain already exists
    const allowedDomains = config.allowed_domains || [];
    if (allowedDomains.includes(newDomain)) {
      console.log(`Domain ${newDomain} already exists in configuration`);
      return true;
    }

    // Add new domain
    const updatedDomains = [...allowedDomains, newDomain];

    // Update configuration
    const { error: updateError } = await supabase
      .from("widget_configurations")
      .update({
        allowed_domains: updatedDomains,
        updated_at: new Date().toISOString(),
      })
      .eq("id", configId);

    if (updateError) {
      console.error("Error updating configuration:", updateError);
      return false;
    }

    console.log(
      `Successfully added domain ${newDomain} to configuration ${configId}`
    );
    return true;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const newDomain = "intro-page-easy.lovable.app";

  console.log(`Fetching widget configurations...`);

  const configurations = await getWidgetConfigurations();

  if (!configurations || configurations.length === 0) {
    console.log("No widget configurations found");
    return;
  }

  console.log(`Found ${configurations.length} widget configurations:`);

  // Display configurations
  configurations.forEach((config, index) => {
    console.log(`${index + 1}. ID: ${config.id}`);
    console.log(`   User ID: ${config.user_id}`);
    console.log(`   Platform: ${config.platform}`);
    console.log(`   Element: ${config.element}`);
    console.log(
      `   Allowed Domains: ${config.allowed_domains ? config.allowed_domains.join(", ") : "None"}`
    );
    console.log(`   Created: ${config.created_at}`);
    console.log("");
  });

  // For now, we'll update the first configuration
  // In a real implementation, you would select the appropriate configuration
  const configToUpdate = configurations[0];

  console.log(
    `Adding domain ${newDomain} to configuration ${configToUpdate.id}...`
  );

  const success = await addDomainToConfiguration(configToUpdate.id, newDomain);

  if (success) {
    console.log("Domain added successfully!");
  } else {
    console.log("Failed to add domain");
  }
}

// Run the script if executed directly
if (typeof require !== "undefined" && require.main === module) {
  main().catch(console.error);
}

export { getWidgetConfigurations, addDomainToConfiguration };
