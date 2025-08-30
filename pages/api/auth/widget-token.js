import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Custom secret for widget tokens (completely separate from Supabase)
const WIDGET_SECRET =
  process.env.WIDGET_SECRET || "secure-widget-secret-2024-production-change-this-key";

// Function to create secure widget token using Node.js crypto
function createWidgetToken(userId, email) {
  const payload = {
    userId,
    email,
    type: "widget",
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };

  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", WIDGET_SECRET)
    .update(payloadString)
    .digest("hex");

  return Buffer.from(payloadString).toString("base64") + "." + signature;
}

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get Supabase token from main app (this NEVER leaves the server)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
        message:
          "Please provide a valid session token from the main application",
      });
    }

    const supabaseToken = authHeader.split(" ")[1];

    // Validate with Supabase (server-side only - token stays secure)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(supabaseToken);
    if (error || !user) {
      return res.status(401).json({
        error: "Invalid session",
        message: "Please log in to the main application again",
      });
    }

    // Generate safe widget token (this is SAFE to expose to client)
    const widgetToken = createWidgetToken(user.id, user.email);

    console.log(
      `🔐 Generated secure widget token for user: ${user.id} (${user.email})`
    );

    return res.status(200).json({
      widget_token: widgetToken, // SAFE to expose - contains no Supabase secrets
      user: { id: user.id, email: user.email },
      expires_in: 24 * 60 * 60,
      message: "Secure widget token generated successfully",
    });
  } catch (error) {
    console.error("Widget token generation error:", error);
    return res.status(500).json({
      error: "Token generation failed",
      message: "Unable to generate secure widget authentication token",
    });
  }
}
