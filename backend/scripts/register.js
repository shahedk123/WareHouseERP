#!/usr/bin/env node

// Usage: node scripts/register.js +919876543210 "Name" picker|accountant|manager
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function register() {
  const [, , waNumber, name, role] = process.argv;

  if (!waNumber || !name || !role) {
    console.error('Usage: node scripts/register.js +919876543210 "Name" picker|accountant|manager|staff');
    process.exit(1);
  }

  const validRoles = ['picker', 'accountant', 'manager', 'staff'];
  if (!validRoles.includes(role)) {
    console.error(`Role must be: ${validRoles.join(', ')}`);
    process.exit(1);
  }

  if (!waNumber.startsWith('+')) {
    console.error('WA number must be in E.164 format e.g. +919876543210');
    process.exit(1);
  }

  try {
    console.log(`📝 Registering ${role}: ${name} (${waNumber})...`);

    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          wa_number: waNumber,
          name,
          role,
          active: true
        },
        { onConflict: 'wa_number' }
      )
      .select()
      .single();

    if (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }

    console.log(`✅ Registered: ${data.name} (${data.role}) — ${data.wa_number}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

register();
