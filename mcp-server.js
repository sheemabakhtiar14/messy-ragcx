#!/usr/bin/env node

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Supabase Management client (for enhanced operations)
const supabaseManagement = process.env.SUPABASE_ACCESS_TOKEN
  ? {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      token: process.env.SUPABASE_ACCESS_TOKEN,
    }
  : null;

// Initialize MCP server
const server = new Server(
  {
    name: "supabase-rag-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

// Define available tools for database operations
server.setRequestHandler("tools/list", async () => {
  return {
    tools: [
      {
        name: "query_documents",
        description:
          "Query documents table with filters and search capabilities",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "User ID to filter documents",
            },
            organization_id: {
              type: "string",
              description: "Organization ID to filter documents",
            },
            filename: { type: "string", description: "Filename to search for" },
            limit: {
              type: "number",
              description: "Limit number of results",
              default: 10,
            },
          },
        },
      },
      {
        name: "search_document_chunks",
        description: "Search document chunks with semantic similarity",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "User ID for access control",
            },
            query_embedding: {
              type: "array",
              description: "Query embedding vector",
            },
            organization_id: {
              type: "string",
              description: "Organization ID to filter chunks",
            },
            similarity_threshold: {
              type: "number",
              description: "Minimum similarity threshold",
              default: 0.3,
            },
            limit: {
              type: "number",
              description: "Limit number of results",
              default: 5,
            },
          },
          required: ["user_id", "query_embedding"],
        },
      },
      {
        name: "get_user_organizations",
        description: "Get organizations that a user belongs to",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "User ID to get organizations for",
            },
          },
          required: ["user_id"],
        },
      },
      {
        name: "insert_document",
        description: "Insert a new document into the database",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "User ID who owns the document",
            },
            filename: { type: "string", description: "Document filename" },
            content: { type: "string", description: "Document content" },
            organization_id: {
              type: "string",
              description: "Organization ID (optional)",
            },
            visibility: {
              type: "string",
              description: "Document visibility (private/organization)",
              default: "private",
            },
          },
          required: ["user_id", "filename", "content"],
        },
      },
      {
        name: "insert_document_chunk",
        description: "Insert a document chunk with embedding",
        inputSchema: {
          type: "object",
          properties: {
            document_id: {
              type: "string",
              description: "Document ID this chunk belongs to",
            },
            user_id: {
              type: "string",
              description: "User ID who owns the chunk",
            },
            chunk_text: {
              type: "string",
              description: "Text content of the chunk",
            },
            embedding: {
              type: "array",
              description: "Embedding vector for the chunk",
            },
            organization_id: {
              type: "string",
              description: "Organization ID (optional)",
            },
          },
          required: ["document_id", "user_id", "chunk_text", "embedding"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "query_documents":
        return await queryDocuments(args);

      case "search_document_chunks":
        return await searchDocumentChunks(args);

      case "get_user_organizations":
        return await getUserOrganizations(args);

      case "insert_document":
        return await insertDocument(args);

      case "insert_document_chunk":
        return await insertDocumentChunk(args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Tool implementations
async function queryDocuments(args) {
  let query = supabase.from("documents").select("*");

  if (args.user_id) {
    query = query.eq("user_id", args.user_id);
  }

  if (args.organization_id) {
    query = query.eq("organization_id", args.organization_id);
  }

  if (args.filename) {
    query = query.ilike("filename", `%${args.filename}%`);
  }

  if (args.limit) {
    query = query.limit(args.limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            documents: data,
            count: data.length,
          },
          null,
          2
        ),
      },
    ],
  };
}

async function searchDocumentChunks(args) {
  // Build the RPC call for similarity search
  let rpcCall = supabase.rpc("search_document_chunks", {
    query_embedding: args.query_embedding,
    similarity_threshold: args.similarity_threshold || 0.3,
    result_limit: args.limit || 5,
    user_id: args.user_id,
  });

  if (args.organization_id) {
    // If organization_id is provided, we'll filter after the RPC call
    // since the RPC function might not support organization filtering directly
  }

  const { data, error } = await rpcCall;

  if (error) throw error;

  // Filter by organization if needed
  let filteredData = data;
  if (args.organization_id) {
    filteredData = data.filter(
      (chunk) =>
        chunk.organization_id === args.organization_id ||
        chunk.organization_id === null // Include personal documents if user has access
    );
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            chunks: filteredData,
            count: filteredData.length,
            search_params: {
              similarity_threshold: args.similarity_threshold || 0.3,
              organization_id: args.organization_id,
              user_id: args.user_id,
            },
          },
          null,
          2
        ),
      },
    ],
  };
}

async function getUserOrganizations(args) {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select(
      `
      organization_id,
      role,
      organizations (
        id,
        name,
        description
      )
    `
    )
    .eq("user_id", args.user_id);

  if (error) throw error;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            memberships: data,
            count: data.length,
          },
          null,
          2
        ),
      },
    ],
  };
}

async function insertDocument(args) {
  const documentData = {
    user_id: args.user_id,
    filename: args.filename,
    content: args.content,
    organization_id: args.organization_id || null,
    visibility: args.organization_id ? args.visibility || "private" : "private",
    is_organization_document: !!args.organization_id,
  };

  const { data, error } = await supabase
    .from("documents")
    .insert(documentData)
    .select()
    .single();

  if (error) throw error;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            document: data,
            message: "Document inserted successfully",
          },
          null,
          2
        ),
      },
    ],
  };
}

async function insertDocumentChunk(args) {
  const chunkData = {
    document_id: args.document_id,
    user_id: args.user_id,
    chunk_text: args.chunk_text,
    embedding: args.embedding,
    organization_id: args.organization_id || null,
  };

  const { data, error } = await supabase
    .from("document_chunks")
    .insert(chunkData)
    .select()
    .single();

  if (error) throw error;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            chunk: data,
            message: "Document chunk inserted successfully",
          },
          null,
          2
        ),
      },
    ],
  };
}

// Define available resources
server.setRequestHandler("resources/list", async () => {
  return {
    resources: [
      {
        uri: "supabase://schema",
        mimeType: "application/json",
        name: "Database Schema",
        description: "RAGv2 database schema information",
      },
      {
        uri: "supabase://stats",
        mimeType: "application/json",
        name: "Database Statistics",
        description: "Current database statistics and counts",
      },
    ],
  };
});

// Handle resource requests
server.setRequestHandler("resources/read", async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case "supabase://schema":
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                tables: {
                  documents: {
                    columns: [
                      "id",
                      "user_id",
                      "filename",
                      "content",
                      "organization_id",
                      "visibility",
                      "is_organization_document",
                      "created_at",
                    ],
                    description: "Stores uploaded documents and their metadata",
                  },
                  document_chunks: {
                    columns: [
                      "id",
                      "document_id",
                      "user_id",
                      "organization_id",
                      "chunk_text",
                      "embedding",
                      "created_at",
                    ],
                    description:
                      "Stores document chunks with embeddings for similarity search",
                  },
                  organizations: {
                    columns: ["id", "name", "description", "created_at"],
                    description: "Organization definitions",
                  },
                  organization_memberships: {
                    columns: [
                      "id",
                      "organization_id",
                      "user_id",
                      "role",
                      "created_at",
                    ],
                    description: "User memberships in organizations",
                  },
                },
              },
              null,
              2
            ),
          },
        ],
      };

    case "supabase://stats":
      const [docCount, chunkCount, orgCount] = await Promise.all([
        supabase.from("documents").select("id", { count: "exact" }),
        supabase.from("document_chunks").select("id", { count: "exact" }),
        supabase.from("organizations").select("id", { count: "exact" }),
      ]);

      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                documents: docCount.count || 0,
                chunks: chunkCount.count || 0,
                organizations: orgCount.count || 0,
                timestamp: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Supabase MCP Server running on stdio");
}

main().catch(console.error);
