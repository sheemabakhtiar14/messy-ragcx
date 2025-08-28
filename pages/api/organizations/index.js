// pages/api/organizations/index.js - Organization management API
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../../../utils/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default requireAuth(async function handler(req, res) {
  const userId = req.user.userId

  if (req.method === 'GET') {
    // Get user's organizations
    try {
      const { data: memberships, error } = await supabase
        .from('organization_memberships')
        .select(`
          organization_id,
          role,
          joined_at,
          organizations (
            id,
            name,
            description,
            created_by_user_id,
            created_at
          )
        `)
        .eq('user_id', userId)

      if (error) throw error

      const organizations = memberships.map(membership => ({
        ...membership.organizations,
        user_role: membership.role,
        joined_at: membership.joined_at
      }))

      res.json({
        organizations,
        count: organizations.length
      })
    } catch (error) {
      console.error('Get organizations error:', error)
      res.status(500).json({ error: 'Failed to fetch organizations' })
    }
  }

  else if (req.method === 'POST') {
    // Create new organization
    try {
      const { name, description } = req.body

      if (!name || name.trim().length < 2) {
        return res.status(400).json({ error: 'Organization name is required (min 2 characters)' })
      }

      // Create organization
      const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          created_by_user_id: userId
        })
        .select()
        .single()

      if (orgError) throw orgError

      // Add creator as owner
      const { error: membershipError } = await supabase
        .from('organization_memberships')
        .insert({
          organization_id: organization.id,
          user_id: userId,
          role: 'owner'
        })

      if (membershipError) throw membershipError

      res.json({
        success: true,
        organization: {
          ...organization,
          user_role: 'owner'
        }
      })
    } catch (error) {
      console.error('Create organization error:', error)
      res.status(500).json({ error: 'Failed to create organization' })
    }
  }

  else {
    res.status(405).json({ error: 'Method not allowed' })
  }
})
