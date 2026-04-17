const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function uploadPhoto(buffer, storagePath) {
  const { error } = await supabase.storage
    .from('bill-photos')
    .upload(storagePath, buffer, { contentType: 'image/jpeg' });
  if (error) throw error;
}

async function getSignedUrl(storagePath, expiresIn = 7 * 24 * 3600) {
  const { data, error } = await supabase.storage
    .from('bill-photos')
    .createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

async function deletePhoto(storagePath) {
  if (!storagePath) return;
  const { error } = await supabase.storage
    .from('bill-photos')
    .remove([storagePath]);
  if (error) console.error('deletePhoto error:', error.message);
}

module.exports = { uploadPhoto, getSignedUrl, deletePhoto };
