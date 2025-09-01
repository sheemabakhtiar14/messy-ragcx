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
    // Get the authorization header
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // Also check for token in request body
    const { access_token } = req.body;
    if (!token && access_token) {
      token = access_token;
    }

    if (!token) {
      return res.status(400).json({
        error: "No token provided",
        message: "Access token is required for sign out"
      });
    }

    // Get user from token to validate it
    const { data: { user }, error: getUserError } = await supabase.auth.getUser(token);
    
    if (getUserError || !user) {
      return res.status(401).json({
        error: "Invalid token",
        message: "The provided token is invalid or expired"
      });
    }

    // Sign out the user globally (invalidates all sessions)
    const { error } = await supabase.auth.admin.signOut(token, 'global');

    if (error) {
      console.error("Signout error:", error);
      return res.status(400).json({
        error: "Signout failed",
        message: error.message
      });
    }

    // Clear authentication cookie
    const cookieOptions = [
      'supabase-auth-token=',
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=0' // Expire immediately
    ];

    if (process.env.NODE_ENV === 'production') {
      cookieOptions.push('Secure');
    }

    res.setHeader('Set-Cookie', cookieOptions.join('; '));

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Successfully signed out"
    });

  } catch (error) {
    console.error("Signout handler error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to sign out. Please try again."
    });
  }
}