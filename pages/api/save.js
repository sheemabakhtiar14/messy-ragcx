import { createClient } from '@supabase/supabase-js'
import { HfInference } from '@huggingface/inference'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import pdfParse from 'pdf-parse'
import { requireAuth } from '../../utils/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for server-side operations
)

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY)

export const config = {
  api: {
    bodyParser: false,
  },
}

// Wrap the handler with authentication
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' })
  }

  try {
    // Get authenticated user ID
    const userId = req.user.userId
    console.log('Processing document for user:', userId)

    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    })

    const [fields, files] = await form.parse(req)

    let filename, content

    // Handle file upload
    if (files.file && files.file[0]) {
      const uploadedFile = files.file[0]
      filename = uploadedFile.originalFilename
      
      console.log('Processing uploaded file:', filename)
      
      // Extract text based on file type
      content = await extractTextFromFile(uploadedFile.filepath, filename)
      
      // Clean up uploaded file
      fs.unlinkSync(uploadedFile.filepath)
    } 
    // Handle text input
    else if (fields.content && fields.content[0]) {
      filename = fields.filename?.[0] || 'manual-input.txt'
      content = fields.content[0]
      console.log('Processing text input:', filename)
    } 
    else {
      return res.status(400).json({ error: 'No file or content provided' })
    }

    if (!content || content.trim().length < 10) {
      return res.status(400).json({ error: 'Document content is too short or empty' })
    }

    console.log(`Content length: ${content.length} characters`)

    // 1. Check if user already has a document with same filename (optional security check)
    const { data: existingDocs, error: checkError } = await supabase
      .from('documents')
      .select('filename')
      .eq('user_id', userId)
      .eq('filename', filename)

    if (checkError) {
      console.error('Error checking existing documents:', checkError)
    }

    if (existingDocs && existingDocs.length > 0) {
      console.log(`Warning: User ${userId} already has a document named ${filename}`)
      // You might want to append timestamp or ask user to rename
      filename = `${path.parse(filename).name}_${Date.now()}${path.parse(filename).ext}`
    }

    // 2. Save document to database with user isolation
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: userId, // Use authenticated user ID
        filename: filename,
        content: content
      })
      .select()
      .single()

    if (docError) {
      console.error('Database error:', docError)
      return res.status(500).json({ error: 'Failed to save document' })
    }

    console.log('Document saved with ID:', document.id, 'for user:', userId)

    // 3. Split text into chunks
    const chunks = chunkText(content)
    console.log(`Created ${chunks.length} chunks`)

    // 4. Generate embeddings for each chunk with user isolation
    let processedChunks = 0
    const batchSize = 5

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      
      for (let j = 0; j < batch.length; j++) {
        try {
          const chunkIndex = i + j
          const chunk = batch[j]
          
          console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length}`)
          
          const embedding = await generateEmbedding(chunk)
          
          // Save chunk with BOTH document_id and user_id for double security
          const { error: chunkError } = await supabase
            .from('document_chunks')
            .insert({
              document_id: document.id,
              user_id: userId, // Critical: ensure user isolation
              chunk_text: chunk,
              embedding: embedding
            })

          if (!chunkError) {
            processedChunks++
          } else {
            console.error('Chunk error:', chunkError)
          }
          
          await new Promise(resolve => setTimeout(resolve, 100))
          
        } catch (error) {
          console.error(`Failed to process chunk ${i + j}:`, error.message)
        }
      }
    }

    res.json({
      success: true,
      message: 'Document processed successfully!',
      document_id: document.id,
      filename: filename,
      file_type: path.extname(filename).toLowerCase(),
      content_length: content.length,
      total_chunks: chunks.length,
      processed_chunks: processedChunks,
      processing_rate: `${Math.round((processedChunks / chunks.length) * 100)}%`,
      user_id: userId // Return for verification
    })

  } catch (error) {
    console.error('Save error:', error)
    res.status(500).json({ error: 'Internal server error: ' + error.message })
  }
})

// Extract text from different file types
async function extractTextFromFile(filePath, filename) {
  const ext = path.extname(filename).toLowerCase()
  
  try {
    switch (ext) {
      case '.txt':
      case '.md':
        return fs.readFileSync(filePath, 'utf-8')
      
      case '.pdf':
        const pdfBuffer = fs.readFileSync(filePath)
        const pdfData = await pdfParse(pdfBuffer)
        return pdfData.text
      
      case '.docx':
        const docxResult = await mammoth.extractRawText({ path: filePath })
        return docxResult.value
      
      case '.doc':
        const docResult = await mammoth.extractRawText({ path: filePath })
        return docResult.value
      
      case '.csv':
        return extractTextFromCSV(filePath)
      
      case '.xlsx':
      case '.xls':
        return extractTextFromExcel(filePath)
      
      default:
        return fs.readFileSync(filePath, 'utf-8')
    }
  } catch (error) {
    console.error(`Error extracting text from ${ext} file:`, error)
    throw new Error(`Failed to process ${ext} file: ${error.message}`)
  }
}

function extractTextFromCSV(filePath) {
  const csvContent = fs.readFileSync(filePath, 'utf-8')
  const lines = csvContent.split('\n')
  
  let text = 'CSV Data:\n\n'
  
  lines.forEach((line, index) => {
    if (line.trim()) {
      const cells = line.split(',').map(cell => cell.replace(/"/g, '').trim())
      if (index === 0) {
        text += 'Headers: ' + cells.join(', ') + '\n\n'
      } else {
        text += `Row ${index}: ` + cells.join(' | ') + '\n'
      }
    }
  })
  
  return text
}

function extractTextFromExcel(filePath) {
  const workbook = XLSX.readFile(filePath)
  let text = 'Excel Data:\n\n'
  
  workbook.SheetNames.forEach(sheetName => {
    text += `Sheet: ${sheetName}\n`
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    
    jsonData.forEach((row, index) => {
      if (row.length > 0) {
        text += `Row ${index + 1}: ` + row.join(' | ') + '\n'
      }
    })
    text += '\n'
  })
  
  return text
}

function chunkText(text, maxSize = 600, overlap = 100) {
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const sectionMarkers = [
    'LICENSING', 'MANUFACTURING LOCATIONS', 'DATING PERIOD', 
    'FDA LOT RELEASE', 'PEDIATRIC REQUIREMENTS', 'POSTMARKETING REQUIREMENTS',
    'BIOLOGICAL PRODUCT DEVIATIONS', 'LABELING', 'ADVERSE EVENT REPORTING'
  ]

  const chunks = []
  const paragraphs = cleanedText.split(/\n\s*\n/)

  for (let i = 0; i < paragraphs.length; i++) {
    let paragraph = paragraphs[i].trim()
    
    if (paragraph.length < 20) continue

    const hasImportantInfo = sectionMarkers.some(marker => 
      paragraph.toUpperCase().includes(marker)
    )

    const targetSize = hasImportantInfo ? maxSize * 1.2 : maxSize

    if (paragraph.length <= targetSize) {
      const prevContext = i > 0 && chunks.length > 0 ? 
        paragraphs[i-1].split(/[.!?]+/).slice(-2).join('. ') : ''
      
      if (prevContext && (paragraph.length + prevContext.length) < targetSize) {
        chunks.push((prevContext + '. ' + paragraph).trim())
      } else {
        chunks.push(paragraph)
      }
    } else {
      const sentences = paragraph
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0)

      let currentChunk = ''
      
      for (const sentence of sentences) {
        const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + sentence

        if (potentialChunk.length > targetSize && currentChunk) {
          chunks.push(currentChunk.trim() + '.')
          
          const words = sentence.split(' ')
          const contextWords = currentChunk.split(' ').slice(-Math.min(15, currentChunk.split(' ').length / 3))
          currentChunk = contextWords.join(' ') + '. ' + sentence
        } else {
          currentChunk = potentialChunk
        }
      }

      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim() + (currentChunk.endsWith('.') ? '' : '.'))
      }
    }
  }

  return chunks
    .filter(chunk => chunk.length >= 30)
    .map(chunk => {
      if (!chunk.match(/[.!?]$/)) chunk += '.'
      return chunk
    })
}

async function generateEmbedding(text) {
  try {
    const response = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: text.substring(0, 500)
    })
    
    if (Array.isArray(response) && Array.isArray(response[0])) {
      return response[0]
    }
    return response
  } catch (error) {
    console.error('Embedding error:', error)
    throw new Error('Failed to generate embedding')
  }
}