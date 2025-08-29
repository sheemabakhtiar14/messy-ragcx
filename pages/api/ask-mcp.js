import { HfInference } from '@huggingface/inference'
import { requireAuth } from '../../utils/auth'
import { 
  getSupabaseMCPClient, 
  performSemanticSearch, 
  queryUserDocuments 
} from '../../utils/mcp-client'

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY)

// Enhanced ask endpoint using MCP
export default requireAuth(async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }

  // Add CORS headers to all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' })
  }

  const mcpClient = getSupabaseMCPClient();

  try {
    const { question, organization_id, search_scope = 'all' } = req.body
    const userId = req.user.userId // Get authenticated user ID

    console.log('MCP Ask - Question from user:', userId, ':', question)
    console.log('MCP Ask - Search context:', { organization_id, search_scope })

    // Validate organization access if organization_id provided
    if (organization_id) {
      try {
        const userOrgs = await mcpClient.getUserOrganizations(userId);
        const hasAccess = userOrgs.memberships?.some(
          membership => membership.organization_id === organization_id
        );

        if (!hasAccess) {
          return res.status(403).json({ 
            error: 'Access denied to this organization or organization not found' 
          })
        }

        console.log(`MCP Ask - User ${userId} has access to organization ${organization_id}`)
      } catch (error) {
        console.error('MCP Ask - Error checking organization access:', error);
        return res.status(500).json({ error: 'Error validating organization access' });
      }
    }

    // Get user's accessible documents using MCP
    let totalPersonalDocs = 0;
    let totalOrgDocs = 0;

    try {
      // Get personal documents
      const personalDocs = await queryUserDocuments(userId, null);
      totalPersonalDocs = personalDocs.count || 0;

      // Get organization documents if applicable
      if (search_scope === 'all' || search_scope === 'organization') {
        const userOrgs = await mcpClient.getUserOrganizations(userId);
        
        for (const membership of userOrgs.memberships || []) {
          if (!organization_id || membership.organization_id === organization_id) {
            const orgDocs = await queryUserDocuments(userId, membership.organization_id);
            totalOrgDocs += orgDocs.count || 0;
          }
        }
      }
    } catch (error) {
      console.error('MCP Ask - Error counting documents:', error);
      return res.status(500).json({ error: 'Error accessing documents' });
    }

    const totalAccessibleDocs = totalPersonalDocs + totalOrgDocs;

    console.log(`MCP Ask - User ${userId} has access to:`)
    console.log(`- Personal documents: ${totalPersonalDocs}`)
    console.log(`- Organization documents: ${totalOrgDocs}`)
    console.log(`- Total accessible: ${totalAccessibleDocs}`)

    if (totalAccessibleDocs === 0) {
      return res.json({
        answer: \"You don't have access to any documents yet. Please upload a document first or join an organization to ask questions.\",
        sources: [],
        user_documents: totalPersonalDocs,
        organization_documents: totalOrgDocs,
        search_context: {
          scope: search_scope,
          organization_id: organization_id
        },
        mcp_enabled: true
      })
    }

    // Generate embedding for the question
    console.log('MCP Ask - Generating query embedding...');
    const queryEmbedding = await generateEmbedding(question)
    console.log('MCP Ask - Generated query embedding')

    // Perform semantic search using MCP
    let searchResults = [];
    try {
      const searchResponse = await performSemanticSearch(
        userId, 
        queryEmbedding, 
        organization_id, 
        5 // limit
      );
      
      searchResults = searchResponse.chunks || [];
      console.log(`MCP Ask - Found ${searchResults.length} similar chunks for user ${userId}`)
    } catch (error) {
      console.error('MCP Ask - Error performing semantic search:', error);
      return res.status(500).json({ error: 'Error performing semantic search' });
    }

    if (searchResults.length === 0) {
      return res.json({
        answer: \"I couldn't find any relevant information in your accessible documents to answer this question.\",
        sources: [],
        searched_documents: totalAccessibleDocs,
        search_context: {
          scope: search_scope,
          organization_id: organization_id,
          personal_docs: totalPersonalDocs,
          org_docs: totalOrgDocs
        },
        mcp_enabled: true
      })
    }

    // Smart context assembly with organization awareness
    const contextWithScores = assembleSmartContext(searchResults, question)
    
    console.log('MCP Ask - Context length:', contextWithScores.context.length)
    console.log('MCP Ask - Source breakdown:', contextWithScores.sourceBreakdown)

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
        organization_id: chunk.organization_id || null,
        filename: chunk.filename
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
      searched_user: userId,
      mcp_enabled: true
    }

    res.json(response)

  } catch (error) {
    console.error('MCP Ask error:', error)
    res.status(500).json({ error: 'Internal server error: ' + error.message })
  } finally {
    // Optional: Clean up MCP connection if needed
    // await cleanupMCPClient();
  }
})

// Generate embedding function
async function generateEmbedding(text) {
  try {
    const response = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: text
    })

    // Handle different response formats
    if (Array.isArray(response) && Array.isArray(response[0])) {
      return response[0] // If nested array
    } else if (Array.isArray(response)) {
      return response // If single array
    } else {
      throw new Error('Unexpected embedding response format')
    }
  } catch (error) {
    console.error('Embedding generation error:', error)
    throw new Error('Failed to generate embedding: ' + error.message)
  }
}

// Smart context assembly function
function assembleSmartContext(searchResults, question) {
  if (!searchResults || searchResults.length === 0) {
    return {
      context: '',
      qualityScore: 0,
      sourceBreakdown: {},
      keyInfo: ''
    }
  }

  let context = ''
  let totalScore = 0
  const sourceBreakdown = {}
  const keyInfo = []

  // Sort by similarity score
  const sortedResults = searchResults.sort((a, b) => b.similarity - a.similarity)

  for (const chunk of sortedResults) {
    // Add chunk with metadata
    const chunkWithMeta = `[Source: ${chunk.filename || 'Unknown'}, Similarity: ${chunk.similarity.toFixed(3)}]\\n${chunk.chunk_text}\\n\\n`
    
    // Check if adding this chunk would exceed reasonable context length
    if ((context + chunkWithMeta).length > 4000) {
      break
    }

    context += chunkWithMeta
    totalScore += chunk.similarity

    // Track source breakdown
    const sourceType = chunk.source_type || 'unknown'
    sourceBreakdown[sourceType] = (sourceBreakdown[sourceType] || 0) + 1

    // Extract key information for high-similarity chunks
    if (chunk.similarity > 0.7) {
      keyInfo.push(chunk.chunk_text.substring(0, 200))
    }
  }

  return {
    context: context.trim(),
    qualityScore: totalScore / sortedResults.length,
    sourceBreakdown,
    keyInfo: keyInfo.join(' | ')
  }
}

// Enhanced answer generation
async function generateEnhancedAnswer(context, question, keyInfo) {
  try {
    const enhancedPrompt = `You are a helpful AI assistant. Answer the user's question based on the provided context. 

Key Information: ${keyInfo}

Context:
${context}

Question: ${question}

Instructions:
- Provide a comprehensive and accurate answer based on the context
- If the context doesn't contain enough information, say so clearly
- Cite specific sources when possible
- Be concise but thorough
- If you're uncertain about something, express that uncertainty

Answer:`

    const response = await hf.textGeneration({
      model: 'microsoft/DialoGPT-medium',
      inputs: enhancedPrompt,
      parameters: {
        max_new_tokens: 500,
        temperature: 0.7,
        do_sample: true,
        top_p: 0.9,
        repetition_penalty: 1.1
      }
    })

    let answer = response.generated_text || response
    
    // Clean up the response
    if (typeof answer === 'string') {
      // Remove the original prompt if it's included in the response
      const answerStart = answer.indexOf('Answer:')
      if (answerStart !== -1) {
        answer = answer.substring(answerStart + 7).trim()
      }
      
      // Limit length and clean up
      answer = answer.substring(0, 1000).trim()
      
      if (answer.length === 0) {
        answer = \"I found relevant context but couldn't generate a proper answer. Please rephrase your question or try a different approach.\"
      }
    } else {
      answer = \"I couldn't generate a proper answer from the available context. Please try rephrasing your question.\"
    }

    return answer

  } catch (error) {
    console.error('Answer generation error:', error)
    return `I found relevant information in your documents, but encountered an error generating the answer: ${error.message}. Here's the relevant context I found:\\n\\n${context.substring(0, 500)}...`
  }
}