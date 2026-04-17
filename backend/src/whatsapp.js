const getBase = () =>
  `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
const getHdr = () => ({
  'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
  'Content-Type': 'application/json'
});
const norm = n => n.replace(/\D/g, '');

async function sendText(to, body) {
  try {
    const res = await fetch(getBase(), {
      method: 'POST', headers: getHdr(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: norm(to), type: 'text',
        text: { body, preview_url: false }
      })
    });
    if (!res.ok) console.error('WA sendText failed:', await res.text());
  } catch (e) {
    console.error('WA sendText error:', e.message);
  }
}

async function sendImage(to, imageUrl, caption) {
  try {
    const res = await fetch(getBase(), {
      method: 'POST', headers: getHdr(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: norm(to), type: 'image',
        image: { link: imageUrl, caption }
      })
    });
    if (!res.ok) console.error('WA sendImage failed:', await res.text());
  } catch (e) {
    console.error('WA sendImage error:', e.message);
  }
}

async function downloadMedia(mediaId) {
  const metaRes = await fetch(
    `https://graph.facebook.com/v18.0/${mediaId}`,
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
  );
  if (!metaRes.ok) throw new Error('Failed to get media URL: ' + await metaRes.text());
  const { url } = await metaRes.json();
  const fileRes = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }
  });
  if (!fileRes.ok) throw new Error('Failed to download media');
  return Buffer.from(await fileRes.arrayBuffer());
}

async function broadcast(numbers, text) {
  for (const n of numbers) {
    sendText(n, text).catch(e => console.error('broadcast failed:', n, e.message));
  }
}

async function broadcastImage(numbers, imageUrl, caption) {
  for (const n of numbers) {
    sendImage(n, imageUrl, caption).catch(e =>
      console.error('broadcastImage failed:', n, e.message));
  }
}

module.exports = { sendText, sendImage, downloadMedia, broadcast, broadcastImage };
