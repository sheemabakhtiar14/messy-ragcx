import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cookie"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Try to get session from Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (!error && user) {
        return res.status(200).json({
          access_token: token,
          user: {
            id: user.id,
            email: user.email,
          },
          authenticated: true,
        });
      }
    }

    // Try to get session from cookies (for same-domain scenarios)
    const cookies = req.headers.cookie;
    if (cookies) {
      const sessionCookie = cookies
        .split(";")
        .find((cookie) => cookie.trim().startsWith("supabase-auth-token="));

      if (sessionCookie) {
        try {
          const tokenValue = sessionCookie.split("=")[1];
          const sessionData = JSON.parse(decodeURIComponent(tokenValue));

          if (sessionData.access_token) {
            const {
              data: { user },
              error,
            } = await supabase.auth.getUser(sessionData.access_token);
            if (!error && user) {
              return res.status(200).json({
                access_token: sessionData.access_token,
                user: {
                  id: user.id,
                  email: user.email,
                },
                authenticated: true,
              });
            }
          }
        } catch (e) {
          // Invalid cookie format
        }
      }
    }

    // No valid session found
    return res.status(401).json({
      authenticated: false,
      message: "No valid session found. Please log in to the main application.",
    });
  } catch (error) {
    console.error("Session check error:", error);
    return res.status(500).json({
      authenticated: false,
      error: "Failed to check authentication status",
      message: "Please try logging in again.",
    });
  }
}
