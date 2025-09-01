import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Handle email verification
  if (req.method === "POST") {
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
        ? 'https://messy-ragcx.vercel.app/auth/email-confirmed'
        : 'http://localhost:3000/auth/email-confirmed';

      const confirmRedirectTo = redirectTo || defaultRedirectTo;

      // Resend verification email
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: confirmRedirectTo
        }
      });

      if (error) {
        console.error("Email verification error:", error);
        
        // Handle specific error cases
        if (error.message.includes("User not found")) {
          return res.status(404).json({
            error: "User not found",
            message: "No account found with this email address"
          });
        }

        if (error.message.includes("Email already confirmed")) {
          return res.status(400).json({
            error: "Already verified",
            message: "This email address has already been verified"
          });
        }

        if (error.message.includes("Too many requests")) {
          return res.status(429).json({
            error: "Too many requests",
            message: "Too many verification attempts. Please wait a few minutes before trying again"
          });
        }

        return res.status(400).json({
          error: "Verification failed",
          message: error.message
        });
      }

      return res.status(200).json({
        success: true,
        message: "Verification email sent! Please check your email and click the verification link."
      });

    } catch (error) {
      console.error("Email verification handler error:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: "Failed to send verification email. Please try again."
      });
    }
  }

  // Handle email verification confirmation (GET request with token)
  if (req.method === "GET") {
    try {
      const { token, type, redirect_to } = req.query;

      if (!token || !type) {
        return res.status(400).json({
          error: "Missing parameters",
          message: "Token and type are required for email verification"
        });
      }

      // Verify the email using the token
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: type // 'email' or 'signup'
      });

      if (error) {
        console.error("Email verification confirmation error:", error);
        
        if (error.message.includes("Token has expired")) {
          return res.status(400).json({
            error: "Token expired",
            message: "The verification link has expired. Please request a new one."
          });
        }

        if (error.message.includes("Invalid token")) {
          return res.status(400).json({
            error: "Invalid token",
            message: "The verification link is invalid. Please request a new one."
          });
        }

        return res.status(400).json({
          error: "Verification failed",
          message: error.message
        });
      }

      if (!data.user) {
        return res.status(400).json({
          error: "Verification failed",
          message: "Unable to verify email"
        });
      }

      // If redirect_to is provided, redirect the user
      if (redirect_to) {
        return res.redirect(302, redirect_to);
      }

      return res.status(200).json({
        success: true,
        message: "Email verified successfully!",
        user: {
          id: data.user.id,
          email: data.user.email,
          email_confirmed: true,
          verified_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error("Email verification confirmation handler error:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: "Failed to verify email. Please try again."
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}