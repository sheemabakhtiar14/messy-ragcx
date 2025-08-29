// MCP Configuration for RAGv2 Project
export const mcpConfig = {
  // MCP Server Configuration
  server: {
    name: "supabase-rag-server",
    version: "1.0.0",
    enabled: process.env.MCP_ENABLED !== "false", // Enable by default, disable with env var
    port: process.env.MCP_PORT || 3001,
    stdio: true, // Use stdio transport by default
  },

  // Database Configuration
  database: {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      accessToken: process.env.SUPABASE_ACCESS_TOKEN,
      // Connection pool settings
      pool: {
        min: 1,
        max: 10,
      },
    },
  },

  // AI/ML Configuration
  ai: {
    huggingface: {
      apiKey: process.env.HUGGINGFACE_API_KEY,
      embeddingModel: "sentence-transformers/all-MiniLM-L6-v2",
      textGenerationModel: "microsoft/DialoGPT-medium",
      embeddingDimensions: 384, // all-MiniLM-L6-v2 dimensions
    },
    chunking: {
      maxChunkSize: 1000,
      overlap: 200,
      minChunkSize: 10,
    },
    search: {
      defaultSimilarityThreshold: 0.3,
      maxResults: 5,
      contextWindowSize: 4000,
    },
  },

  // MCP Client Configuration
  client: {
    timeout: 30000, // 30 seconds
    retries: 3,
    retryDelay: 1000, // 1 second
    autoReconnect: true,
  },

  // Feature Flags
  features: {
    enhancedSearch: true,
    organizationSupport: true,
    semanticChunking: true,
    contextAssembly: true,
    accessControl: true,
  },

  // Logging Configuration
  logging: {
    enabled: process.env.NODE_ENV !== "production",
    level: process.env.LOG_LEVEL || "info", // error, warn, info, debug
    mcpOperations: true,
    databaseQueries: false,
    aiOperations: true,
  },

  // Performance Configuration
  performance: {
    caching: {
      enabled: true,
      embeddings: {
        ttl: 3600000, // 1 hour
        maxSize: 1000,
      },
      documents: {
        ttl: 1800000, // 30 minutes
        maxSize: 500,
      },
    },
    batching: {
      enabled: true,
      chunkProcessing: 5,
      embeddingGeneration: 3,
    },
  },

  // Security Configuration
  security: {
    rowLevelSecurity: true,
    organizationIsolation: true,
    userAccessValidation: true,
    sanitizeInputs: true,
  },
};

// Helper functions for configuration
export function isMCPEnabled() {
  return mcpConfig.server.enabled;
}

export function getEmbeddingModel() {
  return mcpConfig.ai.huggingface.embeddingModel;
}

export function getSearchThreshold() {
  return mcpConfig.ai.search.defaultSimilarityThreshold;
}

export function getChunkingConfig() {
  return mcpConfig.ai.chunking;
}

export function shouldLog(operation) {
  if (!mcpConfig.logging.enabled) return false;

  switch (operation) {
    case "mcp":
      return mcpConfig.logging.mcpOperations;
    case "database":
      return mcpConfig.logging.databaseQueries;
    case "ai":
      return mcpConfig.logging.aiOperations;
    default:
      return true;
  }
}

export default mcpConfig;
