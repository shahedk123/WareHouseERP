require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function run() {
  console.log('Running migration via Supabase...');

  // Create tables one by one using the supabase-js client won't work for DDL.
  // We'll use the Supabase REST API's sql endpoint (available in newer versions)
  // or use fetch directly to the postgres endpoint.

  const projectRef = process.env.SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

  const sql = require('fs').readFileSync(
    require('path').join(__dirname, '../../supabase/migrations/001_initial_schema.sql'),
    'utf8'
  );

  // Split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      // Use the Supabase SQL API via fetch
      const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        }
      });
    } catch {}
  }

  // Better: use pg directly
  console.log('Note: DDL migrations must be run via Supabase Dashboard SQL editor or supabase CLI.');
  console.log('Project ref:', projectRef);
  console.log('');
  console.log('Please paste this SQL into your Supabase Dashboard > SQL Editor:');
  console.log('https://app.supabase.com/project/' + projectRef + '/sql/new');
  console.log('');
  console.log(sql);
}

run().catch(console.error);
