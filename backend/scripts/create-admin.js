#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function createAdmin() {
  const [, , name, email, password] = process.argv;

  if (!name || !email || !password) {
    console.error('Usage: node create-admin.js "Name" email@example.com password');
    console.error('Example: node create-admin.js "Ahmed Admin" admin@warehouse.com secretpass123');
    process.exit(1);
  }

  try {
    console.log(`🔐 Creating admin user: ${name} (${email})...\n`);

    // Create user in `users` table
    const { data: user, error: createError } = await supabase
      .from('users')
      .insert({
        email,
        name,
        role: 'admin',
        active: true
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Failed to create user:', createError.message);
      process.exit(1);
    }

    console.log('✅ Admin user created:\n');
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: admin`);
    console.log(`   Active: true\n`);

    console.log('📋 Next steps:');
    console.log('   1. Set up authentication (currently no password system)');
    console.log('   2. Register pickers/accountants/managers: node backend/scripts/register.js');
    console.log('   3. Start backend: npm run dev\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createAdmin();
