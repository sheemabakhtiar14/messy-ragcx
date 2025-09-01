import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, redirectTo } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        error: "Missing email",
        message: "Email address is required"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Invalid email format",
        message: "Please provide a valid email address"
      });
    }

    // Default redirect URL if not provided
    const defaultRedirectTo = process.env.NODE_ENV === 'production' 
      ? 'https://messy-ragcx.vercel.app/auth/reset-password-confirm'
      : 'http://localhost:3000/auth/reset-password-confirm';

    const resetRedirectTo = redirectTo || defaultRedirectTo;

    // Send password reset email
    const { data, error } = await supabase.auth.resetPasswordForEmail(
      email.toLowerCase().trim(),
      {
        redirectTo: resetRedirectTo
      }
    );

    if (error) {
      console.error("Password reset error:", error);
      
      // Handle specific error cases
      if (error.message.includes("User not found")) {
        return res.status(404).json({
          error: "User not found",
          message: "No account found with this email address"
        });
      }

      if (error.message.includes("Too many requests")) {
        return res.status(429).json({
          error: "Too many requests",
          message: "Too many password reset attempts. Please wait a few minutes before trying again"
        });
      }

      return res.status(400).json({
        error: "Reset failed",
        message: error.message
      });
    }

    // Return success response (don't reveal whether user exists for security)
    return res.status(200).json({
      success: true,
      message: "If an account with this email exists, you will receive a password reset link shortly. Please check your email and follow the instructions."
    });

  } catch (error) {
    console.error("Password reset handler error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to send password reset email. Please try again."
    });
  }
}