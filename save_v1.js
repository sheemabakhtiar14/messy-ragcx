import { createClient } from '@supabase/supabase-js'
import { HfInference } from '@huggingface/inference'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' })
  }

  try {
    const { filename, content } = req.body
    const userId = 'test123' // Hardcoded for testing

    console.log('💾 Saving document:', filename)

    // 1. Save document to database
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        filename: filename,
        content: content
      })
      .select()
      .single()

    if (docError) {
      console.error('Database error:', docError)
      return res.status(500).json({ error: 'Failed to save document' })
    }

    console.log('✅ Document saved with ID:', document.id)

    // 2. Split text into chunks
    const chunks = chunkText(content)
    console.log(`📝 Created ${chunks.length} chunks`)

    // 3. Generate embeddings for each chunk
    let processedChunks = 0
    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunk = chunks[i]
        console.log(`🔢 Processing chunk ${i + 1}/${chunks.length}`)
        
        // Generate embedding
        const embedding = await generateEmbedding(chunk)
        
        // Save chunk with embedding
        const { error: chunkError } = await supabase
          .from('document_chunks')
          .insert({
            document_id: document.id,
            user_id: userId,
            chunk_text: chunk,
            embedding: embedding
          })

        if (!chunkError) {
          processedChunks++
        } else {
          console.error('Chunk error:', chunkError)
        }
      } catch (error) {
        console.error(`Failed to process chunk ${i}:`, error.message)
      }
    }

    res.json({
      success: true,
      message: 'Document processed successfully!',
      document_id: document.id,
      filename: filename,
      total_chunks: chunks.length,
      processed_chunks: processedChunks
    })

  } catch (error) {
    console.error('Save error:', error)
    res.status(500).json({ error: 'Internal server error: ' + error.message })
  }
}

// Simple text chunking function
function chunkText(text, maxSize = 500) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const chunks = []
  let currentChunk = ''

  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if ((currentChunk + trimmed).length > maxSize && currentChunk) {
      chunks.push(currentChunk.trim())
      currentChunk = trimmed
    } else {
      currentChunk += (currentChunk ? '. ' : '') + trimmed
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter(chunk => chunk.length > 10)
}

// Generate embedding using HuggingFace
async function generateEmbedding(text) {
  try {
    const response = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: text
    })
    
    // Handle different response formats
    if (Array.isArray(response) && Array.isArray(response[0])) {
      return response[0] // 2D array
    }
    return response // 1D array
  } catch (error) {
    console.error('Embedding error:', error)
    throw new Error('Failed to generate embedding')
  }
}
