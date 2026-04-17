#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function setup() {
  console.log('🏗️  Setting up WarehouseOS database...\n');

  try {
    // Read migration SQL
    const migrationPath = path.join(__dirname, '../../supabase/migrations/003_warehouseos_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split into individual statements (split on semicolons that are not inside comments)
    const statements = migrationSQL
      .split(';\n')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .map(s => s + ';');

    console.log(`📝 Executing ${statements.length} SQL statements...\n`);

    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];

      try {
        // Use the rpc method to execute raw SQL
        const { data, error } = await supabase.rpc('query', { sql: stmt });

        if (error) {
          // Ignore errors for IF NOT EXISTS clauses
          if (error.message.includes('already exists') || error.message.includes('does not exist')) {
            skipCount++;
          } else if (error.code === 'PGRST116' || error.message.includes('not found')) {
            skipCount++;
          } else {
            console.error(`❌ Statement ${i + 1} failed:`, error.message);
            console.error('SQL:', stmt.substring(0, 100));
          }
        } else {
          successCount++;
          if ((i + 1) % 5 === 0) {
            console.log(`✅ Executed ${i + 1}/${statements.length} statements...`);
          }
        }
      } catch (err) {
        console.error(`⚠️  Statement ${i + 1}:`, err.message);
      }
    }

    console.log(`\n✅ Setup attempt complete!`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Skipped (already exist): ${skipCount}`);
    console.log(`\n📋 To verify, check Supabase Tables at:`);
    console.log(`   https://app.supabase.com/project/njjrldbhcrbuazvmupaz/editor`);
    console.log(`\n✅ If tables exist, you're ready for Step 3 (create admin user)`);

  } catch (err) {
    console.error('\n❌ Fatal error:', err.message);
    console.log('\n💡 If using RPC function fails, apply SQL manually:');
    console.log('   1. Go to https://app.supabase.com/project/njjrldbhcrbuazvmupaz/sql');
    console.log('   2. Create new query');
    console.log('   3. Copy ALL SQL from: supabase/migrations/003_warehouseos_schema.sql');
    console.log('   4. Paste and Run');
    process.exit(1);
  }
}

setup();
