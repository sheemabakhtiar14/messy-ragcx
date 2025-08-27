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
    const { question } = req.body
    const userId = 'test123' // Hardcoded for testing

    console.log('❓ Question:', question)

    // 1. Generate embedding for the question
    const queryEmbedding = await generateEmbedding(question)
    console.log('🔢 Generated query embedding')

    // 2. Search for similar chunks (get more chunks for better context)
    const { data: similarChunks, error: searchError } = await supabase.rpc(
      'match_documents',
      {
        query_embedding: queryEmbedding,
        match_count: 5, // Increased from 3 to 5
        user_id: userId
      }
    )

    if (searchError) {
      console.error('Search error:', searchError)
      return res.status(500).json({ error: 'Search failed' })
    }

    console.log(`🔍 Found ${similarChunks?.length || 0} similar chunks`)

    if (!similarChunks || similarChunks.length === 0) {
      return res.json({
        answer: "I couldn't find any relevant information in your documents to answer this question.",
        sources: []
      })
    }

    // 3. Combine chunks as context (with better formatting)
    const context = similarChunks
      .map((chunk, index) => `[Context ${index + 1}]: ${chunk.chunk_text}`)
      .join('\n\n')

    console.log('📝 Context length:', context.length)

    // 4. Generate answer using Gemini API (primary) with HuggingFace fallback
    const answer = await generateAnswer(context, question)

    res.json({
      answer: answer,
      sources: similarChunks.map(chunk => ({
        text: chunk.chunk_text.substring(0, 150) + '...',
        similarity: parseFloat(chunk.similarity.toFixed(3))
      })),
      found_chunks: similarChunks.length
    })

  } catch (error) {
    console.error('Ask error:', error)
    res.status(500).json({ error: 'Internal server error: ' + error.message })
  }
}

// Generate embedding (same as save.js)
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

// Enhanced answer generation with Gemini API
async function generateAnswer(context, question) {
  // PRIMARY: Try Gemini API first
  try {
    console.log('🤖 Trying Gemini API...')
    const answer = await generateAnswerWithGemini(context, question)
    if (answer && answer.length > 10) {
      console.log('✅ Gemini Success!')
      return answer
    }
  } catch (error) {
    console.log('⚠️ Gemini failed, trying fallback:', error.message)
  }

  // FALLBACK: Use HuggingFace models
  return await generateAnswerWithHuggingFace(context, question)
}

// Generate answer using Gemini API
async function generateAnswerWithGemini(context, question) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCnAw0TTRd4oHYldxSN5zaZtpAwZfu5tXY'
  
  const prompt = `You are a helpful AI assistant that answers questions based ONLY on the provided context. 

INSTRUCTIONS:
- Answer the question using ONLY the information from the context below
- If the answer is not in the context, say "I don't have enough information to answer this question based on the provided documents."
- Provide a complete, detailed answer when the information is available
- Be specific and include relevant details from the context
- Do not add information that's not in the context

CONTEXT:
${context}

QUESTION: ${question}

ANSWER:`

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
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 500,
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

// Fallback: Generate answer using HuggingFace models (improved)
async function generateAnswerWithHuggingFace(context, question) {
  try {
    // Try text generation models first (better than Q&A for full responses)
    const textGenModels = [
      'microsoft/DialoGPT-medium',
      'google/flan-t5-base',
      'facebook/blenderbot-400M-distill'
    ]

    for (const model of textGenModels) {
      try {
        console.log(`🤖 Trying text generation model: ${model}`)
        
        const prompt = `Context: ${context.substring(0, 1000)}

Question: ${question}

Based on the context above, provide a detailed answer. If the information is not in the context, say "Information not available in the provided documents."`

        const response = await hf.textGeneration({
          model: model,
          inputs: prompt,
          parameters: {
            max_new_tokens: 200,
            temperature: 0.2,
            do_sample: true,
            return_full_text: false
          }
        })

        let answer = response.generated_text?.trim()
        if (answer && answer.length > 15) {
          // Clean up the answer
          answer = cleanGeneratedAnswer(answer)
          if (answer.length > 15) {
            console.log(`✅ Text generation success with ${model}`)
            return answer
          }
        }
      } catch (error) {
        console.log(`❌ Text generation model ${model} failed:`, error.message)
        continue
      }
    }

    // Final fallback: Enhanced smart extraction
    console.log('🔄 Using enhanced smart extraction...')
    return extractEnhancedAnswer(context, question)

  } catch (error) {
    console.error('HuggingFace answer generation error:', error)
    return extractEnhancedAnswer(context, question)
  }
}

// Clean and improve generated answers
function cleanGeneratedAnswer(answer) {
  // Remove common AI prefixes and clean up
  answer = answer
    .replace(/^(Answer:|Response:|Based on the context:?\s*)/i, '')
    .replace(/\n+/g, ' ')
    .trim()

  // Ensure it ends with proper punctuation
  if (answer && !answer.match(/[.!?]$/)) {
    answer += '.'
  }

  return answer
}

// Enhanced smart answer extraction (much improved)
function extractEnhancedAnswer(context, question) {
  console.log('🔍 Extracting enhanced answer...')
  
  const lowerQuestion = question.toLowerCase()
  const lowerContext = context.toLowerCase()
  
  // Extract key question words
  const stopWords = ['what', 'when', 'where', 'who', 'how', 'why', 'did', 'was', 'were', 'is', 'are', 'the', 'and', 'or', 'but', 'to', 'for', 'of', 'in', 'on', 'at', 'by']
  const questionKeywords = lowerQuestion.split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .slice(0, 5) // Limit to top 5 keywords

  console.log('🔑 Question keywords:', questionKeywords)

  // Split into sentences and score them
  const sentences = context.split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20) // Longer sentences are usually more informative

  // Advanced scoring system
  const scoredSentences = sentences.map(sentence => {
    const lowerSentence = sentence.toLowerCase()
    
    let score = 0
    
    // Keyword matching
    questionKeywords.forEach(keyword => {
      const keywordCount = (lowerSentence.match(new RegExp(keyword, 'g')) || []).length
      score += keywordCount * 2
    })
    
    // Bonus for question-type specific patterns
    if (lowerQuestion.includes('when') || lowerQuestion.includes('date')) {
      if (sentence.match(/\d{4}|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2}/)) score += 3
    }
    
    if (lowerQuestion.includes('where') || lowerQuestion.includes('place')) {
      if (sentence.match(/\b(in|at|from|to)\s+[A-Z]/)) score += 3
    }
    
    // Bonus for complete information (sentences with multiple keywords)
    const keywordMatches = questionKeywords.filter(k => lowerSentence.includes(k)).length
    if (keywordMatches >= 2) score += 5
    
    return {
      text: sentence.trim(),
      score: score,
      length: sentence.length,
      keywordCount: keywordMatches
    }
  })

  // Sort by score and select best sentences
  const bestSentences = scoredSentences
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || a.length - b.length)
    .slice(0, 3) // Take top 3 sentences

  if (bestSentences.length > 0) {
    // Combine sentences intelligently
    let answer = bestSentences
      .map(s => s.text)
      .join('. ')
      .replace(/\.\s*\./g, '.') // Remove double periods
    
    // Ensure proper ending
    if (!answer.endsWith('.')) answer += '.'
    
    console.log('📝 Extracted answer score:', bestSentences[0].score)
    return answer
  }

  // Last resort: return first substantial sentence
  const firstGoodSentence = sentences.find(s => s.length > 30)
  return firstGoodSentence ? firstGoodSentence + '.' : "I couldn't find relevant information in the provided documents to answer your question."
}