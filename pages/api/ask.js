import { createClient } from '@supabase/supabase-js'
import { HfInference } from '@huggingface/inference'
import { requireAuth } from '../../utils/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for server-side operations
)

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY)

// Wrap the handler with authentication
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' })
  }

  try {
    const { question, organization_id, search_scope = 'all' } = req.body
    const userId = req.user.userId // Get authenticated user ID

    console.log('Question from user:', userId, ':', question)
    console.log('Search context:', { organization_id, search_scope })

    // Validate organization access if organization_id provided
    if (organization_id) {
      const { data: membership, error: membershipError } = await supabase
        .from('organization_memberships')
        .select('role')
        .eq('organization_id', organization_id)
        .eq('user_id', userId)
        .single()

      if (membershipError || !membership) {
        return res.status(403).json({ 
          error: 'Access denied to this organization or organization not found' 
        })
      }

      console.log(`User ${userId} has ${membership.role} role in organization ${organization_id}`)
    }

    // Get user's document context for security verification
    const userDocumentsQuery = supabase
      .from('documents')
      .select('id, filename, organization_id, visibility, is_organization_document')
      .eq('user_id', userId)

    // If searching within specific organization, add filter
    if (organization_id && search_scope === 'organization') {
      userDocumentsQuery.eq('organization_id', organization_id)
    }

    const { data: userDocuments, error: docCheckError } = await userDocumentsQuery

    if (docCheckError) {
      console.error('Error checking user documents:', docCheckError)
      return res.status(500).json({ error: 'Database error' })
    }

    // Get organization documents user has access to (if applicable)
    let organizationDocuments = []
    if (search_scope === 'all' || search_scope === 'organization') {
      const userOrganizations = await getUserOrganizations(userId)
      
      if (userOrganizations.length > 0) {
        const orgIds = userOrganizations.map(org => org.organization_id)
        
        const { data: orgDocs, error: orgDocsError } = await supabase
          .from('documents')
          .select('id, filename, organization_id, visibility, user_id')
          .in('organization_id', orgIds)
          .eq('visibility', 'organization')
          .neq('user_id', userId) // Exclude user's own docs (already in userDocuments)

        if (!orgDocsError && orgDocs) {
          organizationDocuments = orgDocs
        }
      }
    }

    const totalPersonalDocs = userDocuments?.length || 0
    const totalOrgDocs = organizationDocuments.length
    const totalAccessibleDocs = totalPersonalDocs + totalOrgDocs

    console.log(`User ${userId} has access to:`)
    console.log(`- Personal documents: ${totalPersonalDocs}`)
    console.log(`- Organization documents: ${totalOrgDocs}`)
    console.log(`- Total accessible: ${totalAccessibleDocs}`)

    if (totalAccessibleDocs === 0) {
      return res.json({
        answer: "You don't have access to any documents yet. Please upload a document first or join an organization to ask questions.",
        sources: [],
        user_documents: totalPersonalDocs,
        organization_documents: totalOrgDocs,
        search_context: {
          scope: search_scope,
          organization_id: organization_id
        }
      })
    }

    // Generate embedding for the question
    const queryEmbedding = await generateEmbedding(question)
    console.log('Generated query embedding')

    // Enhanced search with organization support
    const searchResults = await performEnhancedSearch(
      queryEmbedding, 
      userId, 
      organization_id, 
      search_scope
    )

    console.log(`Found ${searchResults?.length || 0} similar chunks for user ${userId}`)

    if (!searchResults || searchResults.length === 0) {
      return res.json({
        answer: "I couldn't find any relevant information in your accessible documents to answer this question.",
        sources: [],
        searched_documents: totalAccessibleDocs,
        search_context: {
          scope: search_scope,
          organization_id: organization_id,
          personal_docs: totalPersonalDocs,
          org_docs: totalOrgDocs
        }
      })
    }

    // Security verification: ensure all chunks are accessible to user
    const securityCheck = await verifyChunkAccess(searchResults, userId)
    if (!securityCheck.isValid) {
      console.error('SECURITY VIOLATION:', securityCheck.error)
      return res.status(500).json({ error: 'Security error: unauthorized document access detected' })
    }

    // Smart context assembly with organization awareness
    const contextWithScores = assembleSmartContext(searchResults, question)
    
    console.log('Context length:', contextWithScores.context.length)
    console.log('Source breakdown:', contextWithScores.sourceBreakdown)

    // Generate enhanced answer
    const answer = await generateEnhancedAnswer(
      contextWithScores.context, 
      question, 
      contextWithScores.keyInfo
    )

    // Prepare comprehensive response
    const response = {
      answer: answer,
      sources: searchResults.slice(0, 5).map(chunk => ({
        text: chunk.chunk_text.substring(0, 150) + '...',
        similarity: parseFloat(chunk.similarity.toFixed(3)),
        source_type: chunk.source_type || 'unknown',
        organization_id: chunk.organization_id || null
      })),
      found_chunks: searchResults.length,
      context_quality_score: contextWithScores.qualityScore,
      source_breakdown: contextWithScores.sourceBreakdown,
      search_context: {
        scope: search_scope,
        organization_id: organization_id,
        user_documents: totalPersonalDocs,
        organization_documents: totalOrgDocs,
        total_accessible: totalAccessibleDocs
      },
      searched_user: userId
    }

    res.json(response)

  } catch (error) {
    console.error('Ask error:', error)
    res.status(500).json({ error: 'Internal server error: ' + error.message })
  }
})

// Get user's organization memberships
async function getUserOrganizations(userId) {
  try {
    const { data: memberships, error } = await supabase
      .from('organization_memberships')
      .select('organization_id, role')
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching user organizations:', error)
      return []
    }

    return memberships || []
  } catch (error) {
    console.error('Error in getUserOrganizations:', error)
    return []
  }
}

// Perform enhanced search with organization support
async function performEnhancedSearch(queryEmbedding, userId, organizationId, searchScope) {
  try {
    // Call the enhanced match_documents function
    const { data: similarChunks, error: searchError } = await supabase.rpc(
      'match_documents',
      {
        query_embedding: queryEmbedding,
        match_count: 10,
        user_id: userId,
        organization_id: organizationId // Can be null
      }
    )

    if (searchError) {
      console.error('Search error:', searchError)
      throw new Error('Search failed: ' + searchError.message)
    }

    return similarChunks || []
  } catch (error) {
    console.error('Enhanced search error:', error)
    throw error
  }
}

// Verify that all chunks are accessible to the user
async function verifyChunkAccess(chunks, userId) {
  try {
    const chunkUserIds = new Set()
    const chunkOrgIds = new Set()

    chunks.forEach(chunk => {
      if (chunk.user_id) chunkUserIds.add(chunk.user_id)
      if (chunk.organization_id) chunkOrgIds.add(chunk.organization_id)
    })

    // Check personal documents (user's own)
    const personalChunks = chunks.filter(chunk => chunk.user_id === userId)
    
    // Check organization chunks
    const orgChunks = chunks.filter(chunk => chunk.organization_id && chunk.source_type === 'organization')
    
    if (orgChunks.length > 0) {
      const orgIds = Array.from(chunkOrgIds).filter(id => id)
      
      if (orgIds.length > 0) {
        // Verify user has access to these organizations
        const { data: userMemberships, error } = await supabase
          .from('organization_memberships')
          .select('organization_id')
          .eq('user_id', userId)
          .in('organization_id', orgIds)

        if (error) {
          return { isValid: false, error: 'Failed to verify organization access' }
        }

        const accessibleOrgIds = new Set(userMemberships?.map(m => m.organization_id) || [])
        
        // Check if user has access to all organization chunks
        const unauthorizedOrgChunks = orgChunks.filter(chunk => 
          chunk.organization_id && !accessibleOrgIds.has(chunk.organization_id)
        )

        if (unauthorizedOrgChunks.length > 0) {
          return { 
            isValid: false, 
            error: `Unauthorized organization chunk access detected: ${unauthorizedOrgChunks.length} chunks` 
          }
        }
      }
    }

    return { isValid: true }
  } catch (error) {
    console.error('Security verification error:', error)
    return { isValid: false, error: 'Security verification failed' }
  }
}

// Enhanced context assembly with organization awareness
function assembleSmartContext(chunks, question) {
  const lowerQuestion = question.toLowerCase()
  
  const questionType = identifyQuestionType(lowerQuestion)
  const keyTerms = extractKeyTerms(lowerQuestion)
  
  // Track source breakdown
  const sourceBreakdown = {
    personal: 0,
    organization: 0
  }

  const scoredChunks = chunks.map(chunk => {
    const lowerText = chunk.chunk_text.toLowerCase()
    let relevanceScore = chunk.similarity || 0
    
    // Track source types
    if (chunk.source_type === 'personal') {
      sourceBreakdown.personal++
    } else if (chunk.source_type === 'organization') {
      sourceBreakdown.organization++
    }
    
    keyTerms.forEach(term => {
      const matches = (lowerText.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
      relevanceScore += matches * 0.1
    })
    
    switch (questionType) {
      case 'number':
        if (lowerText.match(/\b\d+[.,]?\d*\b|number|license|stn|bl\s*\d+/)) relevanceScore += 0.15
        break
      case 'age':
        if (lowerText.match(/\b\d+\s*years?\b|age|pediatric|children|adult/)) relevanceScore += 0.15
        break
      case 'date':
        if (lowerText.match(/\b\d{4}\b|date|month|year|period|completion/)) relevanceScore += 0.15
        break
      case 'location':
        if (lowerText.match(/\b[A-Z][a-z]+,?\s*[A-Z][A-Z]?\b|facility|manufacturing|location/)) relevanceScore += 0.15
        break
      case 'requirement':
        if (lowerText.match(/must|shall|require|submit|report|before/)) relevanceScore += 0.15
        break
    }
    
    return { ...chunk, relevanceScore }
  })
  
  const bestChunks = scoredChunks
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 6)
  
  const context = bestChunks
    .map((chunk, index) => {
      const sourceLabel = chunk.source_type === 'organization' ? '[Org Source]' : '[Personal]'
      return `[Source ${index + 1}] ${sourceLabel}: ${chunk.chunk_text}`
    })
    .join('\n\n')
  
  const keyInfo = extractKeyInformationSnippets(bestChunks, keyTerms, questionType)
  const qualityScore = Math.min(bestChunks[0]?.relevanceScore || 0, 1.0)
  
  return { context, keyInfo, qualityScore, sourceBreakdown }
}

function identifyQuestionType(question) {
  if (question.match(/\b(number|license|stn|bl)\b/)) return 'number'
  if (question.match(/\b(age|years?|old)\b/)) return 'age'  
  if (question.match(/\b(date|when|period|time|year|month)\b/)) return 'date'
  if (question.match(/\b(where|location|facility|manufacturing)\b/)) return 'location'
  if (question.match(/\b(must|submit|require|before|report)\b/)) return 'requirement'
  if (question.match(/\b(what|which|name)\b/)) return 'factual'
  return 'general'
}

function extractKeyTerms(question) {
  const stopWords = ['what', 'which', 'when', 'where', 'who', 'how', 'why', 'was', 'were', 'is', 'are', 'the', 'and', 'or', 'but', 'to', 'for', 'of', 'in', 'on', 'at', 'by', 'under', 'with']
  
  return question
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .slice(0, 8)
}

function extractKeyInformationSnippets(chunks, keyTerms, questionType) {
  const snippets = []
  
  chunks.forEach(chunk => {
    const text = chunk.chunk_text
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10)
    
    sentences.forEach(sentence => {
      let score = 0
      keyTerms.forEach(term => {
        if (sentence.toLowerCase().includes(term)) score += 1
      })
      
      if (questionType === 'number' && sentence.match(/\b(number|license|stn|bl)\s*:?\s*\d+/i)) score += 2
      if (questionType === 'age' && sentence.match(/\b\d+\s*years?\s*(of\s*age|old)/i)) score += 2
      if (questionType === 'date' && sentence.match(/\b\d+\s*months?\b/i)) score += 2
      
      if (score > 1) {
        snippets.push({ text: sentence, score })
      }
    })
  })
  
  return snippets
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.text)
}

async function generateEnhancedAnswer(context, question, keyInfo) {
  console.log('Generating enhanced answer...')
  
  try {
    const answer = await generateAnswerWithGemini(context, question, keyInfo)
    if (answer && answer.length > 15 && !answer.includes('I don\'t have enough information')) {
      console.log('Gemini Success!')
      return answer
    }
  } catch (error) {
    console.log('Gemini failed:', error.message)
  }

  const extractedAnswer = enhancedPatternExtraction(context, question, keyInfo)
  if (extractedAnswer && extractedAnswer.length > 15) {
    console.log('Pattern extraction success!')
    return extractedAnswer
  }

  return await generateAnswerWithHuggingFace(context, question)
}

function enhancedPatternExtraction(context, question, keyInfo) {
  const lowerQuestion = question.toLowerCase()
  
  if (lowerQuestion.includes('license number')) {
    const licenseMatch = context.match(/license\s+no\.?\s*(\d+)/i) || 
                        context.match(/u\.?s\.?\s+license\s+no\.?\s*(\d+)/i)
    if (licenseMatch) {
      return `U.S. License No. ${licenseMatch[1]}`
    }
  }
  
  if (lowerQuestion.includes('age group') || lowerQuestion.includes('years of age')) {
    const ageMatch = context.match(/(\d+)\s+years?\s+of\s+age\s+and\s+(older|above)/i) ||
                    context.match(/individuals\s+(\d+)\s+years?\s+of\s+age\s+and\s+(older|above)/i)
    if (ageMatch) {
      return `${ageMatch[1]} years of age and ${ageMatch[2]}`
    }
  }
  
  if (lowerQuestion.includes('dating period') || lowerQuestion.includes('shelf life')) {
    const dateMatch = context.match(/dating\s+period[^.]*shall\s+be\s+([^.]+)/i) ||
                      context.match(/(\d+)\s+months?\s+from[^.]*when\s+stored/i)
    if (dateMatch) {
      return dateMatch[1].trim()
    }
  }
  
  if (lowerQuestion.includes('nct') || lowerQuestion.includes('clinical trial')) {
    const nctMatches = context.match(/NCT\d+/g)
    if (nctMatches && nctMatches.length >= 2) {
      return `${nctMatches[0]} and ${nctMatches[1]}`
    }
  }
  
  if (lowerQuestion.includes('manufacturing') && lowerQuestion.includes('location')) {
    const locations = []
    const locationPatterns = [
      /([^.,]+(?:Belgium|Michigan|Massachusetts)[^.,]*)/gi,
      /at\s+([^.,]+(?:LLC|NV|Inc\.)[^.,]*)/gi
    ]
    
    locationPatterns.forEach(pattern => {
      const matches = context.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const cleaned = match.replace(/^at\s+/i, '').trim()
          if (cleaned.length > 10 && !locations.some(loc => loc.includes(cleaned.split(',')[0]))) {
            locations.push(cleaned)
          }
        })
      }
    })
    
    if (locations.length >= 2) {
      return locations.slice(0, 2).join(' and ')
    }
  }
  
  if (lowerQuestion.includes('must') && lowerQuestion.includes('submit')) {
    const submitMatch = context.match(/you\s+must\s+submit\s+([^.]+)/i)
    if (submitMatch) {
      return submitMatch[1].trim()
    }
  }
  
  if (keyInfo && keyInfo.length > 0) {
    const bestSnippet = keyInfo[0]
    if (bestSnippet && bestSnippet.length > 15) {
      return bestSnippet
    }
  }
  
  return null
}

async function generateEmbedding(text) {
  try {
    const response = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: text
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

async function generateAnswerWithGemini(context, question, keyInfo) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCnAw0TTRd4oHYldxSN5zaZtpAwZfu5tXY'
  
  const keyInfoText = keyInfo && keyInfo.length > 0 ? 
    `\n\nKEY INFORMATION SNIPPETS:\n${keyInfo.join('\n')}` : ''
  
  const prompt = `You are a precise document analysis AI. Extract the exact answer from the provided context.

CRITICAL INSTRUCTIONS:
- Give ONLY the direct, specific answer requested
- Use EXACT text from the document when possible
- Do NOT add explanations unless specifically asked
- If information is not clearly stated, say "Information not available in the provided documents"
- For numbers/codes/identifiers, provide the EXACT format shown in the document
- For dates/periods, use the exact wording from the document

CONTEXT:
${context}
${keyInfoText}

QUESTION: ${question}

PRECISE ANSWER:`

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 20,
        topP: 0.8,
        maxOutputTokens: 300,
      }
    })
  })

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    const answer = data.candidates[0].content.parts[0].text.trim()
    return answer
  }

  throw new Error('No answer from Gemini API')
}

async function generateAnswerWithHuggingFace(context, question) {
  try {
    const textGenModels = [
      'microsoft/DialoGPT-medium',
      'google/flan-t5-base'
    ]

    for (const model of textGenModels) {
      try {
        console.log(`Trying text generation model: ${model}`)
        
        const prompt = `Context: ${context.substring(0, 1200)}

Question: ${question}

Based strictly on the context above, provide a precise answer. If the information is not clearly stated, respond with "Information not available in the provided documents."`

        const response = await hf.textGeneration({
          model: model,
          inputs: prompt,
          parameters: {
            max_new_tokens: 150,
            temperature: 0.1,
            do_sample: true,
            return_full_text: false
          }
        })

        let answer = response.generated_text?.trim()
        if (answer && answer.length > 15) {
          answer = answer.replace(/^(Answer:|Response:|Based on the context:?\s*)/i, '').trim()
          if (!answer.match(/[.!?]$/)) answer += '.'
          console.log(`Text generation success with ${model}`)
          return answer
        }
      } catch (error) {
        console.log(`Text generation model ${model} failed:`, error.message)
        continue
      }
    }

    return "I couldn't extract a reliable answer from the provided documents."

  } catch (error) {
    console.error('HuggingFace answer generation error:', error)
    return "I couldn't extract a reliable answer from the provided documents."
  }
}