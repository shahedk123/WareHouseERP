const db = require('../lib/db');
const { sendText, sendImage, broadcast, broadcastImage } = require('../lib/whatsapp');

async function broadcastToRole(role, message) {
  const users = await db.getActiveUsersByRole(role);
  const numbers = users.map(u => u.wa_number).filter(Boolean);
  await broadcast(numbers, message);
}

async function broadcastImageToRole(role, imageUrl, caption) {
  const users = await db.getActiveUsersByRole(role);
  const numbers = users.map(u => u.wa_number).filter(Boolean);
  await broadcastImage(numbers, imageUrl, caption);
}

async function sendToUser(wa_number, message) {
  await sendText(wa_number, message);
}

async function sendImageToUser(wa_number, imageUrl, caption) {
  await sendImage(wa_number, imageUrl, caption);
}

module.exports = {
  broadcastToRole,
  broadcastImageToRole,
  sendToUser,
  sendImageToUser
};
