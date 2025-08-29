import { HfInference } from "@huggingface/inference";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import os from "os";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import pdfParse from "pdf-parse";
import { requireAuth } from "../../utils/auth";
import {
  getSupabaseMCPClient,
  saveDocumentViaMCP,
  saveChunkViaMCP,
} from "../../utils/mcp-client";

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

// MCP-enhanced save endpoint
export default requireAuth(async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const mcpClient = getSupabaseMCPClient();

  try {
    // Get authenticated user ID
    const userId = req.user.userId;
    console.log("MCP Save - Processing document for user:", userId);

    const form = formidable({
      uploadDir: os.tmpdir(),
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    const [fields, files] = await form.parse(req);

    let filename, content, organizationId, visibility;

    // Extract organization context from form data
    organizationId = fields.organization_id?.[0] || null;
    visibility = fields.visibility?.[0] || "private";

    console.log("MCP Save - Upload context:", { organizationId, visibility });

    // Validate organization access if organization_id provided
    if (organizationId) {
      try {
        const userOrgs = await mcpClient.getUserOrganizations(userId);
        const hasAccess = userOrgs.memberships?.some(
          (membership) => membership.organization_id === organizationId
        );

        if (!hasAccess) {
          return res.status(403).json({
            error:
              "Access denied to this organization or organization not found",
          });
        }

        console.log(
          `MCP Save - User ${userId} has access to organization ${organizationId}`
        );
      } catch (error) {
        console.error("MCP Save - Error checking organization access:", error);
        return res
          .status(500)
          .json({ error: "Error validating organization access" });
      }
    }

    // Handle file upload
    if (files.file && files.file[0]) {
      const uploadedFile = files.file[0];
      filename = uploadedFile.originalFilename;

      console.log("MCP Save - Processing uploaded file:", filename);

      // Extract text based on file type
      content = await extractTextFromFile(uploadedFile.filepath, filename);

      // Clean up uploaded file
      fs.unlinkSync(uploadedFile.filepath);
    }
    // Handle text input
    else if (fields.content && fields.content[0]) {
      filename = fields.filename?.[0] || "manual-input.txt";
      content = fields.content[0];
      console.log("MCP Save - Processing text input:", filename);
    } else {
      return res.status(400).json({ error: "No file or content provided" });
    }

    if (!content || content.trim().length < 10) {
      return res
        .status(400)
        .json({ error: "Document content is too short or empty" });
    }

    console.log(`MCP Save - Content length: ${content.length} characters`);

    // Check for existing documents with same filename using MCP
    try {
      const existingDocs = await mcpClient.queryDocuments({
        userId,
        organizationId,
        filename,
        limit: 1,
      });

      if (existingDocs.documents && existingDocs.documents.length > 0) {
        console.log(
          `MCP Save - Warning: Document with name ${filename} already exists in this context`
        );
        // Append timestamp to make unique
        const filenameParts = path.parse(filename);
        filename = `${filenameParts.name}_${Date.now()}${filenameParts.ext}`;
      }
    } catch (error) {
      console.error("MCP Save - Error checking existing documents:", error);
      // Continue with original filename if check fails
    }

    console.log("MCP Save - Saving document with filename:", filename);

    // Save document using MCP
    let document;
    try {
      const documentResult = await saveDocumentViaMCP(
        userId,
        filename,
        content,
        organizationId,
        organizationId ? visibility : "private"
      );

      if (!documentResult.success) {
        throw new Error(documentResult.error || "Failed to save document");
      }

      document = documentResult.document;
      console.log(
        "MCP Save - Document saved with ID:",
        document.id,
        "for user:",
        userId,
        "in organization:",
        organizationId
      );
    } catch (error) {
      console.error("MCP Save - Error saving document:", error);
      return res
        .status(500)
        .json({ error: "Failed to save document: " + error.message });
    }

    // OPTIMIZED CHUNKING: Split text into chunks with filename awareness
    const chunks = chunkText(content, filename);
    console.log(
      `MCP Save - Created ${chunks.length} chunks (optimized chunking system)`
    );

    // Generate embeddings for each chunk using MCP
    let processedChunks = 0;
    const batchSize = 5;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      for (let j = 0; j < batch.length; j++) {
        try {
          const chunkIndex = i + j;
          const chunk = batch[j];

          console.log(
            `MCP Save - Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} chars)`
          );

          const embedding = await generateEmbedding(chunk);

          // Save chunk using MCP
          const chunkResult = await saveChunkViaMCP(
            document.id,
            userId,
            chunk,
            embedding,
            organizationId
          );

          if (chunkResult.success) {
            processedChunks++;
          } else {
            console.error("MCP Save - Chunk error:", chunkResult.error);
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(
            `MCP Save - Failed to process chunk ${i + j}:`,
            error.message
          );
        }
      }
    }

    console.log(
      `MCP Save - Successfully processed ${processedChunks}/${chunks.length} chunks`
    );

    // Get final statistics using MCP
    let stats;
    try {
      stats = await mcpClient.getStats();
    } catch (error) {
      console.error("MCP Save - Error getting stats:", error);
      stats = { documents: "unknown", chunks: "unknown" };
    }

    res.json({
      success: true,
      message: "Document uploaded and processed successfully via MCP",
      document: {
        id: document.id,
        filename: filename,
        user_id: userId,
        organization_id: organizationId,
        visibility: document.visibility,
        is_organization_document: document.is_organization_document,
      },
      processing: {
        total_chunks: chunks.length,
        processed_chunks: processedChunks,
        content_length: content.length,
      },
      context: {
        organization_id: organizationId,
        visibility: document.visibility,
      },
      database_stats: stats,
      mcp_enabled: true,
    });
  } catch (error) {
    console.error("MCP Save error:", error);
    res.status(500).json({
      error: "Internal server error: " + error.message,
      mcp_enabled: true,
    });
  } finally {
    // Optional: Clean up MCP connection if needed
    // await cleanupMCPClient();
  }
});

// Extract text from different file types
async function extractTextFromFile(filePath, filename) {
  const ext = path.extname(filename).toLowerCase();

  try {
    switch (ext) {
      case ".pdf":
        const pdfBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(pdfBuffer);
        return pdfData.text;

      case ".docx":
        const docxResult = await mammoth.extractRawText({ path: filePath });
        return docxResult.value;

      case ".xlsx":
      case ".xls":
        const workbook = XLSX.readFile(filePath);
        let xlsxText = "";
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          xlsxText += XLSX.utils.sheet_to_txt(sheet) + "\\n";
        });
        return xlsxText;

      case ".txt":
      case ".md":
      case ".csv":
      default:
        return fs.readFileSync(filePath, "utf-8");
    }
  } catch (error) {
    console.error("File extraction error:", error);
    throw new Error(
      `Failed to extract text from ${ext} file: ${error.message}`
    );
  }
}

// Generate embedding function
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

// Enhanced chunking function
function chunkText(text, filename = "") {
  const maxChunkSize = 1000;
  const overlap = 200;
  const chunks = [];

  // Add filename context to better chunking
  const isCode = /\\.(js|py|java|cpp|c|html|css|json|xml|yaml|yml)$/i.test(
    filename
  );
  const isStructured = /\\.(csv|xlsx|xls)$/i.test(filename);

  if (isCode) {
    // For code files, try to preserve function/class boundaries
    return chunkCodeFile(text, maxChunkSize, overlap);
  } else if (isStructured) {
    // For structured data, chunk by logical units (rows, sections)
    return chunkStructuredData(text, maxChunkSize, overlap);
  } else {
    // For regular text, use sentence-aware chunking
    return chunkTextBySentences(text, maxChunkSize, overlap);
  }
}

function chunkTextBySentences(text, maxChunkSize, overlap) {
  const sentences = text.split(/(?<=[.!?])\\s+/);
  const chunks = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if (
      (currentChunk + sentence).length > maxChunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());

      // Create overlap
      const words = currentChunk.trim().split(" ");
      const overlapWords = words.slice(-Math.floor(overlap / 5)); // Rough word estimate
      currentChunk = overlapWords.join(" ") + " " + sentence;
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((chunk) => chunk.length > 10);
}

function chunkCodeFile(text, maxChunkSize, overlap) {
  // Simple code chunking - can be enhanced with proper AST parsing
  const lines = text.split("\\n");
  const chunks = [];
  let currentChunk = "";

  for (const line of lines) {
    if (
      (currentChunk + line + "\\n").length > maxChunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());

      // For code, preserve some context
      const chunkLines = currentChunk.trim().split("\\n");
      const overlapLines = chunkLines.slice(-Math.floor(overlap / 50)); // Rough estimate
      currentChunk = overlapLines.join("\\n") + "\\n" + line;
    } else {
      currentChunk += (currentChunk ? "\\n" : "") + line;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((chunk) => chunk.length > 10);
}

function chunkStructuredData(text, maxChunkSize, overlap) {
  // For CSV/structured data, chunk by rows while preserving headers
  const lines = text.split("\\n");
  if (lines.length <= 1) return [text];

  const header = lines[0];
  const dataLines = lines.slice(1);
  const chunks = [];
  let currentChunk = header;

  for (const line of dataLines) {
    if (
      (currentChunk + "\\n" + line).length > maxChunkSize &&
      currentChunk !== header
    ) {
      chunks.push(currentChunk);
      currentChunk = header + "\\n" + line;
    } else {
      currentChunk += "\\n" + line;
    }
  }

  if (currentChunk && currentChunk !== header) {
    chunks.push(currentChunk);
  }

  return chunks.filter((chunk) => chunk.length > header.length + 10);
}
