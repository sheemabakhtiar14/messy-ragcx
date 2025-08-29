-- RAGv2 Database Schema for Supabase
-- This schema supports document storage, chunking, embeddings, and organization-based access control

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization memberships table
CREATE TABLE IF NOT EXISTS organization_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- References auth.users but without FK constraint for flexibility
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- member, admin, owner
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- References auth.users
    filename VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    visibility VARCHAR(50) DEFAULT 'private', -- private, organization, public
    is_organization_document BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document chunks table with vector embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- References auth.users
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(1536), -- OpenAI/Hugging Face embedding dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_organization_id ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_visibility ON documents(visibility);
CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents(filename);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id ON document_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_organization_id ON document_chunks(organization_id);

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_organization_memberships_user_id ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_organization_id ON organization_memberships(organization_id);

-- RPC function for semantic search
CREATE OR REPLACE FUNCTION search_document_chunks(
    query_embedding vector(1536),
    similarity_threshold float DEFAULT 0.3,
    result_limit int DEFAULT 5,
    user_id uuid DEFAULT NULL,
    organization_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    chunk_text text,
    similarity float,
    user_id uuid,
    organization_id uuid,
    filename text,
    source_type text
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dc.id,
        dc.document_id,
        dc.chunk_text,
        (1 - (dc.embedding <=> query_embedding)) as similarity,
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
        (1 - (dc.embedding <=> query_embedding)) > similarity_threshold
        AND (
            user_id IS NULL OR 
            dc.user_id = search_document_chunks.user_id OR
            (
                organization_id IS NOT NULL AND 
                dc.organization_id = search_document_chunks.organization_id
            )
        )
    ORDER BY dc.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$;

-- Enhanced search function with organization access control
CREATE OR REPLACE FUNCTION search_chunks_with_access_control(
    query_embedding vector(1536),
    user_id uuid,
    similarity_threshold float DEFAULT 0.3,
    result_limit int DEFAULT 5,
    organization_id uuid DEFAULT NULL,
    search_scope text DEFAULT 'all' -- 'all', 'personal', 'organization'
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    chunk_text text,
    similarity float,
    user_id uuid,
    organization_id uuid,
    filename text,
    source_type text,
    access_type text
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dc.id,
        dc.document_id,
        dc.chunk_text,
        (1 - (dc.embedding <=> query_embedding)) as similarity,
        dc.user_id,
        dc.organization_id,
        d.filename,
        CASE 
            WHEN dc.organization_id IS NOT NULL THEN 'organization'
            ELSE 'personal'
        END as source_type,
        CASE 
            WHEN dc.user_id = search_chunks_with_access_control.user_id THEN 'owned'
            WHEN dc.organization_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM organization_memberships om 
                WHERE om.user_id = search_chunks_with_access_control.user_id 
                AND om.organization_id = dc.organization_id
            ) THEN 'organization_member'
            ELSE 'no_access'
        END as access_type
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE 
        (1 - (dc.embedding <=> query_embedding)) > similarity_threshold
        AND (
            -- User's own documents
            dc.user_id = search_chunks_with_access_control.user_id
            OR 
            -- Organization documents where user is a member
            (
                dc.organization_id IS NOT NULL AND 
                EXISTS (
                    SELECT 1 FROM organization_memberships om 
                    WHERE om.user_id = search_chunks_with_access_control.user_id 
                    AND om.organization_id = dc.organization_id
                )
            )
        )
        AND (
            search_scope = 'all' OR
            (search_scope = 'personal' AND dc.organization_id IS NULL) OR
            (search_scope = 'organization' AND dc.organization_id IS NOT NULL AND (
                organization_id IS NULL OR dc.organization_id = search_chunks_with_access_control.organization_id
            ))
        )
    ORDER BY dc.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$;

-- Update trigger for documents
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_documents_updated_at();

-- Row Level Security (RLS) policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;

-- Documents policies
CREATE POLICY "Users can view their own documents" ON documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view organization documents they have access to" ON documents
    FOR SELECT USING (
        organization_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM organization_memberships 
            WHERE user_id = auth.uid() AND organization_id = documents.organization_id
        )
    );

CREATE POLICY "Users can insert their own documents" ON documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" ON documents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" ON documents
    FOR DELETE USING (auth.uid() = user_id);

-- Document chunks policies
CREATE POLICY "Users can view their own document chunks" ON document_chunks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view organization document chunks they have access to" ON document_chunks
    FOR SELECT USING (
        organization_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM organization_memberships 
            WHERE user_id = auth.uid() AND organization_id = document_chunks.organization_id
        )
    );

CREATE POLICY "Users can insert their own document chunks" ON document_chunks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own document chunks" ON document_chunks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own document chunks" ON document_chunks
    FOR DELETE USING (auth.uid() = user_id);

-- Organization policies
CREATE POLICY "Users can view organizations they belong to" ON organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_memberships 
            WHERE user_id = auth.uid() AND organization_id = organizations.id
        )
    );

-- Organization memberships policies
CREATE POLICY "Users can view their own memberships" ON organization_memberships
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Organization admins can view all memberships" ON organization_memberships
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_memberships om
            WHERE om.user_id = auth.uid() 
            AND om.organization_id = organization_memberships.organization_id
            AND om.role IN ('admin', 'owner')
        )
    );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;