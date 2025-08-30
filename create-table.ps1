# PowerShell script to create widget_configurations table via Supabase API
# Using service role key for administrative access

$supabaseUrl = "https://vpqjrrbosaedeydqwhkf.supabase.co"
$serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwcWpycmJvc2FlZGV5ZHF3aGtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjI5MDc4NCwiZXhwIjoyMDcxODY2Nzg0fQ.1pItbjiG5BOPkQgcVrJg-hF13kvNddjbmZ2YsStRPys"

Write-Host "🗄️ Creating widget_configurations table via Supabase API..." -ForegroundColor Blue

# First test if table exists by trying to query it
$headers = @{
    "Authorization" = "Bearer $serviceRoleKey"
    "apikey" = $serviceRoleKey
    "Content-Type" = "application/json"
}

try {
    $testResponse = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/widget_configurations?select=count`&limit=1" -Method GET -Headers $headers -ErrorAction Stop
    Write-Host "✅ widget_configurations table already exists!" -ForegroundColor Green
    Write-Host "🎉 Domain restriction feature is ready to use!" -ForegroundColor Green
    exit 0
}
catch {
    Write-Host "⚠️ Table doesn't exist (expected), proceeding with creation..." -ForegroundColor Yellow
}

# The SQL for creating the table (simplified version without dependencies)
$createTableSQL = @'
CREATE TABLE IF NOT EXISTS widget_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    organization_id UUID DEFAULT NULL,
    platform VARCHAR(50) NOT NULL,
    element VARCHAR(50) NOT NULL,
    allowed_domains JSONB NOT NULL DEFAULT ''[]'',
    configuration_data JSONB DEFAULT ''{}'',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_widget_configurations_user_id ON widget_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_organization_id ON widget_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_platform_element ON widget_configurations(platform, element);
CREATE INDEX IF NOT EXISTS idx_widget_configurations_active ON widget_configurations(is_active);

ALTER TABLE widget_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own widget configurations" ON widget_configurations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own widget configurations" ON widget_configurations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own widget configurations" ON widget_configurations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own widget configurations" ON widget_configurations
    FOR DELETE USING (auth.uid() = user_id);
'@

# Try to execute SQL via RPC (this may or may not work)
$body = @{
    sql = $createTableSQL
} | ConvertTo-Json

try {
    Write-Host "🔧 Attempting to execute SQL via RPC..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/exec_sql" -Method POST -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "✅ Table created successfully via RPC!" -ForegroundColor Green
}
catch {
    Write-Host "❌ RPC method failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "📋 Manual setup required. Please:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://supabase.com/dashboard/project/vpqjrrbosaedeydqwhkf/sql/new" -ForegroundColor Cyan
    Write-Host "2. Copy the SQL from widget-configurations-migration.sql" -ForegroundColor Cyan
    Write-Host "3. Paste and run it in the SQL Editor" -ForegroundColor Cyan
    exit 1
}

# Verify table creation
try {
    $verifyResponse = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/widget_configurations?select=count`&limit=1" -Method GET -Headers $headers -ErrorAction Stop
    Write-Host "✅ Table verification successful!" -ForegroundColor Green
    Write-Host "🎉 Domain restriction feature is now ready!" -ForegroundColor Green
    Write-Host "🚀 Next steps: Run npm run dev to test the feature" -ForegroundColor Cyan
}
catch {
    Write-Host "❌ Table verification failed" -ForegroundColor Red
    Write-Host "📋 Please create the table manually using the Supabase dashboard" -ForegroundColor Yellow
    exit 1
}