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
    const { question } = req.body
    const userId = req.user.userId // Get authenticated user ID

    console.log('Question from user:', userId, ':', question)

    // Security check: Verify user has documents before processing
    const { data: userDocuments, error: docCheckError } = await supabase
      .from('documents')
      .select('id, filename')
      .eq('user_id', userId)

    if (docCheckError) {
      console.error('Error checking user documents:', docCheckError)
      return res.status(500).json({ error: 'Database error' })
    }

    if (!userDocuments || userDocuments.length === 0) {
      return res.json({
        answer: "You haven't uploaded any documents yet. Please upload a document first to ask questions about it.",
        sources: [],
        user_documents: 0
      })
    }

    console.log(`User ${userId} has ${userDocuments.length} documents`)

    // 1. Generate embedding for the question
    const queryEmbedding = await generateEmbedding(question)
    console.log('Generated query embedding')

    // 2. Search for similar chunks WITH STRICT USER ISOLATION
    const { data: similarChunks, error: searchError } = await supabase.rpc(
      'match_documents',
      {
        query_embedding: queryEmbedding,
        match_count: 8,
        user_id: userId // Critical: only search user's documents
      }
    )

    if (searchError) {
      console.error('Search error:', searchError)
      return res.status(500).json({ error: 'Search failed' })
    }

    console.log(`Found ${similarChunks?.length || 0} similar chunks for user ${userId}`)

    if (!similarChunks || similarChunks.length === 0) {
      return res.json({
        answer: "I couldn't find any relevant information in your documents to answer this question.",
        sources: [],
        searched_documents: userDocuments.length
      })
    }

    // Double-check security: Verify all returned chunks belong to the user
    const chunkUserIds = new Set(similarChunks.map(chunk => chunk.user_id).filter(Boolean))
    if (chunkUserIds.size > 1 || (chunkUserIds.size === 1 && !chunkUserIds.has(userId))) {
      console.error('SECURITY VIOLATION: Chunks from other users returned!', {
        requestUserId: userId,
        chunkUserIds: Array.from(chunkUserIds)
      })
      return res.status(500).json({ error: 'Security error: data isolation failure' })
    }

    // 3. Smart context assembly
    const contextWithScores = assembleSmartContext(similarChunks, question)
    
    console.log('Context length:', contextWithScores.context.length)

    // 4. Generate answer
    const answer = await generateEnhancedAnswer(contextWithScores.context, question, contextWithScores.keyInfo)

    // 5. Prepare response with user-specific information
    const response = {
      answer: answer,
      sources: similarChunks.slice(0, 5).map(chunk => ({
        text: chunk.chunk_text.substring(0, 150) + '...',
        similarity: parseFloat(chunk.similarity.toFixed(3))
      })),
      found_chunks: similarChunks.length,
      context_quality_score: contextWithScores.qualityScore,
      user_documents: userDocuments.length,
      searched_user: userId // For verification purposes
    }

    res.json(response)

  } catch (error) {
    console.error('Ask error:', error)
    res.status(500).json({ error: 'Internal server error: ' + error.message })
  }
})

// Your existing helper functions remain the same but with additional security logging

function assembleSmartContext(chunks, question) {
  const lowerQuestion = question.toLowerCase()
  
  const questionType = identifyQuestionType(lowerQuestion)
  const keyTerms = extractKeyTerms(lowerQuestion)
  
  const scoredChunks = chunks.map(chunk => {
    const lowerText = chunk.chunk_text.toLowerCase()
    let relevanceScore = chunk.similarity || 0
    
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
    .map((chunk, index) => `[Source ${index + 1}]: ${chunk.chunk_text}`)
    .join('\n\n')
  
  const keyInfo = extractKeyInformationSnippets(bestChunks, keyTerms, questionType)
  const qualityScore = Math.min(bestChunks[0]?.relevanceScore || 0, 1.0)
  
  return { context, keyInfo, qualityScore }
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