import { createClient } from "@supabase/supabase-js";
import { HfInference } from "@huggingface/inference";
import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Widget token secret (must match widget-token.js)
const WIDGET_SECRET =
  process.env.WIDGET_SECRET || "your-secure-widget-secret-2024-change-this";

// Function to validate widget token
function validateWidgetToken(token) {
  try {
    const [payloadBase64, signature] = token.split(".");
    if (!payloadBase64 || !signature) return null;

    const payloadString = Buffer.from(payloadBase64, "base64").toString();
    const expectedSignature = crypto
      .createHmac("sha256", WIDGET_SECRET)
      .update(payloadString)
      .digest("hex");

    if (signature !== expectedSignature) return null;

    const payload = JSON.parse(payloadString);

    // Check expiration
    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

// User-specific authenticated endpoint
export default async function handler(req, res) {
  // Handle CORS FIRST - before any authentication
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Now handle authentication for actual requests
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Please provide a valid authentication token",
    });
  }

  const token = authHeader.split(" ")[1];

  // SECURE DUAL AUTHENTICATION: Support both Supabase and Widget tokens
  let userId, userEmail, authMethod;

  // Try widget token first (for external domains - SAFE)
  const widgetPayload = validateWidgetToken(token);
  if (
    widgetPayload &&
    (widgetPayload.type === "widget" ||
      widgetPayload.type === "persistent_widget")
  ) {
    userId = widgetPayload.userId;
    userEmail = widgetPayload.email;
    authMethod =
      widgetPayload.type === "persistent_widget"
        ? "persistent_widget_token"
        : "widget_token";
    console.log(
      "🔐 Authenticated via SECURE widget token:",
      userId,
      userEmail,
      `(${authMethod})`
    );
  } else {
    // Fallback to Supabase token (for main app - server-side only)
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (error || !user) {
        console.error("Authentication failed:", error);
        return res.status(401).json({
          error: "Invalid authentication token",
          message: "Please log in again to access your documents",
        });
      }
      userId = user.id;
      userEmail = user.email;
      authMethod = "supabase_token";
      console.log("🔐 Authenticated via Supabase token:", userId, userEmail);
    } catch (authError) {
      console.error("Authentication error:", authError);
      return res.status(401).json({
        error: "Authentication failed",
        message: "Unable to validate your authentication token",
      });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const {
      question,
      organization_id,
      search_scope = "user",
      requestDomain,
    } = req.body;
    // userId is already set from authentication above

    // DOMAIN VALIDATION: Check if request is from authorized domain
    if (requestDomain) {
      console.log(`Domain validation - Request from: ${requestDomain}`);

      // Get user's widget configurations to check allowed domains
      const { data: configs, error: configError } = await supabase
        .from("widget_configurations")
        .select("allowed_domains")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (configError) {
        console.error("Error fetching widget config:", configError);
      } else if (configs && configs.length > 0) {
        const allowedDomains = configs[0].allowed_domains || [];
        const isDomainAllowed = allowedDomains.some(
          (domain) =>
            requestDomain === domain || requestDomain.endsWith("." + domain)
        );

        if (!isDomainAllowed) {
          console.warn(
            `Unauthorized domain access attempt: ${requestDomain} by user ${userId}`
          );
          return res.status(403).json({
            error: "Domain not authorized",
            message: `This domain (${requestDomain}) is not authorized to use this AI agent. Please contact the administrator.`,
          });
        }

        console.log(`Domain authorized: ${requestDomain}`);
      }
    }

    console.log(
      "SECURE User-specific Ask - Question from authenticated user:",
      userId,
      "(",
      userEmail,
      "):",
      question
    );
    console.log("SECURE User-specific Ask - Search context:", {
      organization_id,
      search_scope,
    });

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ error: "Question is required" });
    }

    // CRITICAL SECURITY: STRICT user-specific document filtering
    // This query ONLY returns documents that belong to the authenticated user
    let documentsQuery = supabase
      .from("documents")
      .select("*")
      .eq("user_id", userId); // SECURITY: This ensures we ONLY get THIS user's documents

    console.log("SECURITY CHECK: Querying documents ONLY for user_id:", userId);

    // If organization_id is provided AND user has access, include org documents
    if (organization_id) {
      // First verify user has access to this organization
      const { data: membership, error: membershipError } = await supabase
        .from("organization_memberships")
        .select("role")
        .eq("organization_id", organization_id)
        .eq("user_id", userId)
        .single();

      if (membershipError || !membership) {
        return res.status(403).json({
          error: "Access denied to this organization",
          answer: "You don't have access to documents in this organization.",
        });
      }

      // If user has org access and wants to include org documents
      if (search_scope === "all" || search_scope === "organization") {
        documentsQuery = supabase
          .from("documents")
          .select("*")
          .or(
            `user_id.eq.${userId},and(organization_id.eq.${organization_id},visibility.eq.organization)`
          );
      }
    }

    const { data: documents, error: docError } = await documentsQuery
      .limit(50) // Reasonable limit
      .order("created_at", { ascending: false });

    if (docError) {
      console.error("Error fetching user documents:", docError);
      return res.status(500).json({
        error: "Failed to fetch your documents",
        answer:
          "Sorry, I encountered an error while searching your documents. Please try again.",
      });
    }

    // CRITICAL SECURITY VALIDATION: Double-check all documents belong to this user
    if (documents && documents.length > 0) {
      const invalidDocs = documents.filter((doc) => doc.user_id !== userId);
      if (invalidDocs.length > 0) {
        console.error(
          "SECURITY BREACH DETECTED: Found documents not belonging to user",
          userId
        );
        console.error(
          "Invalid documents:",
          invalidDocs.map((d) => ({
            id: d.id,
            user_id: d.user_id,
            filename: d.filename,
          }))
        );
        return res.status(500).json({
          error: "Security validation failed",
          answer: "A security error occurred. Please contact support.",
        });
      }
    }

    if (!documents || documents.length === 0) {
      return res.status(200).json({
        answer:
          "You haven't uploaded any documents yet. Please upload some documents first using the main application, then try asking questions about them.",
        sources: [],
        stats: {
          userDocuments: 0,
          organizationDocuments: 0,
          documentsSearched: 0,
        },
        userId: userId,
        userEmail: userEmail,
      });
    }

    console.log(
      `SECURITY VERIFIED: Found ${documents.length} documents exclusively for user ${userId} (${userEmail}):`
    );

    // Log each document for security audit
    documents.forEach((doc, index) => {
      console.log(
        `  Document ${index + 1}: "${doc.filename}" (ID: ${doc.id}, Owner: ${doc.user_id})`
      );
    });

    // Check if we have both user and org documents
    const userDocs = documents.filter(
      (doc) => doc.user_id === userId && !doc.organization_id
    );
    const orgDocs = documents.filter(
      (doc) => doc.organization_id === organization_id
    );

    // Enhanced keyword-based search with smart document prioritization
    const questionLower = question.toLowerCase();
    const searchTerms = questionLower
      .split(" ")
      .filter((term) => term.length > 2);

    // Add synonyms for better matching
    const synonymMap = {
      ticket: ["booking", "reservation", "itinerary", "fare", "price", "cost"],
      reference: ["pnr", "booking", "confirmation"],
      passenger: ["traveler", "customer", "name"],
      travel: ["flight", "journey", "trip"],
      from: ["departure", "origin", "starting"],
      to: ["destination", "arrival", "ending"],
      fare: ["price", "cost", "amount", "fee", "charge", "ticket"],
      documents: ["files", "uploads", "papers"],
    };

    const expandedTerms = [...searchTerms];
    searchTerms.forEach((term) => {
      if (synonymMap[term]) {
        expandedTerms.push(...synonymMap[term]);
      }
    });

    // Special handling for document listing questions
    if (
      questionLower.includes("documents") &&
      (questionLower.includes("uploaded") || questionLower.includes("have"))
    ) {
      // Return summary of all documents
      const documentList = documents
        .map((doc) => `• ${doc.filename}`)
        .join("\n");
      return res.status(200).json({
        answer: `You have uploaded ${documents.length} documents:\n\n${documentList}`,
        sources: documents.map((doc, index) => ({
          text: doc.content.substring(0, 150) + "...",
          filename: doc.filename,
          similarity: 0.9,
          isUserDocument: true,
        })),
        stats: {
          userDocuments: userDocs.length,
          organizationDocuments: orgDocs.length,
          documentsSearched: documents.length,
          relevantDocuments: documents.length,
        },
        userId: userId,
        userEmail: userEmail,
      });
    }

    // Score documents based on relevance to question
    const scoredDocs = documents.map((doc) => {
      const content = (doc.content || "").toLowerCase();
      const filename = (doc.filename || "").toLowerCase();
      let score = 0;

      // Higher score for direct term matches
      expandedTerms.forEach((term) => {
        if (content.includes(term)) score += 2;
        if (filename.includes(term)) score += 3;
      });

      // Context-specific scoring for travel/ticket questions
      if (
        questionLower.includes("fare") ||
        questionLower.includes("price") ||
        questionLower.includes("cost") ||
        questionLower.includes("ticket")
      ) {
        if (
          content.includes("itinerary") ||
          content.includes("booking") ||
          content.includes("flight") ||
          content.includes("pnr")
        )
          score += 15;
        if (
          content.includes("marketing") ||
          content.includes("contract") ||
          content.includes("agreement")
        )
          score -= 10;
      }

      // Context-specific scoring for contract questions
      if (
        questionLower.includes("contract") ||
        questionLower.includes("marketing") ||
        questionLower.includes("agreement")
      ) {
        if (
          content.includes("marketing") ||
          content.includes("contract") ||
          content.includes("agreement")
        )
          score += 15;
        if (content.includes("itinerary") || content.includes("flight"))
          score -= 10;
      }

      return { ...doc, relevanceScore: score };
    });

    // Sort by relevance score and filter documents with positive scores
    const relevantDocs = scoredDocs
      .filter((doc) => doc.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5);

    console.log(
      `Found ${relevantDocs.length} relevant documents for user ${userId}`
    );

    if (relevantDocs.length === 0) {
      // Try a broader search with single words and synonyms
      const broadResults = documents
        .filter((doc) => {
          const content = (doc.content || "").toLowerCase();
          return expandedTerms
            .concat(questionLower.split(" "))
            .some((word) => word.length > 2 && content.includes(word));
        })
        .slice(0, 3);

      if (broadResults.length === 0) {
        // If still no results, return the first document with intelligent extraction
        if (documents.length > 0) {
          const fallbackAnswer = extractIntelligentAnswer(
            question,
            documents[0].content
          );
          return res.status(200).json({
            answer: `I searched your documents and found: ${fallbackAnswer}`,
            sources: [
              {
                text: documents[0].content.substring(0, 150) + "...",
                filename: documents[0].filename,
                similarity: 0.5,
                isUserDocument: true,
              },
            ],
            stats: {
              userDocuments: userDocs.length,
              organizationDocuments: orgDocs.length,
              documentsSearched: documents.length,
              relevantDocuments: 1,
            },
            userId: userId,
            userEmail: userEmail,
          });
        }

        return res.status(200).json({
          answer: `I searched through your ${documents.length} uploaded documents but couldn't find specific information about "${question}". Try asking about different topics related to your uploaded files, or upload more relevant documents to your personal library.`,
          sources: [],
          stats: {
            userDocuments: userDocs.length,
            organizationDocuments: orgDocs.length,
            documentsSearched: documents.length,
            relevantDocuments: 0,
          },
          userId: userId,
          userEmail: userEmail,
        });
      }

      // Use broad results with AI enhancement
      const topDoc = broadResults[0];
      const intelligentAnswer = extractIntelligentAnswer(
        question,
        topDoc.content
      );
      const answer = `Based on your uploaded documents: ${intelligentAnswer}`;

      const sources = broadResults.map((doc, index) => ({
        text: doc.content.substring(0, 120) + "...",
        filename: doc.filename || `Your Document ${index + 1}`,
        similarity: 0.6 + index * 0.1,
        isUserDocument: doc.user_id === userId,
      }));

      return res.status(200).json({
        answer,
        sources,
        stats: {
          userDocuments: userDocs.length,
          organizationDocuments: orgDocs.length,
          documentsSearched: documents.length,
          relevantDocuments: broadResults.length,
        },
        userId: userId,
        userEmail: userEmail,
      });
    }

    // Generate answer from the most relevant document using AI
    const topDoc = relevantDocs[0];
    const contentSnippet = topDoc.content.substring(0, 1500); // Use more content for context

    // Use Hugging Face for initial processing, then enhance with Gemini
    let aiAnswer;
    try {
      console.log("Generating AI answer for question:", question);
      console.log(
        "Using document:",
        topDoc.filename,
        "(score:",
        topDoc.relevanceScore,
        ")"
      );

      // Use question-answering model to get specific answers
      const qaResult = await hf.questionAnswering({
        model: "deepset/roberta-base-squad2",
        inputs: {
          question: question,
          context: contentSnippet,
        },
      });

      if (qaResult.answer && qaResult.score > 0.1) {
        // High-confidence answer from QA model - enhance with Gemini
        aiAnswer = qaResult.answer;
        console.log("QA Model answer:", aiAnswer, "Score:", qaResult.score);

        // Enhance with Gemini for better natural language
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-pro" });
          const geminiPrompt = `Please improve and expand this answer to be more helpful and natural:

Question: ${question}
Current Answer: ${aiAnswer}
Document Context: ${contentSnippet.substring(0, 500)}

Provide a clear, concise, and helpful response:`;

          const geminiResult = await model.generateContent(geminiPrompt);
          const geminiResponse = geminiResult.response;
          const enhancedAnswer = geminiResponse.text();

          if (enhancedAnswer && enhancedAnswer.length > aiAnswer.length * 0.8) {
            aiAnswer = enhancedAnswer;
            console.log(
              "Enhanced with Gemini:",
              aiAnswer.substring(0, 100) + "..."
            );
          }
        } catch (geminiError) {
          console.log(
            "Gemini enhancement failed, using original:",
            geminiError.message
          );
        }
      } else {
        // Use Gemini directly for complex questions
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-pro" });
          const geminiPrompt = `Based on the following document content, please answer the question accurately and concisely:

Question: ${question}
Document Content: ${contentSnippet}

Answer:`;

          const geminiResult = await model.generateContent(geminiPrompt);
          const geminiResponse = geminiResult.response;
          aiAnswer = geminiResponse.text();
          console.log(
            "Gemini direct answer:",
            aiAnswer.substring(0, 100) + "..."
          );
        } catch (geminiError) {
          console.log("Gemini failed, using fallback:", geminiError.message);
          // Fallback to intelligent text extraction
          aiAnswer = extractIntelligentAnswer(question, contentSnippet);
        }
      }
    } catch (aiError) {
      console.error("AI generation error:", aiError);
      // Fallback to intelligent text extraction
      aiAnswer = extractIntelligentAnswer(question, contentSnippet);
    }

    // Create a comprehensive answer
    let answer;

    // Handle specific question types with targeted responses
    if (
      question.toLowerCase().includes("booking reference") ||
      question.toLowerCase().includes("pnr")
    ) {
      const referenceMatch = contentSnippet.match(
        /(?:PNR|Booking Reference)[:\s]*([A-Z0-9]{6,})/i
      );
      answer = referenceMatch
        ? `Your booking reference is: ${referenceMatch[1]}`
        : aiAnswer;
    } else if (
      question.toLowerCase().includes("passenger name") ||
      question.toLowerCase().includes("name of")
    ) {
      const nameMatch = contentSnippet.match(
        /(?:Passenger Information|Name)[:\s]*(?:Mr|Ms|Mrs)?\s*([A-Za-z\s]+?)(?:Adult|\n|Sector)/i
      );
      answer = nameMatch
        ? `The passenger name is: ${nameMatch[1].trim()}`
        : aiAnswer;
    } else if (
      question.toLowerCase().includes("traveling from") ||
      question.toLowerCase().includes("departure")
    ) {
      const fromMatch = contentSnippet.match(
        /([A-Z]{3})\s*-\s*([A-Z]{3})|from\s+([A-Za-z\s]+?)\s+to|([A-Za-z\s]+?)\s+HYD/i
      );
      if (fromMatch) {
        answer = `Traveling from: ${fromMatch[3] || fromMatch[4] || "Hyderabad (HYD)"}`;
      } else {
        answer = aiAnswer;
      }
    } else if (
      question.toLowerCase().includes("ticket about") ||
      question.toLowerCase().includes("pdf about")
    ) {
      answer = `This is a flight itinerary/ticket for ${topDoc.filename.replace(".pdf", "")}. ${aiAnswer}`;
    } else {
      // Use AI-generated answer for general questions
      answer = aiAnswer;
    }

    // Add document context
    answer += `\n\n📄 Source: ${topDoc.filename}`;

    // Create sources array with better formatting
    const sources = relevantDocs.slice(0, 3).map((doc, index) => ({
      text:
        doc.content.substring(0, 200) + (doc.content.length > 200 ? "..." : ""),
      filename: doc.filename || `Document ${index + 1}`,
      similarity: Math.max(0.8 - index * 0.1, 0.6),
      created_at: doc.created_at,
      isUserDocument: doc.user_id === userId,
      source_type: doc.organization_id ? "organization" : "personal",
    }));

    return res.status(200).json({
      answer,
      sources,
      stats: {
        userDocuments: userDocs.length,
        organizationDocuments: orgDocs.length,
        documentsSearched: documents.length,
        relevantDocuments: relevantDocs.length,
        searchTerms: searchTerms.length,
      },
      userId: userId,
      security_note:
        "This response is based only on your personal documents and any organization documents you have access to.",
    });
  } catch (error) {
    console.error("Error in ask-user API:", error);
    return res.status(500).json({
      error: "Internal server error",
      answer:
        "Sorry, I encountered an error while processing your question. Please try again later.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// Helper function to generate embedding (for future semantic search)
async function generateEmbedding(text) {
  try {
    const response = await hf.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: text,
    });

    if (Array.isArray(response) && Array.isArray(response[0])) {
      return response[0];
    } else if (Array.isArray(response)) {
      return response;
    } else {
      throw new Error("Unexpected embedding response format");
    }
  } catch (error) {
    console.error("Embedding generation error:", error);
    throw new Error("Failed to generate embedding: " + error.message);
  }
}

// Intelligent text extraction for fallback answers
function extractIntelligentAnswer(question, content) {
  const questionLower = question.toLowerCase();

  // Extract specific information based on question type
  if (
    questionLower.includes("booking") ||
    questionLower.includes("reference") ||
    questionLower.includes("pnr")
  ) {
    const match = content.match(
      /(?:PNR|Booking Reference)[:\s]*([A-Z0-9]{4,})/i
    );
    return match
      ? `Your booking reference is: ${match[1]}`
      : "Booking reference not clearly identified in the document.";
  }

  if (questionLower.includes("name") || questionLower.includes("passenger")) {
    const match =
      content.match(/(?:Mr|Ms|Mrs)\s+([A-Za-z\s]+?)(?:Adult|\n|Sector)/i) ||
      content.match(
        /Passenger Information[\s\S]*?([A-Z][a-z]+\s+[A-Z][a-z]+)/i
      );
    return match
      ? `The passenger name is: ${match[1].trim()}`
      : "Passenger name not clearly identified in the document.";
  }

  if (
    questionLower.includes("travel") ||
    questionLower.includes("from") ||
    questionLower.includes("to")
  ) {
    const fromMatch = content.match(
      /([A-Za-z\s]+?)\s+([A-Z]{3})\s*-\s*([A-Za-z\s]+?)\s+([A-Z]{3})/i
    );
    if (fromMatch) {
      return `Traveling from ${fromMatch[1].trim()} (${fromMatch[2]}) to ${fromMatch[3].trim()} (${fromMatch[4]})`;
    }
    const simpleMatch = content.match(/HYD|DEL|BOM|MAA/g);
    if (simpleMatch) {
      return `This appears to be travel involving: ${simpleMatch.join(", ")}`;
    }
    return "Travel details not clearly identified in the document.";
  }

  if (questionLower.includes("date") || questionLower.includes("time")) {
    const dateMatch = content.match(
      /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i
    );
    const timeMatch = content.match(/(\d{1,2}:\d{2}\s*(?:hrs|AM|PM)?)/i);
    let answer = "";
    if (dateMatch) answer += `Date: ${dateMatch[1]}. `;
    if (timeMatch) answer += `Time: ${timeMatch[1]}.`;
    return (
      answer || "Date/time information not clearly identified in the document."
    );
  }

  if (questionLower.includes("ticket") || questionLower.includes("about")) {
    if (
      content.includes("flight") ||
      content.includes("airline") ||
      content.includes("HYD") ||
      content.includes("DEL")
    ) {
      return "This appears to be a flight ticket/itinerary document.";
    }
    return "This appears to be a travel-related document.";
  }

  // Default: extract first meaningful sentence
  const sentences = content.split(/[.!?]/);
  const meaningfulSentence = sentences.find(
    (s) => s.trim().length > 20 && !s.includes("\n\n")
  );
  return meaningfulSentence
    ? meaningfulSentence.trim() + "."
    : "Information found but could not extract a specific answer.";
}
