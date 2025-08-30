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

  let userId, userEmail;
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
    userEmail = user.email;
  } catch (authError) {
    return res.status(401).json({
      error: "Authentication failed",
      message: "Unable to validate authentication token",
    });
  }

  if (req.method === "POST") {
    try {
      const { allowedDomains, platform, element, organizationId } = req.body;

      // Validate input
      if (
        !allowedDomains ||
        !Array.isArray(allowedDomains) ||
        allowedDomains.length === 0
      ) {
        return res.status(400).json({
          error: "Invalid domains",
          message: "Please provide at least one valid domain",
        });
      }

      if (!platform || !element) {
        return res.status(400).json({
          error: "Missing configuration",
          message: "Platform and element are required",
        });
      }

      // Validate domains
      const domainPattern = /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
      const invalidDomains = allowedDomains.filter(
        (domain) => domain !== "localhost" && !domainPattern.test(domain)
      );

      if (invalidDomains.length > 0) {
        return res.status(400).json({
          error: "Invalid domain format",
          message: `Invalid domains: ${invalidDomains.join(", ")}`,
        });
      }

      // Save widget configuration
      const configData = {
        user_id: userId,
        organization_id: organizationId || null,
        platform: platform,
        element: element,
        allowed_domains: allowedDomains,
        configuration_data: {
          allowedDomains,
          platform,
          element,
          createdAt: new Date().toISOString(),
          createdBy: userEmail,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("widget_configurations")
        .insert(configData)
        .select()
        .single();

      if (error) {
        console.error("Database error:", error);
        return res.status(500).json({
          error: "Database error",
          message: "Failed to save widget configuration",
        });
      }

      console.log(
        `Widget configuration saved for user ${userId}: ${allowedDomains.join(", ")}`
      );

      return res.status(200).json({
        success: true,
        configId: data.id,
        message: "Widget configuration saved successfully",
        allowedDomains: allowedDomains,
      });
    } catch (error) {
      console.error("Error saving widget configuration:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error.message,
      });
    }
  }

  if (req.method === "GET") {
    try {
      // Get widget configurations for user
      const { data, error } = await supabase
        .from("widget_configurations")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Database error:", error);
        return res.status(500).json({
          error: "Database error",
          message: "Failed to fetch widget configurations",
        });
      }

      return res.status(200).json({
        configurations: data || [],
      });
    } catch (error) {
      console.error("Error fetching widget configurations:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error.message,
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
