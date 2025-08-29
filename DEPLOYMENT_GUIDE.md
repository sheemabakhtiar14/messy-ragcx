# RAG Application - Vercel Production Deployment Guide

## 🚀 Quick Deployment Steps

### 1. Prepare Environment Variables

Before deploying, you'll need to set up these environment variables in your Vercel dashboard:

**Required Environment Variables:**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ACCESS_TOKEN=your-access-token-here
HUGGINGFACE_API_KEY=hf_your_api_key_here
GEMINI_API_KEY=AIzaSy_your_gemini_key_here
NEXT_PUBLIC_APP_URL=https://messy-ragcx.vercel.app
NEXT_PUBLIC_API_URL=https://messy-ragcx.vercel.app/api
NODE_ENV=production
JWT_SECRET=your-jwt-secret-for-production
MCP_ENABLED=true
MCP_PORT=3000
LOG_LEVEL=info
```

### 2. Deploy to Vercel

#### Option A: Using Vercel CLI

```bash
# Install Vercel CLI if you haven't already
npm install -g vercel

# Deploy to production
npm run deploy
```

#### Option B: Using GitHub Integration

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Import the project in Vercel dashboard
4. Configure environment variables
5. Deploy automatically

### 3. Post-Deployment Configuration

After deployment, you'll receive a Vercel URL like `https://your-app.vercel.app`

**Update these values:**

1. Replace `https://your-app.vercel.app` in your environment variables with your actual Vercel URL
2. Update `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_API_URL` in Vercel settings
3. Add your Vercel domain to `next.config.ts` images domains

## 🔧 Configuration Details

### Vercel Configuration (`vercel.json`)

- ✅ API route timeouts configured (30s for queries, 60s for uploads)
- ✅ CORS headers properly set
- ✅ Regional deployment optimized
- ✅ Build optimization enabled

### Next.js Configuration (`next.config.ts`)

- ✅ Production optimizations enabled
- ✅ Security headers configured
- ✅ CORS properly configured for API routes
- ✅ Image optimization settings

### AI Agent Widget

- ✅ Dynamic API URL detection (development vs production)
- ✅ Real Supabase authentication integration
- ✅ User-specific document filtering
- ✅ Cross-domain embedding support
- ✅ Production-ready error handling

## 🔄 Complete User Flow

### 1. User Authentication

- User signs in through Supabase authentication
- JWT token stored for API access
- User-specific session management

### 2. Document Upload

- Secure file upload with user association
- Document processing and embedding generation
- Storage in user-specific database records

### 3. Platform & Element Selection

- User selects target platform for embedding
- Chooses AI agent element
- Dynamic script generation

### 4. Embeddable Code Generation

- Production-ready JavaScript widget code
- Includes authentication handling
- Cross-domain compatibility
- User-specific document access

### 5. Widget Deployment

- User copies generated script
- Embeds on their website
- Widget loads and authenticates automatically
- Responds to queries using only user's documents

## 🛡️ Security Features

- **User Isolation**: Each user can only access their own documents
- **Authentication**: JWT token validation for all API requests
- **CORS Protection**: Proper CORS headers for cross-domain requests
- **Rate Limiting**: Built-in Vercel function timeouts
- **Input Validation**: Comprehensive request validation

## 🔍 API Endpoints

### Production API Routes

- `POST /api/ask-user` - User-specific document queries (requires auth)
- `POST /api/ask-public` - Public queries (fallback)
- `POST /api/save` - Document upload and processing
- `GET /api/organizations/*` - Organization management

### Authentication

All API routes require `Authorization: Bearer <jwt-token>` header for user-specific operations.

## 📋 Pre-Deployment Checklist

- [ ] All environment variables configured in Vercel
- [ ] Supabase project properly set up
- [ ] API keys for Hugging Face and Gemini obtained
- [ ] Domain configuration updated in next.config.ts
- [ ] Database migrations completed (if any)
- [ ] Test authentication flow
- [ ] Test document upload
- [ ] Test AI agent widget generation
- [ ] Test widget embedding on external site

## 🚨 Troubleshooting

### Common Issues:

1. **Widget not loading on external sites**
   - Check CORS configuration
   - Verify API URL in generated script
   - Ensure authentication token is valid

2. **Authentication failures**
   - Verify Supabase configuration
   - Check JWT secret configuration
   - Ensure user is logged in to main app

3. **API timeouts**
   - Check Vercel function timeout settings
   - Monitor API response times
   - Consider upgrading Vercel plan if needed

## 📞 Support

If you encounter issues during deployment, check:

1. Vercel deployment logs
2. Browser console for widget errors
3. Network tab for failed API requests
4. Supabase authentication status

## 🎯 Next Steps After Deployment

1. Test the complete flow end-to-end
2. Monitor API usage and performance
3. Set up error tracking (optional)
4. Configure domain name (optional)
5. Set up CI/CD pipeline for future updates
