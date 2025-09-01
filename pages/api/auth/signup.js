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
    const { email, password, fullName, metadata } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "Email and password are required"
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

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        error: "Weak password",
        message: "Password must be at least 6 characters long"
      });
    }

    // Prepare user metadata
    const userMetadata = {
      full_name: fullName || null,
      ...metadata
    };

    // Create user account
    const { data, error } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: false, // Set to true if you want to skip email confirmation
      user_metadata: userMetadata
    });

    if (error) {
      console.error("Signup error:", error);
      
      // Handle specific error cases
      if (error.message.includes("already registered")) {
        return res.status(409).json({
          error: "User already exists",
          message: "An account with this email already exists. Please sign in instead."
        });
      }
      
      if (error.message.includes("invalid email")) {
        return res.status(400).json({
          error: "Invalid email",
          message: "Please provide a valid email address"
        });
      }

      return res.status(400).json({
        error: "Signup failed",
        message: error.message
      });
    }

    // Return success response
    return res.status(201).json({
      success: true,
      message: "Account created successfully! Please check your email for verification.",
      user: {
        id: data.user.id,
        email: data.user.email,
        email_confirmed: data.user.email_confirmed_at !== null,
        created_at: data.user.created_at
      }
    });

  } catch (error) {
    console.error("Signup handler error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to create account. Please try again."
    });
  }
}