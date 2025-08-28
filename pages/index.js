import { useState, useRef, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'your-supabase-url',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-supabase-anon-key'
)

export default function SecureRAGHome() {
  // Authentication state
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Organization state
  const [organizations, setOrganizations] = useState([])
  const [selectedOrganization, setSelectedOrganization] = useState(null)
  const [workingMode, setWorkingMode] = useState('personal')
  const [orgLoading, setOrgLoading] = useState(false)

  // Member management state
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('member')
  const [memberActionLoading, setMemberActionLoading] = useState(false)

  // Document upload state
  const [filename, setFilename] = useState('')
  const [content, setContent] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploadMode, setUploadMode] = useState('text')
  const [selectedFile, setSelectedFile] = useState(null)
  const [processingStats, setProcessingStats] = useState(null)
  const [documentVisibility, setDocumentVisibility] = useState('private')
  const [searchScope, setSearchScope] = useState('all')
  
  const fileInputRef = useRef(null)

  // Authentication effect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load organizations when user is authenticated
  useEffect(() => {
    if (user) {
      loadUserOrganizations()
    }
  }, [user])

  // Authentication functions
  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })
      if (error) throw error
    } catch (error) {
      alert('Error signing in: ' + error.message)
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // Clear local state
      setFilename('')
      setContent('')
      setQuestion('')
      setAnswer('')
      setSources([])
      setProcessingStats(null)
      setSelectedFile(null)
      setOrganizations([])
      setSelectedOrganization(null)
      setWorkingMode('personal')
    } catch (error) {
      alert('Error signing out: ' + error.message)
    }
  }

  // Organization functions
  const loadUserOrganizations = async () => {
    if (!session?.access_token) return
    
    setOrgLoading(true)
    try {
      const response = await fetch('/api/organizations', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setOrganizations(data.organizations || [])
      } else {
        console.error('Failed to load organizations')
      }
    } catch (error) {
      console.error('Error loading organizations:', error)
    }
    setOrgLoading(false)
  }

  const createOrganization = async () => {
    const name = prompt('Enter organization name:')
    if (!name || !name.trim()) return

    const description = prompt('Enter organization description (optional):') || ''

    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: name.trim(), description: description.trim() })
      })

      const result = await response.json()
      
      if (response.ok) {
        alert(`Organization "${name}" created successfully!`)
        await loadUserOrganizations()
      } else {
        alert('Error: ' + result.error)
      }
    } catch (error) {
      alert('Error creating organization: ' + error.message)
    }
  }

  const switchWorkingMode = (mode, orgId = null) => {
    setWorkingMode(mode)
    setSelectedOrganization(orgId)
    
    if (mode === 'organization') {
      setDocumentVisibility('organization')
      setSearchScope('all')
    } else {
      setDocumentVisibility('private')
      setSearchScope('all')
    }

    setAnswer('')
    setSources([])
    setProcessingStats(null)
  }

  // Member management functions
  const loadMembers = async (orgId) => {
    if (!session?.access_token || !orgId) return
    
    setMembersLoading(true)
    try {
      const response = await fetch(`/api/organizations/${orgId}/members`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setMembers(data.members || [])
      } else {
        console.error('Failed to load members')
        setMembers([])
      }
    } catch (error) {
      console.error('Error loading members:', error)
      setMembers([])
    }
    setMembersLoading(false)
  }

  const openMemberModal = async (orgId) => {
    setSelectedOrganization(orgId)
    setShowMemberModal(true)
    await loadMembers(orgId)
  }

  const addMember = async () => {
    if (!newMemberEmail.trim() || !selectedOrganization) return
    
    setMemberActionLoading(true)
    try {
      const response = await fetch(`/api/organizations/${selectedOrganization}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email: newMemberEmail.trim(), 
          role: newMemberRole 
        })
      })

      const result = await response.json()
      
      if (response.ok) {
        alert('Member added successfully!')
        setNewMemberEmail('')
        await loadMembers(selectedOrganization)
      } else {
        alert('Error: ' + result.error)
      }
    } catch (error) {
      alert('Error adding member: ' + error.message)
    }
    setMemberActionLoading(false)
  }

  const removeMember = async (userId, email) => {
    if (!confirm(`Remove ${email} from organization?`) || !selectedOrganization) return
    
    try {
      const response = await fetch(`/api/organizations/${selectedOrganization}/members`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
      })

      const result = await response.json()
      
      if (response.ok) {
        alert('Member removed successfully!')
        await loadMembers(selectedOrganization)
      } else {
        alert('Error: ' + result.error)
      }
    } catch (error) {
      alert('Error removing member: ' + error.message)
    }
  }

  // Document functions
  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      setSelectedFile(file)
      setFilename(file.name)
      setContent('')
    }
  }

  const saveDocument = async () => {
    if (!session) {
      alert('Please sign in to upload documents')
      return
    }

    if (uploadMode === 'file' && !selectedFile) {
      alert('Please select a file to upload')
      return
    }
    
    if (uploadMode === 'text' && !content.trim()) {
      alert('Please enter some content')
      return
    }

    if (workingMode === 'organization' && !selectedOrganization) {
      alert('Please select an organization first')
      return
    }

    setLoading(true)
    setProcessingStats(null)
    
    try {
      const formData = new FormData()
      
      if (uploadMode === 'file' && selectedFile) {
        formData.append('file', selectedFile)
      } else {
        formData.append('filename', filename || 'manual-input.txt')
        formData.append('content', content)
      }

      if (workingMode === 'organization' && selectedOrganization) {
        formData.append('organization_id', selectedOrganization)
        formData.append('visibility', documentVisibility)
      }

      const response = await fetch('/api/save', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      })

      const result = await response.json()
      
      if (!response.ok) {
        if (response.status === 401) {
          alert('Authentication expired. Please sign in again.')
          await signOut()
          return
        }
        throw new Error(result.error || 'Upload failed')
      }
      
      if (result.success) {
        setProcessingStats(result)
        alert('Document uploaded successfully!')
        
        setSelectedFile(null)
        setContent('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else {
        alert('Error: ' + result.error)
      }
    } catch (error) {
      alert('Error: ' + error.message)
    }
    setLoading(false)
  }

  const askQuestion = async () => {
    if (!session) {
      alert('Please sign in to ask questions')
      return
    }

    if (!question.trim()) {
      alert('Please enter a question')
      return
    }

    setLoading(true)
    try {
      const requestBody = {
        question,
        search_scope: searchScope
      }

      if (workingMode === 'organization' && selectedOrganization) {
        requestBody.organization_id = selectedOrganization
      }

      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      
      if (!response.ok) {
        if (response.status === 401) {
          alert('Authentication expired. Please sign in again.')
          await signOut()
          return
        }
        throw new Error(result.error || 'Query failed')
      }

      setAnswer(result.answer)
      setSources(result.sources || [])
      
    } catch (error) {
      alert('Error: ' + error.message)
    }
    setLoading(false)
  }

  // Helper functions
  const getCurrentUserRole = (orgId) => {
    const org = organizations.find(o => o.id === orgId)
    return org?.user_role || 'member'
  }

  const canManageMembers = (orgId) => {
    const role = getCurrentUserRole(orgId)
    return ['owner', 'admin'].includes(role)
  }

  // Loading screen
  if (authLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div>Loading...</div>
      </div>
    )
  }

  // Authentication screen
  if (!user) {
    return (
      <div style={{ 
        padding: '20px', 
        maxWidth: '400px', 
        margin: '100px auto', 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center'
      }}>
        <h1 style={{ marginBottom: '30px' }}>Enhanced RAG System</h1>
        <p style={{ marginBottom: '30px', color: '#666' }}>
          Please sign in to upload documents and ask questions
        </p>
        <button 
          onClick={signInWithGoogle}
          style={{ 
            padding: '12px 30px', 
            backgroundColor: '#4285f4', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Sign in with Google
        </button>
      </div>
    )
  }

  // Main application - matches demo exactly
  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header with user info */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div>
          <h1 style={{ margin: 0, color: '#333' }}>Enhanced RAG System</h1>
          <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
            Welcome, {user.email}
          </p>
        </div>
        <button 
          onClick={signOut}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#dc3545', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Sign Out
        </button>
      </div>
      
      {/* Working Mode Selection */}
      <div style={{ 
        marginBottom: '30px', 
        padding: '20px', 
        border: '2px solid #007bff', 
        borderRadius: '8px',
        backgroundColor: '#f0f8ff'
      }}>
        <h2 style={{ marginTop: 0, color: '#007bff' }}>Working Mode</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ marginRight: '20px', display: 'inline-flex', alignItems: 'center' }}>
            <input
              type="radio"
              name="workingMode"
              value="personal"
              checked={workingMode === 'personal'}
              onChange={(e) => switchWorkingMode(e.target.value)}
              style={{ marginRight: '8px' }}
            />
            <span style={{ fontWeight: workingMode === 'personal' ? 'bold' : 'normal' }}>
              Personal Mode
            </span>
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center' }}>
            <input
              type="radio"
              name="workingMode"
              value="organization"
              checked={workingMode === 'organization'}
              onChange={(e) => switchWorkingMode(e.target.value)}
              style={{ marginRight: '8px' }}
            />
            <span style={{ fontWeight: workingMode === 'organization' ? 'bold' : 'normal' }}>
              Organization Mode
            </span>
          </label>
        </div>

        {/* Organization Management */}
        {workingMode === 'organization' && (
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '15px' 
            }}>
              <h3 style={{ margin: 0, color: '#007bff' }}>Your Organizations</h3>
              <button
                onClick={createOrganization}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Create New Organization
              </button>
            </div>

            {orgLoading && <p style={{ color: '#666' }}>Loading organizations...</p>}
            
            {!orgLoading && organizations.length === 0 ? (
              <p style={{ color: '#666' }}>No organizations found. Create one to get started!</p>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {organizations.map(org => (
                  <div 
                    key={org.id}
                    style={{
                      padding: '15px',
                      border: selectedOrganization === org.id ? '2px solid #007bff' : '1px solid #ddd',
                      borderRadius: '6px',
                      backgroundColor: selectedOrganization === org.id ? '#e7f3ff' : 'white',
                      cursor: 'pointer'
                    }}
                    onClick={() => switchWorkingMode('organization', org.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: '0 0 5px 0', color: '#333' }}>{org.name}</h4>
                        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                          Role: {org.user_role} | {org.description || 'No description'}
                        </p>
                      </div>
                      <div>
                        {canManageMembers(org.id) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openMemberModal(org.id)
                            }}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#6c757d',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              marginRight: '10px'
                            }}
                          >
                            Manage Members
                          </button>
                        )}
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: selectedOrganization === org.id ? '#007bff' : '#6c757d',
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '12px'
                        }}>
                          {selectedOrganization === org.id ? 'Selected' : 'Click to Select'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Document Upload Section */}
      <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff' }}>
        <h2 style={{ marginTop: 0, color: '#333' }}>Upload Document</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ marginRight: '20px' }}>
            <input
              type="radio"
              value="text"
              checked={uploadMode === 'text'}
              onChange={(e) => setUploadMode(e.target.value)}
              style={{ marginRight: '8px' }}
            />
            Text Input
          </label>
          <label>
            <input
              type="radio"
              value="file"
              checked={uploadMode === 'file'}
              onChange={(e) => setUploadMode(e.target.value)}
              style={{ marginRight: '8px' }}
            />
            File Upload
          </label>
        </div>

        {uploadMode === 'text' && (
          <div>
            <input
              type="text"
              placeholder="Document filename (optional)"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '15px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
            <textarea
              placeholder="Paste or type your document content here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{
                width: '100%',
                minHeight: '200px',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
                fontFamily: 'monospace',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>
        )}

        {uploadMode === 'file' && (
          <div style={{
            border: '2px dashed #ddd',
            borderRadius: '8px',
            padding: '40px',
            textAlign: 'center',
            backgroundColor: '#fafafa'
          }}>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept=".pdf,.docx,.doc,.txt,.md,.csv,.xlsx,.xls"
              style={{ marginBottom: '15px' }}
            />
            <p style={{ margin: '10px 0', color: '#666' }}>
              {selectedFile ? `Selected: ${selectedFile.name}` : 'Choose a file or drag and drop'}
            </p>
            <p style={{ margin: 0, fontSize: '14px', color: '#999' }}>
              Supported: PDF, Word, Excel, CSV, TXT, MD (Max 10MB)
            </p>
          </div>
        )}

        {workingMode === 'organization' && selectedOrganization && (
          <div style={{ marginTop: '15px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
              Document Visibility:
            </label>
            <label style={{ marginRight: '20px' }}>
              <input
                type="radio"
                value="private"
                checked={documentVisibility === 'private'}
                onChange={(e) => setDocumentVisibility(e.target.value)}
                style={{ marginRight: '8px' }}
              />
              Private (only you)
            </label>
            <label>
              <input
                type="radio"
                value="organization"
                checked={documentVisibility === 'organization'}
                onChange={(e) => setDocumentVisibility(e.target.value)}
                style={{ marginRight: '8px' }}
              />
              Organization-wide
            </label>
          </div>
        )}

        <button
          onClick={saveDocument}
          disabled={loading || (uploadMode === 'text' && !content.trim()) || (uploadMode === 'file' && !selectedFile)}
          style={{
            marginTop: '15px',
            padding: '12px 24px',
            backgroundColor: loading ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px'
          }}
        >
          {loading ? 'Processing...' : 'Save Document'}
        </button>

        {processingStats && (
          <div style={{
            marginTop: '15px',
            padding: '15px',
            backgroundColor: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '4px',
            color: '#155724'
          }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Upload Complete!</h4>
            <p style={{ margin: '5px 0' }}>File: {processingStats.filename}</p>
            <p style={{ margin: '5px 0' }}>Chunks: {processingStats.processed_chunks}/{processingStats.total_chunks}</p>
            <p style={{ margin: '5px 0' }}>Processing: {processingStats.processing_rate}</p>
          </div>
        )}
      </div>

      {/* Question & Answer Section */}
      <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff' }}>
        <h2 style={{ marginTop: 0, color: '#333' }}>Ask Questions</h2>
        
        {workingMode === 'organization' && selectedOrganization && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
              Search Scope:
            </label>
            <label style={{ marginRight: '20px' }}>
              <input
                type="radio"
                value="all"
                checked={searchScope === 'all'}
                onChange={(e) => setSearchScope(e.target.value)}
                style={{ marginRight: '8px' }}
              />
              All accessible documents
            </label>
            <label>
              <input
                type="radio"
                value="organization"
                checked={searchScope === 'organization'}
                onChange={(e) => setSearchScope(e.target.value)}
                style={{ marginRight: '8px' }}
              />
              Organization documents only
            </label>
          </div>
        )}

        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Ask a question about your documents..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && askQuestion()}
            style={{
              flex: 1,
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px'
            }}
          />
          <button
            onClick={askQuestion}
            disabled={loading || !question.trim()}
            style={{
              padding: '12px 24px',
              backgroundColor: loading ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            {loading ? 'Searching...' : 'Ask'}
          </button>
        </div>

        {answer && (
          <div style={{
            padding: '20px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h3 style={{ marginTop: 0, color: '#495057' }}>Answer:</h3>
            <p style={{ margin: 0, lineHeight: 1.6, color: '#212529' }}>{answer}</p>
          </div>
        )}

        {sources.length > 0 && (
          <div>
            <h3 style={{ color: '#495057' }}>Sources:</h3>
            {sources.map((source, index) => (
              <div key={index} style={{
                padding: '15px',
                backgroundColor: '#ffffff',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                marginBottom: '10px'
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6c757d' }}>
                  Source {index + 1} • Similarity: {source.similarity} • Type: {source.source_type}
                </p>
                <p style={{ margin: 0, fontSize: '15px', color: '#495057' }}>{source.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Member Management Modal */}
      {showMemberModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#333' }}>Manage Members</h2>
              <button
                onClick={() => setShowMemberModal(false)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>

            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Add New Member</h3>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input
                  type="email"
                  placeholder="Email address"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  style={{
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={addMember}
                  disabled={memberActionLoading || !newMemberEmail.trim()}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {memberActionLoading ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>

            <h3>Current Members</h3>
            {membersLoading ? (
              <p>Loading members...</p>
            ) : (
              members.map(member => (
                <div key={member.user_id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '10px'
                }}>
                  <div>
                    <strong>{member.email}</strong>
                    <span style={{ marginLeft: '10px', color: '#666' }}>({member.role})</span>
                  </div>
                  <button
                    onClick={() => removeMember(member.user_id, member.email)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}