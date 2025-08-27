import { createClient } from '@supabase/supabase-js'
import { HfInference } from '@huggingface/inference'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
// Fix the PDF parse import
import pdfParse from 'pdf-parse'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY)

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' })
  }

  try {
    const userId = 'test123' // Hardcoded for testing

    // Parse form data (handles both files and text)
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
      
      console.log('📄 Processing uploaded file:', filename)
      
      // Extract text based on file type
      content = await extractTextFromFile(uploadedFile.filepath, filename)
      
      // Clean up uploaded file
      fs.unlinkSync(uploadedFile.filepath)
    } 
    // Handle text input (backward compatibility)
    else if (fields.content && fields.content[0]) {
      filename = fields.filename?.[0] || 'manual-input.txt'
      content = fields.content[0]
      console.log('📝 Processing text input:', filename)
    } 
    else {
      return res.status(400).json({ error: 'No file or content provided' })
    }

    if (!content || content.trim().length < 10) {
      return res.status(400).json({ error: 'Document content is too short or empty' })
    }

    console.log(`📊 Content length: ${content.length} characters`)

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
    console.log(`🔪 Created ${chunks.length} chunks`)

    // 3. Generate embeddings for each chunk
    let processedChunks = 0
    const batchSize = 5 // Process in small batches to avoid rate limits

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      
      for (let j = 0; j < batch.length; j++) {
        try {
          const chunkIndex = i + j
          const chunk = batch[j]
          
          console.log(`🔢 Processing chunk ${chunkIndex + 1}/${chunks.length}`)
          
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
          
          // Small delay to respect rate limits
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
      processing_rate: `${Math.round((processedChunks / chunks.length) * 100)}%`
    })

  } catch (error) {
    console.error('Save error:', error)
    res.status(500).json({ error: 'Internal server error: ' + error.message })
  }
}

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
        // Fix: Use the default import directly
        const pdfData = await pdfParse(pdfBuffer)
        return pdfData.text
      
      case '.docx':
        const docxResult = await mammoth.extractRawText({ path: filePath })
        return docxResult.value
      
      case '.doc':
        // Note: .doc files are harder to parse, might need additional library
        const docResult = await mammoth.extractRawText({ path: filePath })
        return docResult.value
      
      case '.csv':
        return extractTextFromCSV(filePath)
      
      case '.xlsx':
      case '.xls':
        return extractTextFromExcel(filePath)
      
      default:
        // Try to read as plain text
        return fs.readFileSync(filePath, 'utf-8')
    }
  } catch (error) {
    console.error(`Error extracting text from ${ext} file:`, error)
    throw new Error(`Failed to process ${ext} file: ${error.message}`)
  }
}

// Extract text from CSV files
function extractTextFromCSV(filePath) {
  const csvContent = fs.readFileSync(filePath, 'utf-8')
  const lines = csvContent.split('\n')
  
  // Convert CSV to readable text format
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

// Extract text from Excel files
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

// Enhanced text chunking function
function chunkText(text, maxSize = 500, overlap = 50) {
  // Clean the text first
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // Split into sentences for better chunking
  const sentences = cleanedText
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  const chunks = []
  let currentChunk = ''

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]
    const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + sentence

    if (potentialChunk.length > maxSize && currentChunk) {
      // Add current chunk
      chunks.push(currentChunk.trim() + '.')
      
      // Start new chunk with overlap
      const words = currentChunk.split(' ')
      const overlapWords = words.slice(-Math.min(overlap / 5, words.length / 2))
      currentChunk = overlapWords.join(' ') + (overlapWords.length > 0 ? '. ' : '') + sentence
    } else {
      currentChunk = potentialChunk
    }
  }

  // Add the final chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim() + (currentChunk.endsWith('.') ? '' : '.'))
  }

  // Filter out chunks that are too small
  return chunks.filter(chunk => chunk.length >= 20)
}

// Generate embedding using HuggingFace
async function generateEmbedding(text) {
  try {
    const response = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: text.substring(0, 500) // Limit input length for the model
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