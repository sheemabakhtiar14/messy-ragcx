import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for server-side operations
);

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.status(200).end();
  }

  // Add CORS headers to all responses
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { question, search_scope: _search_scope = "all" } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ error: "Question is required" });
    }

    console.log("Public API - Question received:", question);

    // Get any documents for testing (including private ones for demo)
    const { data: documents, error: docError } = await supabase
      .from("documents")
      .select(
        `
        id,
        filename,
        content,
        user_id,
        visibility,
        created_at
      `
      )
      .limit(10)
      .order("created_at", { ascending: false });

    if (docError) {
      console.error("Error fetching documents:", docError);
      return res.status(500).json({
        error: "Failed to fetch documents",
        answer:
          "Sorry, I encountered an error while searching for documents. Please try again.",
      });
    }

    if (!documents || documents.length === 0) {
      return res.status(200).json({
        answer:
          "I don't have any documents to search through yet. Please upload some documents first using the main application, then try asking questions.",
        sources: [],
        stats: {
          documentsSearched: 0,
          relevantDocuments: 0,
        },
      });
    }

    console.log(
      `Found ${documents.length} documents to search:`,
      documents.map((d) => d.filename)
    );

    // Simple keyword-based search for testing
    const questionLower = question.toLowerCase();
    const searchTerms = questionLower
      .split(" ")
      .filter((term) => term.length > 2);

    const relevantDocs = documents
      .filter((doc) => {
        const content = (doc.content || "").toLowerCase();
        const filename = (doc.filename || "").toLowerCase();

        // Check if any search terms match content or filename
        return searchTerms.some(
          (term) => content.includes(term) || filename.includes(term)
        );
      })
      .slice(0, 5); // Limit to top 5 results

    console.log(`Found ${relevantDocs.length} relevant documents`);

    if (relevantDocs.length === 0) {
      // Try a broader search with single words
      const broadResults = documents
        .filter((doc) => {
          const content = (doc.content || "").toLowerCase();
          return questionLower
            .split(" ")
            .some((word) => word.length > 3 && content.includes(word));
        })
        .slice(0, 3);

      if (broadResults.length === 0) {
        return res.status(200).json({
          answer: `I searched through ${documents.length} available documents but couldn't find specific information about "${question}". Try asking about different topics, or in a real implementation, upload more relevant documents to your personal library.`,
          sources: [],
          stats: {
            documentsSearched: documents.length,
            relevantDocuments: 0,
          },
        });
      }

      // Use broad results
      const answer = `I found some related information about "${question}". Here's what I found: ${broadResults[0].content.substring(0, 300)}...`;

      const sources = broadResults.map((doc, index) => ({
        text: doc.content.substring(0, 120) + "...",
        filename: doc.filename || `Document ${index + 1}`,
        similarity: 0.6 + index * 0.1, // Mock similarity score
      }));

      return res.status(200).json({
        answer,
        sources,
        stats: {
          documentsSearched: documents.length,
          relevantDocuments: broadResults.length,
        },
      });
    }

    // Generate answer from the most relevant document
    const topDoc = relevantDocs[0];
    const contentSnippet = topDoc.content.substring(0, 400);

    // Create a more natural answer
    let answer = `Based on the documents I found, here's what I can tell you about "${question}":\n\n`;
    answer += contentSnippet;

    if (contentSnippet.length < topDoc.content.length) {
      answer += "...";
    }

    // Create sources array
    const sources = relevantDocs.slice(0, 3).map((doc, index) => ({
      text:
        doc.content.substring(0, 150) + (doc.content.length > 150 ? "..." : ""),
      filename: doc.filename || `Document ${index + 1}`,
      similarity: Math.max(0.7 - index * 0.1, 0.5), // Mock similarity scores
      created_at: doc.created_at,
    }));

    return res.status(200).json({
      answer,
      sources,
      stats: {
        documentsSearched: documents.length,
        relevantDocuments: relevantDocs.length,
        searchTerms: searchTerms.length,
      },
      demo_note:
        "This is a demo version. In the full system, you'd have access to your personal authenticated document library.",
    });
  } catch (error) {
    console.error("Error in ask-public API:", error);
    return res.status(500).json({
      error: "Internal server error",
      answer:
        "Sorry, I encountered an error while processing your question. Please try again later.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
