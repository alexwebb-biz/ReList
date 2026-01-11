/**
 * Database Configuration
 * Provides a Supabase-compatible interface for PostgreSQL
 * This allows switching between Supabase and local PostgreSQL
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Check if we're using Supabase or local PostgreSQL
const isUsingSupabase = process.env.SUPABASE_URL?.includes('supabase.co');
const databaseUrl = process.env.DATABASE_URL;

let supabase: SupabaseClient;

if (isUsingSupabase) {
  // Use Supabase client
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('Using Supabase database');
} else if (databaseUrl) {
  // Use Supabase client with local PostgreSQL via Supabase local/self-hosted
  // For local dev, we use supabase-js with a REST API layer or direct connection

  // If using Docker with standard PostgreSQL, we need to use pg directly
  // But to minimize code changes, we'll configure Supabase to work with local PG

  // Option 1: Use Supabase with local PostgreSQL REST API (requires supabase local)
  // Option 2: Use a compatibility layer

  const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'local-dev-key';

  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
  });

  console.log('Using local PostgreSQL database');
} else {
  throw new Error('No database configuration found. Set SUPABASE_URL or DATABASE_URL');
}

export { supabase };
export default supabase;
