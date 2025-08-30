# 🌐 Cross-Domain Widget Authentication Solution

## 🎯 **Problem Solved**

**Issue**: Widget tokens were stored in `localStorage`, which is domain-isolated by browser security. This meant widgets couldn't authenticate on external domains even though they were authorized.

**Solution**: Database-stored persistent widget tokens that can be retrieved via API calls, eliminating localStorage dependency for cross-domain scenarios.

## ✅ **Complete Solution Implementation**

### **1. Database Schema Enhancement**

Added `widget_token` column to `widget_configurations` table:

```sql
ALTER TABLE widget_configurations ADD COLUMN widget_token TEXT;
CREATE INDEX idx_widget_configurations_widget_token ON widget_configurations(widget_token);
```

### **2. Token Generation & Storage**

**Enhanced `/api/save-domain-config.js`:**

- Generates unique persistent widget tokens for each configuration
- Stores tokens securely in database alongside domain restrictions
- Tokens contain: userId, email, configId, allowed domains, expiration (1 year)

**Token Structure:**

```json
{
  "userId": "user-uuid",
  "email": "user@example.com",
  "type": "persistent_widget",
  "configId": "config-uuid",
  "domains": ["example.com", "sub.example.com"],
  "iat": 1234567890,
  "exp": 1234567890
}
```

### **3. Cross-Domain Token Retrieval**

**New API: `/api/get-widget-token.js`**

- Validates requesting domain against stored allowed domains
- Returns persistent widget token for authorized domains
- Includes token expiration checking and auto-renewal
- Secure: Only works for domains explicitly authorized by user

**Usage:**

```javascript
GET /api/get-widget-token?configId=uuid&domain=example.com
```

### **4. Enhanced Widget Script Generation**

**Updated Widget Authentication Flow:**

1. **Primary Method**: Retrieve persistent token from database via configId
2. **Fallback 1**: Use cached localStorage token (domain-specific)
3. **Fallback 2**: Traditional Supabase token exchange (same-domain only)
4. **Fallback 3**: User guidance for cross-domain authentication

**Key Features:**

- Embeds `configId` directly in generated script
- Domain validation happens before token retrieval
- Multiple fallback methods ensure maximum compatibility
- Clear user guidance for authentication issues

### **5. API Authentication Support**

**Enhanced `/api/ask-user.js`:**

- Supports both regular widget tokens and persistent widget tokens
- Validates `persistent_widget` token type
- Maintains all existing security measures
- Logs authentication method for debugging

## 🚀 **How It Works**

### **Setup Flow (One-time per configuration)**

1. User creates widget configuration with allowed domains
2. System generates unique persistent widget token
3. Token stored in database linked to configuration
4. Generated script includes configId for token retrieval

### **Runtime Flow (Every widget load)**

1. Widget script loads on external domain
2. Domain validation ensures authorization
3. Widget calls `/api/get-widget-token` with configId and domain
4. API validates domain and returns persistent token
5. Widget uses token for all subsequent API calls
6. Token cached in domain-specific localStorage for performance

### **Cross-Domain Authentication Process**

```
External Domain → Widget Script → GET /api/get-widget-token
                      ↓
                Domain Validation ✓
                      ↓
                Persistent Token Retrieved
                      ↓
                Widget Authenticated ✅
                      ↓
                API Calls Work Normally
```

## 🔐 **Security Features**

### **Domain Validation**

- Each token retrieval validates requesting domain
- Only pre-authorized domains can get tokens
- Prevents unauthorized widget usage

### **Token Security**

- Persistent tokens contain NO Supabase secrets
- Limited scope: only user ID and email
- Automatic expiration (1 year, configurable)
- Stored securely in database with RLS policies

### **Multiple Authentication Layers**

- Database-level user isolation (RLS policies)
- API-level user validation
- Domain-level access control
- Token-level authentication

## 📊 **Benefits**

### **✅ Cross-Domain Compatibility**

- Works on ANY authorized external domain
- No localStorage dependency
- Eliminates browser security restrictions

### **✅ Enhanced Security**

- User can control exactly which domains can use their widget
- Tokens automatically expire
- No sensitive authentication data exposed

### **✅ Improved User Experience**

- Seamless authentication across domains
- Clear error messages and guidance
- Automatic token caching for performance

### **✅ Backward Compatibility**

- Existing same-domain widgets continue working
- Multiple authentication methods supported
- Graceful fallbacks for edge cases

## 🧪 **Testing the Solution**

### **1. Generate Widget with Cross-Domain Token**

1. Go to `https://messy-ragcx.vercel.app`
2. Sign in and upload documents
3. Create widget: Platform → AI Agent → Add domains → Generate script
4. Copy the generated script (includes configId)

### **2. Test on External Domain**

1. Create simple HTML file with copied script
2. Host on different domain (or localhost with different port)
3. Widget should automatically authenticate via persistent token
4. Test queries - should work normally

### **3. Verify Security**

1. Check browser dev tools - no Supabase tokens visible
2. Only see safe widget tokens in localStorage
3. Network requests show persistent token usage
4. Try unauthorized domain - should be blocked

## 🔍 **Debugging & Monitoring**

### **Console Logging**

- Widget logs authentication method used
- API logs token validation and user info
- Clear error messages for failed authentications

### **Token Status Verification**

```sql
SELECT id, user_id, platform, element,
       CASE WHEN widget_token IS NOT NULL THEN 'HAS_TOKEN' ELSE 'NO_TOKEN' END as token_status,
       allowed_domains, created_at
FROM widget_configurations
WHERE user_id = 'your-user-uuid'
ORDER BY created_at DESC;
```

## 📋 **Migration Checklist**

- [x] Add `widget_token` column to database
- [x] Update `save-domain-config.js` to generate tokens
- [x] Create `get-widget-token.js` API endpoint
- [x] Enhance widget script generation with configId
- [x] Update widget authentication flow
- [x] Add persistent token support to `ask-user.js`
- [x] Create migration SQL script
- [x] Add comprehensive error handling
- [x] Update documentation

## 🎉 **Result**

Your AI widget now works seamlessly on external domains while maintaining:

- ✅ **Complete Security**: No Supabase secrets exposed
- ✅ **User Control**: Domain restrictions enforced
- ✅ **Cross-Domain**: Works anywhere you authorize
- ✅ **Performance**: Token caching for speed
- ✅ **Reliability**: Multiple fallback methods

**The localStorage cross-domain limitation is now completely resolved!** 🚀
