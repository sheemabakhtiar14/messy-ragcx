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
  
  const fileInputRef = useRef(null)

  // Authentication effect
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

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
    } catch (error) {
      alert('Error signing out: ' + error.message)
    }
  }

  // Get auth headers for API calls
  const getAuthHeaders = () => {
    if (!session?.access_token) return {}
    
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  }

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      setSelectedFile(file)
      setFilename(file.name)
      setContent('')
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
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
        alert(`Document saved successfully!\n\nFile: ${result.filename}\nChunks: ${result.processed_chunks}/${result.total_chunks}\nProcessing: ${result.processing_rate}`)
        
        // Clear form
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
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ question })
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

  const getSupportedFormats = () => {
    return [
      { ext: '.pdf', desc: 'PDF Documents' },
      { ext: '.docx', desc: 'Word Documents' },
      { ext: '.doc', desc: 'Legacy Word Documents' },
      { ext: '.txt', desc: 'Plain Text' },
      { ext: '.md', desc: 'Markdown Files' },
      { ext: '.csv', desc: 'CSV Files' },
      { ext: '.xlsx', desc: 'Excel Files' },
      { ext: '.xls', desc: 'Legacy Excel Files' }
    ]
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

  // Main application
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
      
      {/* Document Upload Section */}
      <div style={{ 
        marginBottom: '30px', 
        padding: '25px', 
        border: '2px solid #e1e5e9', 
        borderRadius: '8px',
        backgroundColor: '#f8f9fa'
      }}>
        <h2 style={{ marginTop: 0, color: '#495057' }}>📄 Save Document</h2>
        
        {/* Mode Toggle */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ marginRight: '15px', fontWeight: 'bold' }}>Input Method:</label>
          <label style={{ marginRight: '15px' }}>
            <input
              type="radio"
              name="mode"
              value="file"
              checked={uploadMode === 'file'}
              onChange={(e) => setUploadMode(e.target.value)}
              style={{ marginRight: '5px' }}
            />
            Upload File
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              value="text"
              checked={uploadMode === 'text'}
              onChange={(e) => setUploadMode(e.target.value)}
              style={{ marginRight: '5px' }}
            />
            Paste Text
          </label>
        </div>

        {/* File Upload Mode */}
        {uploadMode === 'file' && (
          <div>
            <div 
              style={{
                border: '2px dashed #6c757d',
                borderRadius: '8px',
                padding: '40px',
                textAlign: 'center',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                marginBottom: '15px'
              }}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>📁</div>
              <p style={{ margin: '10px 0', fontSize: '16px', color: '#6c757d' }}>
                {selectedFile ? `Selected: ${selectedFile.name}` : 'Drag & drop your file here or click to browse'}
              </p>
              <p style={{ margin: '5px 0', fontSize: '14px', color: '#868e96' }}>
                Maximum file size: 10MB
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept=".pdf,.docx,.doc,.txt,.md,.csv,.xlsx,.xls"
              style={{ display: 'none' }}
            />

            <div style={{ marginBottom: '15px' }}>
              <details style={{ fontSize: '14px' }}>
                <summary style={{ cursor: 'pointer', color: '#007bff', marginBottom: '10px' }}>
                  Supported File Formats
                </summary>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '5px', marginLeft: '20px' }}>
                  {getSupportedFormats().map((format, index) => (
                    <div key={index} style={{ padding: '5px 0' }}>
                      <strong>{format.ext}</strong> - {format.desc}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        )}

        {/* Text Input Mode */}
        {uploadMode === 'text' && (
          <div>
            <input 
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Filename (e.g., my-document.txt)"
              style={{ 
                width: '100%', 
                marginBottom: '15px', 
                padding: '12px', 
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your document content here..."
              style={{ 
                width: '100%', 
                height: '200px', 
                padding: '12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
            />
          </div>
        )}

        <button 
          onClick={saveDocument} 
          disabled={loading}
          style={{ 
            marginTop: '15px', 
            padding: '12px 30px', 
            backgroundColor: loading ? '#6c757d' : '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.3s ease'
          }}
        >
          {loading ? '🔄 Processing...' : '💾 Save Document'}
        </button>

        {processingStats && (
          <div style={{ 
            marginTop: '15px', 
            padding: '15px', 
            backgroundColor: '#d4edda', 
            border: '1px solid #c3e6cb',
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            <strong>✅ Processing Complete:</strong><br/>
            File: {processingStats.filename} ({processingStats.file_type})<br/>
            Content: {processingStats.content_length} characters<br/>
            Chunks: {processingStats.processed_chunks}/{processingStats.total_chunks} ({processingStats.processing_rate})
          </div>
        )}
      </div>

      {/* Question Section */}
      <div style={{ 
        padding: '25px', 
        border: '2px solid #e1e5e9', 
        borderRadius: '8px',
        backgroundColor: '#ffffff'
      }}>
        <h2 style={{ marginTop: 0, color: '#495057' }}>❓ Ask Question</h2>
        
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about your document..."
          style={{ 
            width: '100%', 
            marginBottom: '15px', 
            padding: '12px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '16px'
          }}
          onKeyPress={(e) => e.key === 'Enter' && askQuestion()}
        />
        
        <button 
          onClick={askQuestion}
          disabled={loading}
          style={{ 
            padding: '12px 30px', 
            backgroundColor: loading ? '#6c757d' : '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.3s ease'
          }}
        >
          {loading ? '🔍 Searching...' : '🚀 Ask Question'}
        </button>

        {answer && (
          <div style={{ 
            marginTop: '25px', 
            padding: '20px', 
            backgroundColor: '#f8f9fa', 
            border: '1px solid #dee2e6', 
            borderRadius: '6px' 
          }}>
            <h3 style={{ marginTop: 0, color: '#495057', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>
              💡 Answer:
            </h3>
            <div style={{ 
              fontSize: '16px', 
              lineHeight: '1.6', 
              color: '#212529',
              whiteSpace: 'pre-wrap'
            }}>
              {answer}
            </div>
            
            {sources && sources.length > 0 && (
              <details style={{ marginTop: '20px', fontSize: '14px' }}>
                <summary style={{ cursor: 'pointer', color: '#007bff', fontWeight: 'bold' }}>
                  📚 Sources ({sources.length} chunks found)
                </summary>
                <div style={{ marginTop: '10px' }}>
                  {sources.map((source, index) => (
                    <div key={index} style={{ 
                      marginBottom: '10px', 
                      padding: '10px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e9ecef',
                      borderRadius: '4px'
                    }}>
                      <div style={{ fontWeight: 'bold', color: '#6c757d', marginBottom: '5px' }}>
                        Chunk {index + 1} (Similarity: {Math.round(source.similarity * 100)}%)
                      </div>
                      <div style={{ fontStyle: 'italic', color: '#6c757d' }}>
                        {source.text}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}