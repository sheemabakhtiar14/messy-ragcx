/**
 * Script to add a new domain to the most recent widget configuration
 *
 * Usage: node add-new-domain.js
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NEW_DOMAIN = "welcome-web-starter-80.lovable.app";

async function addDomainToLatestConfiguration() {
  try {
    console.log("Fetching widget configurations...");

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
    console.log(
      `Current allowed domains: ${config.allowed_domains ? config.allowed_domains.join(", ") : "None"}`
    );

    // Check if domain already exists
    const allowedDomains = config.allowed_domains || [];
    if (allowedDomains.includes(NEW_DOMAIN)) {
      console.log(`Domain ${NEW_DOMAIN} already exists in configuration`);
      return;
    }

    // Add new domain
    const updatedDomains = [...allowedDomains, NEW_DOMAIN];

    console.log(`Adding domain ${NEW_DOMAIN} to configuration...`);

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
