#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');

// Routes
const whatsappWebhookRoutes = require('./routes/whatsapp/webhook');
const whatsappQueueRoutes = require('./routes/whatsapp/queue');
const usersRoutes = require('./routes/shared/users');
const settingsRoutes = require('./routes/shared/settings');

// ERP Routes
const productsRoutes = require('./routes/erp/products');
const partiesRoutes = require('./routes/erp/parties');
const stockRoutes = require('./routes/erp/stock');
const invoicesRoutes = require('./routes/erp/invoices');
const taxRoutes = require('./routes/erp/tax');
const reportsRoutes = require('./routes/erp/reports');

// Services
const { startCron } = require('./cron');
const { authenticate, authorize } = require('./middleware/auth');

// Express setup
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001'
  ].filter(Boolean),
  credentials: true
}));

// ─── Health Check ────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    service: 'WarehouseOS API'
  });
});

// ─── WhatsApp Webhook ────────────────────────────────────────
app.get('/api/whatsapp/webhook', whatsappWebhookRoutes.handleWebhookVerify);
app.post('/api/whatsapp/webhook', whatsappWebhookRoutes.handleWebhookPost);

// ─── WhatsApp Queue API ──────────────────────────────────────
app.use('/api/whatsapp/queue', whatsappQueueRoutes);

// ─── Shared Routes (Users, Settings) ──────────────────────────
app.use('/api/users', usersRoutes);
app.use('/api/settings', settingsRoutes);

// ─── ERP Routes (Protected) ───────────────────────────────────
app.use('/api/erp/products', authenticate, productsRoutes);
app.use('/api/erp/parties', authenticate, partiesRoutes);
app.use('/api/erp/stock', authenticate, stockRoutes);
app.use('/api/erp/invoices', authenticate, invoicesRoutes);
app.use('/api/erp/tax', authenticate, taxRoutes);
app.use('/api/erp/reports', authenticate, reportsRoutes);

// ─── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method
  });
});

// ─── Error Handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({
    error: err.message,
    timestamp: new Date()
  });
});

// ─── Startup ──────────────────────────────────────────────────
async function start() {
  try {
    // Start cron jobs
    console.log('⏰ Starting cron jobs...');
    startCron();

    // Start server
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════╗
║           🏭 WarehouseOS API (Phase 3)           ║
║                                                  ║
║  ✅ Server running on port ${PORT}                ║
║  📌 Frontend: ${(process.env.FRONTEND_URL || 'http://localhost:5173').padEnd(23)}│
║  ⚙️  Environment: ${(process.env.NODE_ENV || 'development').padEnd(22)}│
║                                                  ║
║  WhatsApp Layer:                                 ║
║  • POST /api/whatsapp/webhook                   ║
║  • GET  /api/whatsapp/queue                     ║
║                                                  ║
║  ERP Layer (Products, Parties, Stock, etc):     ║
║  • GET  /api/erp/products                       ║
║  • GET  /api/erp/parties                        ║
║  • POST /api/erp/stock/in | /out | /adjust      ║
║  • GET  /api/erp/invoices                       ║
║  • POST /api/erp/invoices (create + confirm)    ║
║  • GET  /api/erp/tax/gst-summary                ║
║  • GET  /api/erp/reports/stock-summary          ║
║                                                  ║
║  Shared:                                         ║
║  • GET  /api/users                              ║
║  • GET  /api/settings                           ║
║  • GET  /health                                 ║
║                                                  ║
║  Auth: x-user-id, x-user-role headers          ║
║                                                  ║
╚══════════════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});
