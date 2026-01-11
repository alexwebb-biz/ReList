# JWT Authentication Fix for Docker Deployment

## Problem
The app was experiencing JWT authentication errors when trying to login:
```
Expected 3 parts in JWT; got 1
```

## Root Cause
PostgREST was configured to validate JWT tokens, but the app uses a custom JWT-based authentication system (not Supabase Auth). The Supabase client was sending the `JWT_SECRET` environment variable as the service key, which PostgREST tried to validate as a JWT token.

## Solution
Disabled JWT validation in PostgREST for local development since:
1. The app implements its own JWT authentication at the Express server level
2. PostgREST is only used as a Supabase-compatible database REST API layer
3. Authentication happens in the backend server, not at the PostgREST level

## Changes Made

### 1. [docker-compose.yml](docker-compose.yml)
**PostgREST service (lines 40-60)**:
- ✅ Removed `PGRST_JWT_SECRET` - no JWT validation needed
- ✅ Kept `PGRST_OPENAPI_MODE: "ignore-privileges"` - allows all database operations
- Comment added explaining no JWT validation required

**Server service (line 99)**:
- Changed `SUPABASE_SERVICE_KEY` from `${JWT_SECRET}` to `anonymous`
- This prevents PostgREST from trying to validate the service key as a JWT

### 2. [server/src/config/supabase.ts](server/src/config/supabase.ts)
- Made `SUPABASE_SERVICE_KEY` optional (defaults to 'anonymous')
- Simplified error message to only require `SUPABASE_URL`

## How to Apply the Fix

1. **Stop all containers**:
   ```bash
   docker compose down
   ```

2. **Rebuild and restart**:
   ```bash
   docker compose up -d --build
   ```

3. **Test authentication**:
   - Open http://localhost
   - Try to signup/login
   - Authentication should now work without JWT errors

## How Authentication Works Now

```
┌─────────────┐
│   Frontend  │
│ (localhost) │
└──────┬──────┘
       │ POST /api/auth/login
       │ { email, password }
       ▼
┌─────────────┐
│   Server    │  ← Custom JWT auth (middleware/auth.ts)
│  (port 3000)│
└──────┬──────┘
       │ Supabase Client Query
       │ No JWT required
       ▼
┌─────────────┐
│  PostgREST  │  ← No JWT validation (open for server)
│  (port 3001)│
└──────┬──────┘
       │ SQL Query
       ▼
┌─────────────┐
│ PostgreSQL  │
│  (port 5432)│
└─────────────┘
```

1. **Frontend** sends login request to **Server**
2. **Server** validates credentials and generates its own JWT tokens
3. **Server** uses Supabase client to query **PostgREST** (no auth required)
4. **PostgREST** forwards SQL queries to **PostgreSQL**
5. **Server** returns JWT token to **Frontend**
6. **Frontend** includes JWT in subsequent requests
7. **Server** validates JWT using its own middleware

## Security Note
This configuration is for **local development only**. For production:
- Use proper Supabase cloud with RLS (Row Level Security)
- Or implement JWT validation in PostgREST matching your auth system
- Or use direct PostgreSQL connections with connection pooling
