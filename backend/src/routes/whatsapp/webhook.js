const db = require('../../lib/db');
const { sendText } = require('../../lib/whatsapp');
const { route } = require('../../services/commandService');

// Webhook verification
function handleWebhookVerify(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('✅ Webhook verified');
      res.status(200).send(challenge);
    } else {
      console.error('❌ Webhook verification failed');
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
}

// Webhook message handler
async function handleWebhookPost(req, res) {
  // Always respond 200 immediately so Meta doesn't retry
  res.sendStatus(200);

  const entry = req.body.entry?.[0];
  if (!entry?.changes?.[0]?.value?.messages) return;

  const messages = entry.changes[0].value.messages;

  for (const message of messages) {
    try {
      const from = message.from;
      const body = message.text?.body || '';
      const type = message.type;
      const imageId = message.image?.id;

      console.log(`📨 Message from ${from}: type=${type}`);

      // Find or create user
      let user = await db.getUserByWA(from);
      if (!user) {
        console.warn(`⚠️  User not registered: ${from}`);
        await sendText(from, '❌ You are not registered. Please contact admin to register.');
        await db.logMessage('in', from, 'unknown', body, null);
        continue;
      }

      // Log incoming message
      await db.logMessage('in', from, type, body || imageId, null);

      // Route to command handler
      await route(user, {
        type,
        text: message.text,
        image: message.image
      });

    } catch (err) {
      console.error('Webhook handler error:', err.message);
    }
  }
}

module.exports = { handleWebhookVerify, handleWebhookPost };
