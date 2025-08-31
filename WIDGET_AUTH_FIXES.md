# Widget Authentication Fixes

This document summarizes the fixes implemented to resolve the widget authentication issues.

## Issues Identified

1. **Token Initialization Issue**: The widget was assigning a Promise to `config.userToken` instead of waiting for the token to resolve
2. **Domain Mismatch Issue**: The widget script was generated for `frontdoor-friend.lovable.app` but loaded on `splash-stage-creator.lovable.app`

## Fixes Implemented

### 1. Token Initialization Fix

**Problem**:

```javascript
// This was assigning a Promise to config.userToken
config.userToken = getUserToken();
```

**Solution**:

```javascript
// Initialize as null and get token when needed
config.userToken = null;
```

**Enhanced sendMessage Function**:
Updated the [sendMessage](file://c:\Users\sheema%20bakhtiar\ragv2\pages\index.js#L1774-L1873) function to properly await the token before using it:

```javascript
async function sendMessage(question) {
  if (isLoading || !question.trim()) return;

  // Get token if not available
  if (!config.userToken) {
    console.log("🔄 Refreshing authentication token...");
    config.userToken = await getUserToken();
    // ... additional token retrieval logic
  }

  // ... rest of the function
}
```

### 2. Domain Management Enhancement

**New API Endpoint**: Created `/api/update-domain-config.js` to allow adding new domains to existing configurations

**Key Features**:

- Validates user ownership of configuration
- Checks domain format validity
- Prevents duplicate domains
- Updates the widget configuration in the database

**Usage**:

```bash
curl -X PUT \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -d '{
    "configId": "7d1a3738-6c0d-4953-bb01-d60e8acdccf9",
    "newDomain": "splash-stage-creator.lovable.app"
  }' \
  https://messy-ragcx.vercel.app/api/update-domain-config
```

### 3. Frontend Integration

Added a new function [addDomainToConfiguration](file://c:\Users\sheema%20bakhtiar\ragv2\pages\index.js#L1981-L2004) to the frontend to make it easier to add domains:

```javascript
const addDomainToConfiguration = async (configId, newDomain) => {
  try {
    const response = await fetch("/api/update-domain-config", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        configId,
        newDomain,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      return {
        success: true,
        message: result.message,
        allowedDomains: result.allowedDomains,
      };
    } else {
      return { success: false, error: result.error || "Failed to add domain" };
    }
  } catch (error) {
    return { success: false, error: "Network error. Please try again." };
  }
};
```

## Testing the Fixes

1. **Token Fix Verification**:
   - The widget should now properly await token resolution before making API calls
   - No more "Bearer [Promise object]" in authorization headers
   - Proper 401 handling with token refresh

2. **Domain Fix Verification**:
   - After adding `splash-stage-creator.lovable.app` to the allowed domains, the widget should load properly
   - Domain validation should pass and the widget should initialize correctly

## Files Modified

1. `pages/index.js` - Fixed token initialization and added domain management function
2. `pages/api/update-domain-config.js` - New API endpoint for domain management
3. `vercel.json` - Added timeout configuration for the new API endpoint

## How to Apply the Fixes

1. **For the token issue**:
   - The changes to `pages/index.js` are already implemented
   - No additional steps needed

2. **For the domain issue**:
   - Use the new API endpoint to add `splash-stage-creator.lovable.app` to your widget configuration:
     ```bash
     curl -X PUT \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
       -d '{
         "configId": "7d1a3738-6c0d-4953-bb01-d60e8acdccf9",
         "newDomain": "splash-stage-creator.lovable.app"
       }' \
       https://messy-ragcx.vercel.app/api/update-domain-config
     ```
   - Or use the frontend function [addDomainToConfiguration](file://c:\Users\sheema%20bakhtiar\ragv2\pages\index.js#L1981-L2004) if integrating into the UI

After applying these fixes, your widget should work correctly on both `frontdoor-friend.lovable.app` and `splash-stage-creator.lovable.app`.

## Production Deployment Notes

1. **Vercel Configuration**: The `vercel.json` file has been updated to include proper timeout configuration for the new API endpoint.

2. **Environment Variables**: The [WIDGET_SECRET](file://c:\Users\sheema%20bakhtiar\ragv2.env#L7) environment variable is already properly configured for production use.

3. **API URL Detection**: The widget script automatically detects the production API URL (`https://messy-ragcx.vercel.app`) when running in production environments.

4. **Cross-Domain Authentication**: The persistent widget token system works seamlessly in production, allowing widgets to authenticate across different domains as long as they are added to the allowed domains list.
