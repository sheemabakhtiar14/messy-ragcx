@echo off
setlocal enabledelayedexpansion

REM RAG Application - Production Setup Script (Windows)
REM This script helps you configure environment variables for Vercel deployment

echo 🚀 RAG Application - Production Setup
echo ======================================
echo.

REM Check if we're in the right directory
if not exist "next.config.ts" (
    echo ❌ Error: Please run this script from the root directory of your RAG application
    pause
    exit /b 1
)

echo 📋 This script will help you set up environment variables for production deployment.
echo.

REM Create production environment file
echo Creating .env.production.local file...
if exist ".env.production.local" del ".env.production.local"

echo # Production Environment Variables - Generated %date% %time% > .env.production.local
echo # Copy these values to your Vercel project settings >> .env.production.local
echo. >> .env.production.local

REM Supabase Configuration
echo 🔐 SUPABASE CONFIGURATION
echo ==========================
echo.

echo 🔧 NEXT_PUBLIC_SUPABASE_URL
echo    Description: Your Supabase project URL
echo    Example: https://your-project.supabase.co
set /p SUPABASE_URL="   Enter value: "
echo NEXT_PUBLIC_SUPABASE_URL=!SUPABASE_URL! >> .env.production.local
echo.

echo 🔧 NEXT_PUBLIC_SUPABASE_ANON_KEY
echo    Description: Your Supabase anonymous key
echo    Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
set /p SUPABASE_ANON="   Enter value: "
echo NEXT_PUBLIC_SUPABASE_ANON_KEY=!SUPABASE_ANON! >> .env.production.local
echo.

echo 🔧 SUPABASE_SERVICE_ROLE_KEY
echo    Description: Your Supabase service role key
echo    Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
set /p SUPABASE_SERVICE="   Enter value: "
echo SUPABASE_SERVICE_ROLE_KEY=!SUPABASE_SERVICE! >> .env.production.local
echo.

echo 🔧 SUPABASE_ACCESS_TOKEN
echo    Description: Your Supabase access token
echo    Example: sbp_...
set /p SUPABASE_TOKEN="   Enter value: "
echo SUPABASE_ACCESS_TOKEN=!SUPABASE_TOKEN! >> .env.production.local
echo.

REM AI Services
echo 🤖 AI SERVICES CONFIGURATION
echo ============================
echo.

echo 🔧 HUGGINGFACE_API_KEY
echo    Description: Your Hugging Face API key
echo    Example: hf_...
set /p HF_KEY="   Enter value: "
echo HUGGINGFACE_API_KEY=!HF_KEY! >> .env.production.local
echo.

echo 🔧 GEMINI_API_KEY
echo    Description: Your Google Gemini API key
echo    Example: AIzaSy...
set /p GEMINI_KEY="   Enter value: "
echo GEMINI_API_KEY=!GEMINI_KEY! >> .env.production.local
echo.

REM Production URLs
echo 🌐 PRODUCTION URLS
echo ==================
echo 📝 Note: Update these after your Vercel deployment
echo.

echo 🔧 NEXT_PUBLIC_APP_URL
echo    Description: Your Vercel app URL (update after deployment)
echo    Example: https://your-app.vercel.app
set /p APP_URL="   Enter value: "
echo NEXT_PUBLIC_APP_URL=!APP_URL! >> .env.production.local
echo.

echo 🔧 NEXT_PUBLIC_API_URL
echo    Description: Your Vercel API URL (update after deployment)
echo    Example: https://your-app.vercel.app/api
set /p API_URL="   Enter value: "
echo NEXT_PUBLIC_API_URL=!API_URL! >> .env.production.local
echo.

REM Security
echo 🔒 SECURITY CONFIGURATION
echo =========================
echo.

echo 🔧 JWT_SECRET
echo    Description: JWT secret for production (generate a strong random string)
echo    Example: your-secure-jwt-secret-here
set /p JWT_SECRET="   Enter value: "
echo JWT_SECRET=!JWT_SECRET! >> .env.production.local
echo.

REM Application Settings
echo NODE_ENV=production >> .env.production.local
echo MCP_ENABLED=true >> .env.production.local
echo MCP_PORT=3000 >> .env.production.local
echo LOG_LEVEL=info >> .env.production.local

echo.
echo ✅ Production environment file created: .env.production.local
echo.
echo 📋 NEXT STEPS:
echo ==============
echo 1. Review the generated .env.production.local file
echo 2. Copy all variables to your Vercel project environment settings
echo 3. Deploy to Vercel using: npm run deploy
echo 4. Update NEXT_PUBLIC_APP_URL and NEXT_PUBLIC_API_URL with your actual Vercel URL
echo 5. Test the complete flow end-to-end
echo.
echo 📖 For detailed instructions, see DEPLOYMENT_GUIDE.md
echo.
echo 🎉 Ready for production deployment!
echo.
pause