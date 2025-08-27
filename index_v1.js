import { useState } from 'react'

export default function Home() {
  const [filename, setFilename] = useState('test-doc.txt')
  const [content, setContent] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  const saveDocument = async () => {
    if (!content.trim()) {
      alert('Please enter some content')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content })
      })

      const result = await response.json()
      if (result.success) {
        alert(`Document saved! Processed ${result.processed_chunks} chunks`)
      } else {
        alert('Error: ' + result.error)
      }
    } catch (error) {
      alert('Error: ' + error.message)
    }
    setLoading(false)
  }

  const askQuestion = async () => {
    if (!question.trim()) {
      alert('Please enter a question')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      })

      const result = await response.json()
      setAnswer(result.answer)
    } catch (error) {
      alert('Error: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🤖 Minimal RAG System</h1>
      
      <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ccc' }}>
        <h2>📄 Save Document</h2>
        <input 
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="Filename"
          style={{ width: '100%', marginBottom: '10px', padding: '8px' }}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste your document content here..."
          style={{ width: '100%', height: '150px', padding: '8px' }}
        />
        <button 
          onClick={saveDocument} 
          disabled={loading}
          style={{ marginTop: '10px', padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          {loading ? 'Processing...' : 'Save Document'}
        </button>
      </div>

      <div style={{ padding: '20px', border: '1px solid #ccc' }}>
        <h2>❓ Ask Question</h2>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about your document..."
          style={{ width: '100%', marginBottom: '10px', padding: '8px' }}
        />
        <button 
          onClick={askQuestion}
          disabled={loading}
          style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          {loading ? 'Searching...' : 'Ask Question'}
        </button>

        {answer && (
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px' }}>
            <h3>Answer:</h3>
            <p>{answer}</p>
          </div>
        )}
      </div>
    </div>
  )
}
