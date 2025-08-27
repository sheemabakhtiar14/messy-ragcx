// utils/auth.js - Authentication helper
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for server-side
)

/**
 * Extract and validate user from request
 * This function should be used in all API endpoints
 */
export async function authenticateUser(req) {
  try {
    // Get the authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('No authentication token provided')
    }

    const token = authHeader.split(' ')[1]
    
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      throw new Error('Invalid authentication token')
    }

    return {
      userId: user.id,
      email: user.email,
      isAuthenticated: true
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return {
      userId: null,
      email: null,
      isAuthenticated: false,
      error: error.message
    }
  }
}

/**
 * Middleware to protect API routes
 */
export function requireAuth(handler) {
  return async (req, res) => {
    const auth = await authenticateUser(req)
    
    if (!auth.isAuthenticated) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Please log in to continue' 
      })
    }

    // Add user info to request object
    req.user = auth
    
    return handler(req, res)
  }
}
