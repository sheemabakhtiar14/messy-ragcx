// utils/auth.js - Authentication helper
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for server-side
)

// Export supabase client for direct use if needed
export { supabase }

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
      isAuthenticated: true,
      user: user // Include full user object
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return {
      userId: null,
      email: null,
      isAuthenticated: false,
      error: error.message,
      user: null
    }
  }
}

/**
 * Create a new user session
 */
export async function createUserSession(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: sanitizeInput(email).toLowerCase(),
      password
    })

    if (error) {
      throw error
    }

    return {
      success: true,
      user: data.user,
      session: data.session
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Create a new user account
 */
export async function createUserAccount(email, password, metadata = {}) {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: sanitizeInput(email).toLowerCase(),
      password,
      email_confirm: false,
      user_metadata: metadata
    })

    if (error) {
      throw error
    }

    return {
      success: true,
      user: data.user
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Email validation helper
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Password validation helper
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' }
  }
  
  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters long' }
  }
  
  if (password.length > 128) {
    return { valid: false, message: 'Password must be less than 128 characters' }
  }
  
  return { valid: true }
}

/**
 * User input sanitization helper
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input
  return input.trim()
}

/**
 * Rate limiting helper for authentication attempts
 */
const attempts = new Map()

export function checkRateLimit(identifier, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now()
  const key = `${identifier}-${Math.floor(now / windowMs)}`
  
  const currentAttempts = attempts.get(key) || 0
  
  if (currentAttempts >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: Math.ceil((Math.floor(now / windowMs) + 1) * windowMs)
    }
  }
  
  attempts.set(key, currentAttempts + 1)
  
  return {
    allowed: true,
    remaining: maxAttempts - currentAttempts - 1,
    resetTime: Math.ceil((Math.floor(now / windowMs) + 1) * windowMs)
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
