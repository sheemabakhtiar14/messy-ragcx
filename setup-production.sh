#!/bin/bash

# RAG Application - Production Setup Script
# This script helps you configure environment variables for Vercel deployment

echo "🚀 RAG Application - Production Setup"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "next.config.ts" ]; then
    echo "❌ Error: Please run this script from the root directory of your RAG application"
    exit 1
fi

echo "📋 This script will help you set up environment variables for production deployment."
echo ""

# Function to prompt for environment variable
prompt_for_env() {
    local var_name=$1
    local description=$2
    local example=$3
    
    echo "🔧 $var_name"
    echo "   Description: $description"
    if [ ! -z "$example" ]; then
        echo "   Example: $example"
    fi
    echo -n "   Enter value: "
    read value
    echo "$var_name=$value" >> .env.production.local
    echo ""
}

# Create production environment file
echo "Creating .env.production.local file..."
rm -f .env.production.local

echo "# Production Environment Variables - Generated $(date)" > .env.production.local
echo "# Copy these values to your Vercel project settings" >> .env.production.local
echo "" >> .env.production.local

# Supabase Configuration
echo "🔐 SUPABASE CONFIGURATION"
echo "=========================="
prompt_for_env "NEXT_PUBLIC_SUPABASE_URL" "Your Supabase project URL" "https://your-project.supabase.co"
prompt_for_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" "Your Supabase anonymous key" "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
prompt_for_env "SUPABASE_SERVICE_ROLE_KEY" "Your Supabase service role key" "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
prompt_for_env "SUPABASE_ACCESS_TOKEN" "Your Supabase access token" "sbp_..."

# AI Services
echo "🤖 AI SERVICES CONFIGURATION"
echo "============================"
prompt_for_env "HUGGINGFACE_API_KEY" "Your Hugging Face API key" "hf_..."
prompt_for_env "GEMINI_API_KEY" "Your Google Gemini API key" "AIzaSy..."

# Production URLs (to be updated after deployment)
echo "🌐 PRODUCTION URLS"
echo "=================="
echo "📝 Note: Update these after your Vercel deployment"
prompt_for_env "NEXT_PUBLIC_APP_URL" "Your Vercel app URL (update after deployment)" "https://your-app.vercel.app"
prompt_for_env "NEXT_PUBLIC_API_URL" "Your Vercel API URL (update after deployment)" "https://your-app.vercel.app/api"

# Security
echo "🔒 SECURITY CONFIGURATION"
echo "========================="
prompt_for_env "JWT_SECRET" "JWT secret for production (generate a strong random string)" "your-secure-jwt-secret-here"

# Application Settings
echo "⚙️ APPLICATION SETTINGS"
echo "======================="
echo "NODE_ENV=production" >> .env.production.local
echo "MCP_ENABLED=true" >> .env.production.local
echo "MCP_PORT=3000" >> .env.production.local
echo "LOG_LEVEL=info" >> .env.production.local

echo ""
echo "✅ Production environment file created: .env.production.local"
echo ""
echo "📋 NEXT STEPS:"
echo "=============="
echo "1. Review the generated .env.production.local file"
echo "2. Copy all variables to your Vercel project environment settings"
echo "3. Deploy to Vercel using: npm run deploy"
echo "4. Update NEXT_PUBLIC_APP_URL and NEXT_PUBLIC_API_URL with your actual Vercel URL"
echo "5. Test the complete flow end-to-end"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT_GUIDE.md"
echo ""
echo "🎉 Ready for production deployment!"