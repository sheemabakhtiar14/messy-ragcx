import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Handle CORS for cross-domain requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { configId, domain } = req.query;

    if (!configId) {
      return res.status(400).json({
        error: "Missing parameters",
        message: "Configuration ID is required",
      });
    }

    if (!domain) {
      return res.status(400).json({
        error: "Missing parameters",
        message: "Domain parameter is required for security validation",
      });
    }

    // Get widget configuration from database
    const { data: config, error } = await supabase
      .from("widget_configurations")
      .select("*")
      .eq("id", configId)
      .eq("is_active", true)
      .single();

    if (error || !config) {
      return res.status(404).json({
        error: "Configuration not found",
        message: "Widget configuration not found or inactive",
      });
    }

    // Validate requesting domain is authorized
    const allowedDomains = config.allowed_domains || [];
    const isDomainAllowed = allowedDomains.some(
      (allowedDomain) =>
        domain === allowedDomain ||
        domain.endsWith("." + allowedDomain) ||
        allowedDomain === "localhost"
    );

    if (!isDomainAllowed) {
      console.warn(
        `Unauthorized domain access attempt: ${domain} for config ${configId}`
      );
      return res.status(403).json({
        error: "Unauthorized domain",
        message: `Domain '${domain}' is not authorized for this widget`,
        allowedDomains: allowedDomains,
      });
    }

    // Validate and return stored widget token
    if (config.widget_token) {
      // Verify token is not expired
      try {
        const [payloadBase64] = config.widget_token.split(".");
        const payload = JSON.parse(
          Buffer.from(payloadBase64, "base64").toString()
        );

        if (payload.exp && Date.now() > payload.exp) {
          // Token expired, generate a new one
          const newTokenPayload = {
            userId: config.user_id,
            email: payload.email,
            type: "persistent_widget",
            configId: config.id,
            domains: allowedDomains,
            iat: Date.now(),
            exp: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
          };

          const payloadString = JSON.stringify(newTokenPayload);
          const WIDGET_SECRET =
            process.env.WIDGET_SECRET ||
            "secure-widget-secret-2024-production-change-this-key";
          const signature = crypto
            .createHmac("sha256", WIDGET_SECRET)
            .update(payloadString)
            .digest("hex");

          const newWidgetToken =
            Buffer.from(payloadString).toString("base64") + "." + signature;

          // Update token in database
          await supabase
            .from("widget_configurations")
            .update({
              widget_token: newWidgetToken,
              updated_at: new Date().toISOString(),
            })
            .eq("id", configId);

          console.log(
            `Generated new widget token for config ${configId} (expired token refreshed)`
          );

          return res.status(200).json({
            widget_token: newWidgetToken,
            config_id: configId,
            user_id: config.user_id,
            domains: allowedDomains,
            expires_in: 365 * 24 * 60 * 60,
            message: "Widget token refreshed successfully",
          });
        }

        console.log(
          `Retrieved widget token for config ${configId} from domain ${domain}`
        );

        return res.status(200).json({
          widget_token: config.widget_token,
          config_id: configId,
          user_id: config.user_id,
          domains: allowedDomains,
          expires_in: Math.floor((payload.exp - Date.now()) / 1000),
          message: "Widget token retrieved successfully",
        });
      } catch (tokenError) {
        console.error("Token validation error:", tokenError);
        return res.status(500).json({
          error: "Token validation failed",
          message: "Stored widget token is invalid",
        });
      }
    } else {
      return res.status(404).json({
        error: "No widget token",
        message: "No persistent widget token found for this configuration",
      });
    }
  } catch (error) {
    console.error("Error retrieving widget token:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}
