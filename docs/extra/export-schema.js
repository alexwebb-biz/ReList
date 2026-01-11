/**
 * Export complete Supabase schema to SQL file using CLI
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const execAsync = promisify(exec);

// Load environment variables
dotenv.config({ path: '.env.local' });

const projectRef = process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ Could not extract project reference from SUPABASE_URL');
  console.error('Expected format: https://PROJECT_REF.supabase.co');
  process.exit(1);
}

async function checkSupabaseCLI() {
  try {
    await execAsync('supabase --version');
    return true;
  } catch {
    return false;
  }
}

async function exportSchema() {
  console.log('🔍 Checking for Supabase CLI...\n');

  const hasSupabase = await checkSupabaseCLI();

  if (!hasSupabase) {
    console.log('❌ Supabase CLI not found. Installing...\n');
    console.log('Running: npm install -g supabase\n');

    try {
      const { stdout } = await execAsync('npm install -g supabase');
      console.log(stdout);
      console.log('✅ Supabase CLI installed!\n');
    } catch (error) {
      console.error('❌ Failed to install Supabase CLI');
      console.error('Please install manually: npm install -g supabase');
      process.exit(1);
    }
  } else {
    console.log('✅ Supabase CLI found\n');
  }

  console.log(`📡 Project Reference: ${projectRef}`);
  console.log('🔐 You may be prompted to login to Supabase...\n');

  try {
    // Try to link to the project
    console.log('🔗 Linking to Supabase project...\n');
    try {
      const { stdout: linkOut } = await execAsync(`supabase link --project-ref ${projectRef}`);
      console.log(linkOut);
    } catch (linkError) {
      // Link might fail if not logged in
      console.log('⚠️  Link failed. Attempting login...\n');
      console.log('Please follow the browser prompts to login to Supabase\n');

      const { stdout: loginOut } = await execAsync('supabase login');
      console.log(loginOut);

      // Try link again
      const { stdout: linkOut2 } = await execAsync(`supabase link --project-ref ${projectRef}`);
      console.log(linkOut2);
    }

    // Export schema
    console.log('\n📥 Exporting schema from Supabase...\n');

    const outputPath = path.join(process.cwd(), 'docker', 'init-db', '001_schema_supabase.sql');

    const { stdout, stderr } = await execAsync(
      `supabase db dump --schema public --file "${outputPath}"`
    );

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    // Check if file was created
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log('\n✅ Schema exported successfully!');
      console.log(`📄 File: ${outputPath}`);
      console.log(`📦 Size: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log('\n🎯 Next steps:');
      console.log('1. Review the exported schema file');
      console.log('2. Stop Docker containers: docker compose down');
      console.log('3. Remove old database volume: docker volume rm relist-postgres-data');
      console.log('4. Replace old schema: mv docker/init-db/001_schema.sql docker/init-db/001_schema_OLD.sql');
      console.log('5. Use new schema: mv docker/init-db/001_schema_supabase.sql docker/init-db/001_schema.sql');
      console.log('6. Start containers: docker compose up -d --build');
    } else {
      console.error('\n❌ Schema file was not created');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stderr) {
      console.error('Details:', error.stderr);
    }
    process.exit(1);
  }
}

exportSchema();
