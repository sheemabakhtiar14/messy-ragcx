import { createClient } from '@supabase/supabase-js'
import { HfInference } from '@huggingface/inference'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'
import os from 'os' // Add this import
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
      uploadDir: os.tmpdir(), // Use system temp directory (cross-platform)
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    })

    const [fields, files] = await form.parse(req)

    let filename, content, organizationId, visibility

    // Extract organization context from form data
    organizationId = fields.organization_id?.[0] || null
    visibility = fields.visibility?.[0] || 'private'

    console.log('Upload context:', { organizationId, visibility })

    // Validate organization access if organization_id provided
    if (organizationId) {
      const { data: membership, error: membershipError } = await supabase
        .from('organization_memberships')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .single()

      if (membershipError || !membership) {
        return res.status(403).json({ 
          error: 'Access denied to this organization or organization not found' 
        })
      }

      console.log(`User ${userId} has ${membership.role} role in organization ${organizationId}`)
    }

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

    // Enhanced filename uniqueness check with organization context
    const baseQuery = supabase
      .from('documents')
      .select('filename')
      .eq('user_id', userId)
      .eq('filename', filename)

    // Check within organization scope if applicable
    if (organizationId) {
      baseQuery.eq('organization_id', organizationId)
    } else {
      baseQuery.is('organization_id', null)
    }

    const { data: existingDocs, error: checkError } = await baseQuery

    if (checkError) {
      console.error('Error checking existing documents:', checkError)
    }

    if (existingDocs && existingDocs.length > 0) {
      console.log(`Warning: Document with name ${filename} already exists in this context`)
      // Append timestamp to make unique
      const filenameParts = path.parse(filename)
      filename = `${filenameParts.name}_${Date.now()}${filenameParts.ext}`
    }

    // Prepare document data with organization support
    const documentData = {
      user_id: userId,
      filename: filename,
      content: content,
      organization_id: organizationId,
      visibility: organizationId ? visibility : 'private', // Force private for personal docs
      is_organization_document: !!organizationId
    }

    console.log('Saving document with data:', {
      user_id: userId,
      filename,
      organization_id: organizationId,
      visibility: documentData.visibility,
      is_organization_document: documentData.is_organization_document
    })

    // Save document to database with organization support
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert(documentData)
      .select()
      .single()

    if (docError) {
      console.error('Database error:', docError)
      return res.status(500).json({ error: 'Failed to save document: ' + docError.message })
    }

    console.log('Document saved with ID:', document.id, 'for user:', userId, 'in organization:', organizationId)

    // OPTIMIZED CHUNKING: Split text into chunks with filename awareness
    const chunks = chunkText(content, filename)
    console.log(`Created ${chunks.length} chunks (optimized chunking system)`)

    // Generate embeddings for each chunk with organization support
    let processedChunks = 0
    const batchSize = 5

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      
      for (let j = 0; j < batch.length; j++) {
        try {
          const chunkIndex = i + j
          const chunk = batch[j]
          
          console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} chars)`)
          
          const embedding = await generateEmbedding(chunk)
          
          // Save chunk with organization context
          const chunkData = {
            document_id: document.id,
            user_id: userId,
            organization_id: organizationId, // Important: maintain organization context
            chunk_text: chunk,
            embedding: embedding
          }

          const { error: chunkError } = await supabase
            .from('document_chunks')
            .insert(chunkData)

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

    // Calculate average chunk size for response
    const avgChunkSize = chunks.length > 0 ? 
      Math.round(chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length) : 0

    // Prepare response with organization context
    const response = {
      success: true,
      message: 'Document processed successfully with optimized chunking!',
      document_id: document.id,
      filename: filename,
      file_type: path.extname(filename).toLowerCase(),
      content_length: content.length,
      total_chunks: chunks.length,
      processed_chunks: processedChunks,
      average_chunk_size: avgChunkSize,
      processing_rate: `${Math.round((processedChunks / chunks.length) * 100)}%`,
      user_id: userId,
      organization_id: organizationId,
      visibility: document.visibility,
      is_organization_document: document.is_organization_document,
      context: organizationId ? 'organization' : 'personal',
      chunking_method: getDocumentType(filename)
    }

    console.log('Upload complete:', response.context, 'mode - Chunks:', chunks.length, 'Avg size:', avgChunkSize)
    res.json(response)

  } catch (error) {
    console.error('Save error:', error)
    res.status(500).json({ error: 'Internal server error: ' + error.message })
  }
})

// Extract text from different file types (unchanged from original)
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

// ====================================================================
// OPTIMIZED CHUNKING SYSTEM - REPLACES ORIGINAL chunkText FUNCTION
// ====================================================================

/**
 * Main chunking function with document type awareness
 * @param {string} text - Document content
 * @param {string} filename - File name to determine document type
 * @param {number} maxSize - Maximum chunk size in characters (default: 1200)
 * @param {number} overlapPercentage - Overlap percentage (default: 15)
 * @returns {Array<string>} Array of text chunks
 */
function chunkText(text, filename = '', maxSize = 1200, overlapPercentage = 15) {
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Determine document type for specialized chunking
  const fileType = getDocumentType(filename)
  
  console.log(`Chunking ${fileType} document: ${filename}`)
  console.log(`Content length: ${cleanedText.length} characters`)
  
  let chunks = []
  
  switch (fileType) {
    case 'structured':
      chunks = chunkStructuredDocument(cleanedText, maxSize, overlapPercentage)
      break
    case 'technical':
      chunks = chunkTechnicalDocument(cleanedText, maxSize, overlapPercentage)
      break
    case 'spreadsheet':
      chunks = chunkSpreadsheetData(cleanedText, maxSize)
      break
    default:
      chunks = chunkGenericDocument(cleanedText, maxSize, overlapPercentage)
  }
  
  const filteredChunks = chunks.filter(chunk => chunk.length >= 50)
  console.log(`Created ${filteredChunks.length} chunks (avg ${Math.round(filteredChunks.reduce((sum, chunk) => sum + chunk.length, 0) / filteredChunks.length)} chars per chunk)`)
  
  return filteredChunks
}

/**
 * Determine document type based on filename and content patterns
 */
function getDocumentType(filename) {
  const ext = filename.toLowerCase().split('.').pop()
  
  if (['csv', 'xlsx', 'xls'].includes(ext)) {
    return 'spreadsheet'
  }
  
  if (['pdf', 'docx', 'doc'].includes(ext)) {
    return 'structured'
  }
  
  if (filename.toLowerCase().includes('technical') || 
      filename.toLowerCase().includes('manual') ||
      filename.toLowerCase().includes('spec')) {
    return 'technical'
  }
  
  return 'generic'
}

/**
 * Chunk structured documents (PDFs, Word docs) with section awareness
 */
function chunkStructuredDocument(text, maxSize, overlapPercentage) {
  const overlap = Math.floor(maxSize * (overlapPercentage / 100))
  
  // Enhanced section markers for better document structure recognition
  const sectionMarkers = [
    // Regulatory/FDA document markers
    'LICENSING', 'MANUFACTURING LOCATIONS', 'DATING PERIOD', 
    'FDA LOT RELEASE', 'PEDIATRIC REQUIREMENTS', 'POSTMARKETING REQUIREMENTS',
    'BIOLOGICAL PRODUCT DEVIATIONS', 'LABELING', 'ADVERSE EVENT REPORTING',
    
    // General document markers
    'SUMMARY', 'INTRODUCTION', 'BACKGROUND', 'METHODOLOGY', 'RESULTS', 
    'CONCLUSION', 'REFERENCES', 'APPENDIX', 'ABSTRACT',
    
    // Numbered sections
    /^\d+\.\s+[A-Z]/,  // 1. SECTION
    /^[A-Z]+\s+\d+/,   // SECTION 1
    /^[IVX]+\.\s+[A-Z]/ // I. SECTION
  ]
  
  // Split into logical sections first
  const sections = identifyDocumentSections(text, sectionMarkers)
  
  const chunks = []
  let previousChunkEnd = ''
  
  for (const section of sections) {
    if (section.length <= maxSize) {
      // Small section - add with context from previous chunk
      const contextualChunk = addContextualOverlap(section, previousChunkEnd, overlap)
      chunks.push(contextualChunk)
      previousChunkEnd = section.slice(-overlap)
    } else {
      // Large section - split semantically
      const sectionChunks = splitLargeSection(section, maxSize, overlap, previousChunkEnd)
      chunks.push(...sectionChunks)
      previousChunkEnd = section.slice(-overlap)
    }
  }
  
  return chunks
}

/**
 * Chunk technical documents with special handling for lists, procedures, and specifications
 */
function chunkTechnicalDocument(text, maxSize, overlapPercentage) {
  const overlap = Math.floor(maxSize * (overlapPercentage / 100))
  
  // Technical document patterns
  const technicalMarkers = [
    /^\d+\.\d+\.?\s+/,    // 1.1. numbered procedures
    /^Step \d+:/i,         // Step 1:
    /^Procedure:/i,        // Procedure:
    /^Note:/i,            // Note:
    /^Warning:/i,         // Warning:
    /^Caution:/i,         // Caution:
    /^Specification:/i    // Specification:
  ]
  
  const chunks = []
  const paragraphs = text.split(/\n\s*\n/)
  
  let currentChunk = ''
  let previousContext = ''
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim()
    
    if (paragraph.length < 20) continue
    
    // Check if this is a technical marker that should start a new chunk
    const isTechnicalBreak = technicalMarkers.some(marker => 
      typeof marker === 'object' ? marker.test(paragraph) : paragraph.includes(marker)
    )
    
    const potentialChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph
    
    if (potentialChunk.length > maxSize || (isTechnicalBreak && currentChunk.length > maxSize * 0.6)) {
      if (currentChunk) {
        const contextualChunk = previousContext + currentChunk
        chunks.push(contextualChunk.trim())
        previousContext = currentChunk.slice(-overlap) + '\n\n'
      }
      currentChunk = paragraph
    } else {
      currentChunk = potentialChunk
    }
  }
  
  if (currentChunk) {
    chunks.push((previousContext + currentChunk).trim())
  }
  
  return chunks
}

/**
 * Chunk spreadsheet data with table structure preservation
 */
function chunkSpreadsheetData(text, maxSize) {
  const lines = text.split('\n')
  const chunks = []
  
  let currentChunk = ''
  let headers = ''
  
  // Find headers (usually first few lines)
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    if (lines[i].includes('Headers:') || lines[i].includes('Row 1:') || lines[i].includes('Sheet:')) {
      headers += lines[i] + '\n'
    }
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (!line) continue
    
    const potentialChunk = currentChunk + (currentChunk ? '\n' : '') + line
    
    if (potentialChunk.length > maxSize) {
      if (currentChunk) {
        // Include headers with each chunk for context
        chunks.push(headers + currentChunk)
        currentChunk = line
      } else {
        // Single line too long - include as is
        chunks.push(headers + line)
      }
    } else {
      currentChunk = potentialChunk
    }
  }
  
  if (currentChunk) {
    chunks.push(headers + currentChunk)
  }
  
  return chunks
}

/**
 * Generic document chunking with sentence and paragraph awareness
 */
function chunkGenericDocument(text, maxSize, overlapPercentage) {
  const overlap = Math.floor(maxSize * (overlapPercentage / 100))
  const chunks = []
  
  // Split by paragraphs first
  const paragraphs = text.split(/\n\s*\n/)
  
  let currentChunk = ''
  let previousOverlap = ''
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim()
    
    if (trimmedParagraph.length < 20) continue
    
    const potentialChunk = currentChunk + (currentChunk ? '\n\n' : '') + trimmedParagraph
    
    if (potentialChunk.length <= maxSize) {
      currentChunk = potentialChunk
    } else {
      // Current chunk is full
      if (currentChunk) {
        const finalChunk = previousOverlap + currentChunk
        chunks.push(finalChunk.trim())
        
        // Create overlap for next chunk
        previousOverlap = extractMeaningfulOverlap(currentChunk, overlap)
      }
      
      // Handle large paragraphs that exceed maxSize
      if (trimmedParagraph.length > maxSize) {
        const subChunks = splitLargeParagraph(trimmedParagraph, maxSize, overlap)
        
        // Add first subchunk with current overlap
        if (subChunks.length > 0) {
          chunks.push((previousOverlap + subChunks[0]).trim())
          
          // Add remaining subchunks
          for (let i = 1; i < subChunks.length; i++) {
            chunks.push(subChunks[i])
          }
          
          // Update overlap from last subchunk
          previousOverlap = extractMeaningfulOverlap(subChunks[subChunks.length - 1], overlap)
        }
        currentChunk = ''
      } else {
        currentChunk = trimmedParagraph
      }
    }
  }
  
  // Add final chunk
  if (currentChunk) {
    chunks.push((previousOverlap + currentChunk).trim())
  }
  
  return chunks
}

// Helper functions for the optimized chunking system

function identifyDocumentSections(text, markers) {
  const lines = text.split('\n')
  const sections = []
  let currentSection = ''
  
  for (const line of lines) {
    const isMarker = markers.some(marker => {
      if (typeof marker === 'string') {
        return line.toUpperCase().includes(marker)
      } else if (marker instanceof RegExp) {
        return marker.test(line.trim())
      }
      return false
    })
    
    if (isMarker && currentSection.length > 100) {
      sections.push(currentSection.trim())
      currentSection = line
    } else {
      currentSection += (currentSection ? '\n' : '') + line
    }
  }
  
  if (currentSection.trim()) {
    sections.push(currentSection.trim())
  }
  
  return sections.filter(section => section.length > 50)
}

function splitLargeSection(section, maxSize, overlap, previousContext) {
  const chunks = []
  const sentences = section.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0)
  
  let currentChunk = previousContext ? previousContext.slice(-overlap) : ''
  
  for (const sentence of sentences) {
    const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + sentence
    
    if (potentialChunk.length > maxSize && currentChunk) {
      chunks.push(currentChunk.trim() + '.')
      currentChunk = sentence
    } else {
      currentChunk = potentialChunk
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim() + '.')
  }
  
  return chunks
}

function addContextualOverlap(content, previousEnd, overlapSize) {
  if (!previousEnd || previousEnd.length < 20) {
    return content
  }
  
  const contextualOverlap = previousEnd.slice(-Math.min(overlapSize, previousEnd.length))
  return contextualOverlap + '\n\n' + content
}

function extractMeaningfulOverlap(text, targetSize) {
  if (text.length <= targetSize) return text
  
  const words = text.split(' ')
  const targetWords = Math.floor(words.length * (targetSize / text.length))
  
  let overlap = words.slice(-targetWords).join(' ')
  const lastSentenceEnd = Math.max(
    overlap.lastIndexOf('.'),
    overlap.lastIndexOf('!'),
    overlap.lastIndexOf('?')
  )
  
  if (lastSentenceEnd > overlap.length * 0.5) {
    overlap = overlap.substring(lastSentenceEnd + 1).trim()
  }
  
  return overlap
}

function splitLargeParagraph(paragraph, maxSize, overlap) {
  const sentences = paragraph.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0)
  const chunks = []
  
  let currentChunk = ''
  
  for (const sentence of sentences) {
    const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + sentence
    
    if (potentialChunk.length > maxSize && currentChunk) {
      chunks.push(currentChunk.trim() + '.')
      
      const words = currentChunk.split(' ')
      const overlapWords = words.slice(-Math.floor(overlap / 6))
      currentChunk = overlapWords.join(' ') + '. ' + sentence
    } else {
      currentChunk = potentialChunk
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim() + (currentChunk.endsWith('.') ? '' : '.'))
  }
  
  return chunks
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
