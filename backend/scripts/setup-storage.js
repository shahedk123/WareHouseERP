require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function setup() {
  console.log('Setting up Supabase Storage...');

  // Check if bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === 'bill-photos');

  if (!exists) {
    const { error } = await supabase.storage.createBucket('bill-photos', {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    });
    if (error) {
      console.error('Failed to create bucket:', error.message);
      process.exit(1);
    }
    console.log('Created bill-photos bucket');
  } else {
    console.log('bill-photos bucket already exists');
  }

  console.log('Storage setup complete.');
}

setup().catch(err => {
  console.error(err);
  process.exit(1);
});
