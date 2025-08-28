// pages/api/organizations/[orgId]/members.js - Member management API
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../../../../utils/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default requireAuth(async function handler(req, res) {
  const { orgId } = req.query
  const userId = req.user.userId

  if (!orgId) {
    return res.status(400).json({ error: 'Organization ID is required' })
  }

  // Verify user has admin/owner access to this organization
  const { data: membership, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .single()

  if (membershipError || !membership) {
    return res.status(403).json({ error: 'Access denied to this organization' })
  }

  if (!['owner', 'admin'].includes(membership.role)) {
    return res.status(403).json({ error: 'Only owners and admins can manage members' })
  }

  if (req.method === 'GET') {
    // Get organization members
    try {
      const { data: members, error } = await supabase
        .from('organization_memberships')
        .select(`
          user_id,
          role,
          joined_at,
          organizations!inner(
            id,
            name
          )
        `)
        .eq('organization_id', orgId)
        .order('joined_at', { ascending: true })

      if (error) throw error

      // Get user profiles from auth.users (requires service role key)
      const userIds = members.map(m => m.user_id)
      const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
      
      if (usersError) {
        console.error('Error fetching user profiles:', usersError)
      }

      // Combine member data with user profiles
      const membersWithProfiles = members.map(member => {
        const userProfile = users?.users?.find(u => u.id === member.user_id)
        return {
          user_id: member.user_id,
          email: userProfile?.email || 'Unknown',
          role: member.role,
          joined_at: member.joined_at,
          organization_name: member.organizations?.name
        }
      })

      res.json({
        members: membersWithProfiles,
        count: membersWithProfiles.length
      })
    } catch (error) {
      console.error('Get members error:', error)
      res.status(500).json({ error: 'Failed to fetch members' })
    }
  }

  else if (req.method === 'POST') {
    // Add new member by email
    try {
      const { email, role = 'member' } = req.body

      if (!email || !email.trim()) {
        return res.status(400).json({ error: 'Email is required' })
      }

      const emailLower = email.trim().toLowerCase()

      // Validate role
      if (!['member', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be member or admin' })
      }

      // Only owners can add admins
      if (role === 'admin' && membership.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can add admins' })
      }

      // Find user by email
      const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
      
      if (usersError) {
        console.error('Error searching users:', usersError)
        return res.status(500).json({ error: 'Failed to search for user' })
      }

      const targetUser = users.users?.find(u => u.email?.toLowerCase() === emailLower)
      
      if (!targetUser) {
        return res.status(404).json({ 
          error: 'User not found. The user must sign up first before being added to an organization.' 
        })
      }

      // Check if user is already a member
      const { data: existingMembership, error: checkError } = await supabase
        .from('organization_memberships')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', targetUser.id)
        .single()

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking existing membership:', checkError)
        return res.status(500).json({ error: 'Failed to check membership' })
      }

      if (existingMembership) {
        return res.status(400).json({ 
          error: `User is already a ${existingMembership.role} in this organization` 
        })
      }

      // Add user to organization
      const { data: newMembership, error: addError } = await supabase
        .from('organization_memberships')
        .insert({
          organization_id: orgId,
          user_id: targetUser.id,
          role: role
        })
        .select()
        .single()

      if (addError) {
        console.error('Error adding member:', addError)
        return res.status(500).json({ error: 'Failed to add member' })
      }

      // Get organization name for response
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single()

      res.json({
        success: true,
        message: `Successfully added ${emailLower} as ${role}`,
        member: {
          user_id: targetUser.id,
          email: targetUser.email,
          role: role,
          joined_at: newMembership.joined_at,
          organization_name: org?.name
        }
      })
    } catch (error) {
      console.error('Add member error:', error)
      res.status(500).json({ error: 'Failed to add member' })
    }
  }

  else if (req.method === 'DELETE') {
    // Remove member
    try {
      const { user_id: targetUserId } = req.body

      if (!targetUserId) {
        return res.status(400).json({ error: 'User ID is required' })
      }

      // Can't remove yourself
      if (targetUserId === userId) {
        return res.status(400).json({ error: 'Cannot remove yourself from organization' })
      }

      // Get target user's role
      const { data: targetMembership, error: targetError } = await supabase
        .from('organization_memberships')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', targetUserId)
        .single()

      if (targetError || !targetMembership) {
        return res.status(404).json({ error: 'Member not found in this organization' })
      }

      // Only owners can remove other owners
      if (targetMembership.role === 'owner' && membership.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can remove other owners' })
      }

      // Admins can only remove members
      if (membership.role === 'admin' && ['owner', 'admin'].includes(targetMembership.role)) {
        return res.status(403).json({ error: 'Admins can only remove members' })
      }

      // Remove the membership
      const { error: removeError } = await supabase
        .from('organization_memberships')
        .delete()
        .eq('organization_id', orgId)
        .eq('user_id', targetUserId)

      if (removeError) {
        console.error('Error removing member:', removeError)
        return res.status(500).json({ error: 'Failed to remove member' })
      }

      res.json({
        success: true,
        message: 'Member removed successfully'
      })
    } catch (error) {
      console.error('Remove member error:', error)
      res.status(500).json({ error: 'Failed to remove member' })
    }
  }

  else if (req.method === 'PUT') {
    // Update member role
    try {
      const { user_id: targetUserId, role: newRole } = req.body

      if (!targetUserId || !newRole) {
        return res.status(400).json({ error: 'User ID and role are required' })
      }

      // Validate new role
      if (!['member', 'admin', 'owner'].includes(newRole)) {
        return res.status(400).json({ error: 'Invalid role' })
      }

      // Can't change your own role
      if (targetUserId === userId) {
        return res.status(400).json({ error: 'Cannot change your own role' })
      }

      // Only owners can assign owner role
      if (newRole === 'owner' && membership.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can assign owner role' })
      }

      // Get current role of target user
      const { data: currentMembership, error: currentError } = await supabase
        .from('organization_memberships')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', targetUserId)
        .single()

      if (currentError || !currentMembership) {
        return res.status(404).json({ error: 'Member not found' })
      }

      // Only owners can change owner roles
      if (currentMembership.role === 'owner' && membership.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can change owner roles' })
      }

      // Update the role
      const { error: updateError } = await supabase
        .from('organization_memberships')
        .update({ role: newRole })
        .eq('organization_id', orgId)
        .eq('user_id', targetUserId)

      if (updateError) {
        console.error('Error updating member role:', updateError)
        return res.status(500).json({ error: 'Failed to update member role' })
      }

      res.json({
        success: true,
        message: `Member role updated to ${newRole}`
      })
    } catch (error) {
      console.error('Update member role error:', error)
      res.status(500).json({ error: 'Failed to update member role' })
    }
  }

  else {
    res.status(405).json({ error: 'Method not allowed' })
  }
})