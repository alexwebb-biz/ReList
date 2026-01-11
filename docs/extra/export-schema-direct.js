/**
 * Export Supabase schema - gets table structure directly from your tables
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const KNOWN_TABLES = [
  'users', 'alerts', 'alert_results', 'inventory', 'listings',
  'watched_items', 'price_history', 'notifications', 'user_goals',
  'ai_enhancements', 'scraping_jobs'
];

async function exportSchema() {
  console.log('🔍 Connecting to Supabase...');
  console.log(`📡 URL: ${supabaseUrl}\n`);

  try {
    console.log('⚠️  Note: This will create a BASIC schema based on your table data.');
    console.log('For a complete schema with all constraints, use Supabase Dashboard:\n');
    console.log('1. Go to: https://app.supabase.com/project/rtxgyvythaqmwfwlhcpv/editor');
    console.log('2. Click SQL Editor');
    console.log('3. Run: SELECT column_name, data_type, is_nullable, column_default');
    console.log('         FROM information_schema.columns');
    console.log('         WHERE table_schema = \'public\' ORDER BY table_name, ordinal_position;');
    console.log('4. Copy output and paste here\n');

    console.log('OR use the schema file you already shared earlier!\n');

    console.log('📋 Fetching data from your tables to detect structure...\n');

    let detectedSchema = '';

    for (const tableName of KNOWN_TABLES) {
      console.log(`🔍 Checking ${tableName}...`);

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`   ⚠️  Could not access: ${error.message}`);
        continue;
      }

      console.log(`   ✅ Found table: ${tableName}`);

      if (data && data.length > 0) {
        const sample = data[0];
        const columns = Object.keys(sample);
        detectedSchema += `\n-- Table: ${tableName}\n`;
        detectedSchema += `-- Detected columns: ${columns.join(', ')}\n`;
      }
    }

    console.log('\n📝 Detected schema structure:\n');
    console.log(detectedSchema);

    console.log('\n⚠️  RECOMMENDATION:');
    console.log('Since we cannot export the full schema automatically, please:');
    console.log('\n1. Use the schema file from docker/init-db/001_schema.sql you shared earlier');
    console.log('2. Or run this SQL query in Supabase Dashboard and send me the output:\n');
    console.log('SELECT');
    console.log('  table_name,');
    console.log('  column_name,');
    console.log('  data_type,');
    console.log('  character_maximum_length,');
    console.log('  is_nullable,');
    console.log('  column_default');
    console.log('FROM information_schema.columns');
    console.log('WHERE table_schema = \'public\'');
    console.log('  AND table_name NOT LIKE \'pg_%\'');
    console.log('ORDER BY table_name, ordinal_position;');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

exportSchema();
