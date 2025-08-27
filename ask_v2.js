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

    // 2. Search for similar chunks
    const { data: similarChunks, error: searchError } = await supabase.rpc(
      'match_documents',
      {
        query_embedding: queryEmbedding,
        match_count: 3,
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
        answer: "I couldn't find any relevant information in your documents.",
        sources: []
      })
    }

    // 3. Combine chunks as context
    const context = similarChunks
      .map(chunk => chunk.chunk_text)
      .join('\n\n')

    console.log('📝 Context length:', context.length)

    // 4. Generate answer using LLM
    const answer = await generateAnswer(context, question)

    res.json({
      answer: answer,
      sources: similarChunks.map(chunk => ({
        text: chunk.chunk_text.substring(0, 100) + '...',
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

// Generate answer using Question Answering (primary) and T5 (fallback)
async function generateAnswer(context, question) {
  try {
    // PRIMARY: Use Question Answering pipeline - best for extracting specific answers
    const qaModels = [
      'deepset/roberta-base-squad2',    // Best for factual Q&A
      'distilbert-base-cased-distilled-squad',  // Faster alternative
      'deepset/minilm-uncased-squad2'   // Another good option
    ]

    for (const qaModel of qaModels) {
      try {
        console.log(`🎯 Trying QA model: ${qaModel}`)
        
        const response = await hf.questionAnswering({
          model: qaModel,
          inputs: {
            question: question,
            context: context.substring(0, 2000) // Increased context length
          }
        })

        if (response.answer && response.score > 0.05) { // Lower threshold
          console.log(`✅ QA Success with ${qaModel}, confidence: ${response.score.toFixed(3)}`)
          return response.answer
        } else {
          console.log(`⚠️ Low confidence (${response.score?.toFixed(3)}) from ${qaModel}`)
        }
      } catch (error) {
        console.log(`❌ QA model ${qaModel} failed:`, error.message)
        continue
      }
    }

    // SECONDARY: Try T5 models with better prompt engineering
    console.log('🔄 Trying T5 models as fallback...')
    
    const t5Models = [
      'google/flan-t5-base',
      'google/flan-t5-small'
    ]

    for (const model of t5Models) {
      try {
        console.log(`🤖 Trying T5 model: ${model}`)
        
        // Better T5 prompt - more explicit instruction
        const t5Input = `Answer this question using ONLY the information provided. If the answer is not in the text, say "Information not found in the document".

Question: ${question}

Text: ${context.substring(0, 1500)}

Answer:`
        
        const response = await hf.textGeneration({
          model: model,
          inputs: t5Input,
          parameters: {
            max_new_tokens: 50,
            temperature: 0.1,
            do_sample: false,
            return_full_text: false
          }
        })

        const answer = response.generated_text?.trim()
        if (answer && answer.length > 0 && !answer.toLowerCase().includes('nazi ideology')) {
          console.log(`✅ T5 Success with model: ${model}`)
          return answer
        }
      } catch (error) {
        console.log(`❌ T5 model ${model} failed:`, error.message)
        continue
      }
    }

    // FINAL FALLBACK: Smart text extraction
    console.log('🔄 Using enhanced text extraction...')
    return extractSmartAnswer(context, question)

  } catch (error) {
    console.error('Answer generation error:', error)
    return extractSmartAnswer(context, question)
  }
}

// Enhanced fallback function to extract relevant information
function extractSmartAnswer(context, question) {
  // Convert question to lowercase for better matching
  const lowerQuestion = question.toLowerCase()
  
  // Extract key question words (remove common words)
  const stopWords = ['what', 'when', 'where', 'who', 'how', 'why', 'did', 'was', 'were', 'is', 'are', 'the', 'and', 'or', 'but', 'to', 'for', 'of', 'in', 'on', 'at', 'by']
  const questionKeywords = lowerQuestion.split(' ')
    .filter(word => word.length > 2 && !stopWords.includes(word))
  
  console.log('🔍 Question keywords:', questionKeywords)
  
  // Split context into sentences
  const sentences = context.split(/[.!?]+/).filter(s => s.trim().length > 10)
  
  // Score sentences based on keyword matches
  const scoredSentences = sentences.map(sentence => {
    const lowerSentence = sentence.toLowerCase()
    const keywordMatches = questionKeywords.filter(keyword => 
      lowerSentence.includes(keyword)
    ).length
    
    return {
      text: sentence.trim(),
      score: keywordMatches,
      length: sentence.length
    }
  })
  
  // Sort by score (most relevant first)
  scoredSentences.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.length - b.length // Prefer shorter sentences if same score
  })
  
  // Return the most relevant sentence(s)
  const topSentences = scoredSentences
    .filter(s => s.score > 0)
    .slice(0, 2)
    .map(s => s.text)
  
  if (topSentences.length > 0) {
    const answer = topSentences.join('. ')
    console.log('📝 Extracted answer:', answer.substring(0, 100) + '...')
    return answer + (answer.endsWith('.') ? '' : '.')
  }
  
  // If no keyword matches, return first relevant sentence
  return sentences[0]?.trim() + '.' || "I couldn't find a specific answer in the provided context."
}