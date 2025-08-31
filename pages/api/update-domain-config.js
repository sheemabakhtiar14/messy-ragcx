import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Authenticate user
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Please provide a valid authentication token",
    });
  }

  const token = authHeader.split(" ")[1];

  let userId;
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({
        error: "Invalid authentication token",
        message: "Please log in again",
      });
    }
    userId = user.id;
  } catch (error) {
    return res.status(401).json({
      error: "Authentication failed",
      message: "Unable to validate authentication token",
    });
  }

  if (req.method === "PUT") {
    try {
      const { configId, newDomain } = req.body;

      // Validate input
      if (!configId) {
        return res.status(400).json({
          error: "Missing configuration ID",
          message: "Configuration ID is required",
        });
      }

      if (!newDomain) {
        return res.status(400).json({
          error: "Missing domain",
          message: "New domain is required",
        });
      }

      // Validate domain format
      const domainPattern = /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
      if (newDomain !== "localhost" && !domainPattern.test(newDomain)) {
        return res.status(400).json({
          error: "Invalid domain format",
          message: `Invalid domain: ${newDomain}`,
        });
      }

      // Get existing configuration
      const { data: config, error: configError } = await supabase
        .from("widget_configurations")
        .select("allowed_domains")
        .eq("id", configId)
        .eq("user_id", userId)
        .single();

      if (configError || !config) {
        return res.status(404).json({
          error: "Configuration not found",
          message: "Widget configuration not found or not owned by user",
        });
      }

      // Check if domain already exists
      const allowedDomains = config.allowed_domains || [];
      if (allowedDomains.includes(newDomain)) {
        return res.status(400).json({
          error: "Domain already exists",
          message: `Domain '${newDomain}' is already in the allowed list`,
        });
      }

      // Add new domain to allowed domains
      const updatedDomains = [...allowedDomains, newDomain];

      // Update configuration
      const { error: updateError } = await supabase
        .from("widget_configurations")
        .update({
          allowed_domains: updatedDomains,
          updated_at: new Date().toISOString(),
        })
        .eq("id", configId)
        .eq("user_id", userId);

      if (updateError) {
        console.error("Database error:", updateError);
        return res.status(500).json({
          error: "Database error",
          message: "Failed to update widget configuration",
        });
      }

      console.log(
        `Domain '${newDomain}' added to configuration ${configId} for user ${userId}`
      );

      return res.status(200).json({
        success: true,
        message: `Domain '${newDomain}' successfully added to allowed domains`,
        allowedDomains: updatedDomains,
      });
    } catch (error) {
      console.error("Error updating widget configuration:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error.message,
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
