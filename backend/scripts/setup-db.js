#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function execSQL(sql) {
  try {
    // Use pg directly to execute SQL
    const { Pool } = require('pg');

    // Parse Supabase URL to get connection string
    const url = new URL(process.env.SUPABASE_URL);
    const connString = `postgresql://postgres:${process.env.SUPABASE_SERVICE_KEY}@${url.hostname}:5432/postgres`;

    const pool = new Pool({ connectionString: connString });
    const client = await pool.connect();

    try {
      await client.query(sql);
      await pool.end();
      return { error: null };
    } catch (err) {
      await pool.end();
      return { error: err };
    }
  } catch (err) {
    return { error: err };
  }
}

async function setup() {
  console.log('🏗️  Setting up WarehouseOS database...\n');

  try {
    // Read migration SQL from file
    const migrationPath = path.join(__dirname, '../../supabase/migrations/003_warehouseos_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📝 Applying migration 003_warehouseos_schema.sql...');
    const { error } = await execSQL(migrationSQL);

    if (error) {
      console.error('\n❌ Migration failed:', error.message);
      console.log('\n💡 Alternative: Run the SQL manually via Supabase Dashboard:');
      console.log('   1. Go to https://app.supabase.com/project/njjrldbhcrbuazvmupaz/sql');
      console.log('   2. Open supabase/migrations/003_warehouseos_schema.sql');
      console.log('   3. Copy all SQL and paste into the editor');
      console.log('   4. Click "Run"');
      process.exit(1);
    }

    console.log('✅ Migration applied successfully\n');

    // Create storage bucket
    console.log('🪣 Setting up storage bucket...');
    const { error: bucketError } = await supabase.storage.createBucket('bill-photos', {
      public: false,
      fileSizeLimit: 5242880,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    });

    if (bucketError && !bucketError.message?.includes('already exists')) {
      console.warn('⚠️  Bucket creation warning:', bucketError.message);
    } else {
      console.log('✅ Storage bucket bill-photos ready\n');
    }

    // Verify seed data
    console.log('🌱 Verifying seed data...');
    const { count: settingsCount } = await supabase
      .from('company_settings')
      .select('*', { count: 'exact', head: true });

    const { count: groupCount } = await supabase
      .from('product_groups')
      .select('*', { count: 'exact', head: true });

    console.log(`✅ company_settings: ${settingsCount || 0} row(s)`);
    console.log(`✅ product_groups: ${groupCount || 0} row(s) (8 expected)\n`);

    console.log('🎉 Database setup complete!\n');
    console.log('📋 Next steps:');
    console.log('   1. node backend/scripts/create-admin.js "Admin Name" admin@example.com');
    console.log('   2. node backend/scripts/register.js +91XXXXXXXXXX "Name" role');
    console.log('   3. npm run dev (in backend/)');

  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  }
}

setup();
