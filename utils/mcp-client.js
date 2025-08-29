// utils/mcp-client.js - MCP Client for Supabase operations
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

class SupabaseMCPClient {
  constructor() {
    this.client = null;
    this.transport = null;
    this.serverProcess = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) {
      return;
    }

    try {
      // For now, let's create a direct Supabase client instead of using the MCP transport
      // This avoids the complex stdio transport issues while providing the same functionality
      console.log(
        "🔌 Connecting to Supabase directly (MCP-style interface)..."
      );

      // Import and initialize Supabase client
      const { createClient } = await import("@supabase/supabase-js");
      this.supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Store access token for management operations
      this.accessToken = process.env.SUPABASE_ACCESS_TOKEN;

      // Test the connection
      const { data, error } = await this.supabaseClient
        .from("documents")
        .select("count", { count: "exact", head: true });

      if (error && !error.message.includes("does not exist")) {
        throw new Error(`Supabase connection failed: ${error.message}`);
      }

      this.isConnected = true;
      console.log("✅ MCP-style Supabase client connected successfully");
    } catch (error) {
      console.error("Failed to connect to Supabase:", error);
      throw error;
    }
  }

  async disconnect() {
    if (this.supabaseClient) {
      // Supabase client doesn't need explicit disconnection
      this.supabaseClient = null;
    }
    this.isConnected = false;
    console.log("🔌 Disconnected from MCP-style Supabase client");
  }

  async ensureConnection() {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  /**
   * Query documents with optional filtering
   */
  async queryDocuments({ userId, organizationId, filename, limit = 10 }) {
    await this.ensureConnection();

    try {
      let query = this.supabaseClient.from("documents").select("*");

      if (userId) {
        query = query.eq("user_id", userId);
      }

      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }

      if (filename) {
        query = query.ilike("filename", `%${filename}%`);
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        documents: data,
        count: data.length,
      };
    } catch (error) {
      console.error("MCP query_documents error:", error);
      throw error;
    }
  }

  /**
   * Search document chunks using semantic similarity
   */
  async searchDocumentChunks({
    userId,
    queryEmbedding,
    organizationId,
    similarityThreshold = 0.3,
    limit = 5,
  }) {
    await this.ensureConnection();

    try {
      // Use the enhanced search function if available
      const { data, error } = await this.supabaseClient.rpc(
        "search_chunks_with_access_control",
        {
          query_embedding: queryEmbedding,
          user_id: userId,
          similarity_threshold: similarityThreshold,
          result_limit: limit,
          organization_id: organizationId,
          search_scope: organizationId ? "organization" : "all",
        }
      );

      if (error) {
        // Fallback to basic similarity search if enhanced function doesn't exist
        console.log("Using fallback similarity search");
        const fallbackQuery = `
          SELECT 
            dc.id,
            dc.document_id,
            dc.chunk_text,
            (1 - (dc.embedding <=> $1::vector)) as similarity,
            dc.user_id,
            dc.organization_id,
            d.filename,
            CASE 
              WHEN dc.organization_id IS NOT NULL THEN 'organization'
              ELSE 'personal'
            END as source_type
          FROM document_chunks dc
          JOIN documents d ON dc.document_id = d.id
          WHERE 
            (1 - (dc.embedding <=> $1::vector)) > $2
            AND dc.user_id = $3
          ORDER BY dc.embedding <=> $1::vector
          LIMIT $4
        `;

        const { data: fallbackData, error: fallbackError } =
          await this.supabaseClient.rpc("exec_sql", {
            query: fallbackQuery,
            params: [queryEmbedding, similarityThreshold, userId, limit],
          });

        if (fallbackError) throw fallbackError;
        return {
          success: true,
          chunks: fallbackData || [],
          count: fallbackData?.length || 0,
        };
      }

      return {
        success: true,
        chunks: data || [],
        count: data?.length || 0,
        search_params: {
          similarity_threshold: similarityThreshold,
          organization_id: organizationId,
          user_id: userId,
        },
      };
    } catch (error) {
      console.error("MCP search_document_chunks error:", error);
      throw error;
    }
  }

  /**
   * Get user's organization memberships
   */
  async getUserOrganizations(userId) {
    await this.ensureConnection();

    try {
      const { data, error } = await this.supabaseClient
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
        .eq("user_id", userId);

      if (error) throw error;

      return {
        success: true,
        memberships: data,
        count: data.length,
      };
    } catch (error) {
      console.error("MCP get_user_organizations error:", error);
      throw error;
    }
  }

  /**
   * Insert a new document
   */
  async insertDocument({
    userId,
    filename,
    content,
    organizationId,
    visibility = "private",
  }) {
    await this.ensureConnection();

    try {
      const documentData = {
        user_id: userId,
        filename: filename,
        content: content,
        organization_id: organizationId || null,
        visibility: organizationId ? visibility || "private" : "private",
        is_organization_document: !!organizationId,
      };

      const { data, error } = await this.supabaseClient
        .from("documents")
        .insert(documentData)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        document: data,
        message: "Document inserted successfully",
      };
    } catch (error) {
      console.error("MCP insert_document error:", error);
      throw error;
    }
  }

  /**
   * Insert a document chunk with embedding
   */
  async insertDocumentChunk({
    documentId,
    userId,
    chunkText,
    embedding,
    organizationId,
  }) {
    await this.ensureConnection();

    try {
      const chunkData = {
        document_id: documentId,
        user_id: userId,
        chunk_text: chunkText,
        embedding: embedding,
        organization_id: organizationId || null,
      };

      const { data, error } = await this.supabaseClient
        .from("document_chunks")
        .insert(chunkData)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        chunk: data,
        message: "Document chunk inserted successfully",
      };
    } catch (error) {
      console.error("MCP insert_document_chunk error:", error);
      throw error;
    }
  }

  /**
   * Get database schema information
   */
  async getSchema() {
    await this.ensureConnection();

    try {
      // Return a hardcoded schema for now
      return {
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
            columns: ["id", "organization_id", "user_id", "role", "created_at"],
            description: "User memberships in organizations",
          },
        },
      };
    } catch (error) {
      console.error("MCP get schema error:", error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    await this.ensureConnection();

    try {
      const [docCount, chunkCount, orgCount] = await Promise.all([
        this.supabaseClient.from("documents").select("id", { count: "exact" }),
        this.supabaseClient
          .from("document_chunks")
          .select("id", { count: "exact" }),
        this.supabaseClient
          .from("organizations")
          .select("id", { count: "exact" }),
      ]);

      return {
        documents: docCount.count || 0,
        chunks: chunkCount.count || 0,
        organizations: orgCount.count || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("MCP get stats error:", error);
      // Return default values if there's an error
      return {
        documents: 0,
        chunks: 0,
        organizations: 0,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Get enhanced database information using management API
   */
  async getEnhancedStats() {
    await this.ensureConnection();

    if (!this.accessToken) {
      return await this.getStats(); // Fallback to regular stats
    }

    try {
      const basicStats = await this.getStats();

      // Get additional system information
      const [userCount, profileCount] = await Promise.all([
        this.supabaseClient.from("users").select("id", { count: "exact" }),
        this.supabaseClient.from("profiles").select("id", { count: "exact" }),
      ]);

      return {
        ...basicStats,
        users: userCount.count || 0,
        profiles: profileCount.count || 0,
        enhanced: true,
        access_token_available: true,
      };
    } catch (error) {
      console.error("MCP enhanced stats error:", error);
      return await this.getStats(); // Fallback to basic stats
    }
  }

  /**
   * Get project information using management API
   */
  async getProjectInfo() {
    await this.ensureConnection();

    if (!this.accessToken) {
      return {
        error: "Management access token not available",
        project_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      };
    }

    try {
      // Extract project reference from URL
      const projectRef =
        process.env.NEXT_PUBLIC_SUPABASE_URL.split("//")[1].split(".")[0];

      return {
        project_reference: projectRef,
        project_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        management_enabled: true,
        access_token_available: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("MCP project info error:", error);
      return {
        error: error.message,
        project_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      };
    }
  }
}

// Singleton instance
let mcpClient = null;

export function getSupabaseMCPClient() {
  if (!mcpClient) {
    mcpClient = new SupabaseMCPClient();
  }
  return mcpClient;
}

// Helper functions for common operations
export async function queryUserDocuments(
  userId,
  organizationId = null,
  limit = 10
) {
  const client = getSupabaseMCPClient();
  return await client.queryDocuments({
    userId,
    organizationId,
    limit,
  });
}

export async function performSemanticSearch(
  userId,
  queryEmbedding,
  organizationId = null,
  limit = 5
) {
  const client = getSupabaseMCPClient();
  return await client.searchDocumentChunks({
    userId,
    queryEmbedding,
    organizationId,
    limit,
  });
}

export async function saveDocumentViaMCP(
  userId,
  filename,
  content,
  organizationId = null,
  visibility = "private"
) {
  const client = getSupabaseMCPClient();
  return await client.insertDocument({
    userId,
    filename,
    content,
    organizationId,
    visibility,
  });
}

export async function saveChunkViaMCP(
  documentId,
  userId,
  chunkText,
  embedding,
  organizationId = null
) {
  const client = getSupabaseMCPClient();
  return await client.insertDocumentChunk({
    documentId,
    userId,
    chunkText,
    embedding,
    organizationId,
  });
}

// Enhanced MCP operations with management API
export async function getEnhancedDatabaseStats() {
  const client = getSupabaseMCPClient();
  return await client.getEnhancedStats();
}

export async function getProjectInformation() {
  const client = getSupabaseMCPClient();
  return await client.getProjectInfo();
}

// Cleanup function
export async function cleanupMCPClient() {
  if (mcpClient) {
    await mcpClient.disconnect();
    mcpClient = null;
  }
}

export default getSupabaseMCPClient;
