import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('=========================================');
  console.error('ERROR: Missing Supabase configuration!');
  console.error('=========================================');
  console.error('SUPABASE_URL:', supabaseUrl ? 'set' : 'NOT SET');
  console.error('SUPABASE_SERVICE_KEY:', supabaseServiceKey ? 'set' : 'NOT SET');
  console.error('');
  console.error('Make sure .env.local has your Supabase credentials');
  throw new Error('Missing Supabase environment variables');
}

console.log('✅ Database: Using Supabase Cloud');
console.log(`📡 URL: ${supabaseUrl}`);

// Service role client for backend operations
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default supabase;
