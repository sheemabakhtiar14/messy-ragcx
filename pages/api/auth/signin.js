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
    const { email, password, rememberMe } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: "Missing credentials",
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

    // Sign in user
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password
    });

    if (error) {
      console.error("Signin error:", error);
      
      // Handle specific error cases
      if (error.message.includes("Invalid login credentials")) {
        return res.status(401).json({
          error: "Invalid credentials",
          message: "The email or password you entered is incorrect"
        });
      }
      
      if (error.message.includes("Email not confirmed")) {
        return res.status(403).json({
          error: "Email not verified",
          message: "Please check your email and click the verification link before signing in"
        });
      }

      if (error.message.includes("Too many requests")) {
        return res.status(429).json({
          error: "Too many attempts",
          message: "Too many sign-in attempts. Please wait a few minutes before trying again"
        });
      }

      return res.status(400).json({
        error: "Signin failed",
        message: error.message
      });
    }

    if (!data.user || !data.session) {
      return res.status(401).json({
        error: "Authentication failed",
        message: "Unable to authenticate user"
      });
    }

    // Calculate token expiration based on rememberMe
    const expiresIn = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60; // 30 days or 24 hours
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Set authentication cookie
    const cookieOptions = [
      `supabase-auth-token=${encodeURIComponent(JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }))}`,
      `Path=/`,
      `HttpOnly`,
      `SameSite=Lax`,
      `Max-Age=${expiresIn}`
    ];

    if (process.env.NODE_ENV === 'production') {
      cookieOptions.push('Secure');
    }

    res.setHeader('Set-Cookie', cookieOptions.join('; '));

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Successfully signed in",
      user: {
        id: data.user.id,
        email: data.user.email,
        email_confirmed: data.user.email_confirmed_at !== null,
        last_sign_in: data.user.last_sign_in_at,
        user_metadata: data.user.user_metadata
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in
      }
    });

  } catch (error) {
    console.error("Signin handler error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to sign in. Please try again."
    });
  }
}