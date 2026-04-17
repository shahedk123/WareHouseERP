const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const stockService = require('../../services/stockService');
const { authorize } = require('../../middleware/auth');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// POST /api/erp/stock/in — record stock in
router.post('/in', authorize('admin', 'accountant', 'staff'), async (req, res) => {
  try {
    const { productId, quantity, rate, supplierId, refNumber, notes } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({ error: 'productId and quantity required' });
    }

    const { movement, product } = await stockService.createMovement({
      type: 'in',
      refType: 'purchase',
      refNumber: refNumber || `STOCK-IN-${Date.now()}`,
      productId,
      quantity,
      rate: rate || 0,
      partyId: supplierId,
      userId: req.user.id,
      notes: notes || 'Stock in'
    });

    res.json({ movement, product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/erp/stock/out — record stock out
router.post('/out', authorize('admin', 'accountant', 'staff'), async (req, res) => {
  try {
    const { productId, quantity, rate, customerId, refNumber, notes } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({ error: 'productId and quantity required' });
    }

    const { movement, product } = await stockService.createMovement({
      type: 'out',
      refType: 'sale',
      refNumber: refNumber || `STOCK-OUT-${Date.now()}`,
      productId,
      quantity,
      rate: rate || 0,
      partyId: customerId,
      userId: req.user.id,
      notes: notes || 'Stock out'
    });

    res.json({ movement, product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/erp/stock/adjust — adjust stock
router.post('/adjust', authorize('admin', 'accountant'), async (req, res) => {
  try {
    const { productId, quantity, reason, notes } = req.body;

    if (!productId || quantity === undefined) {
      return res.status(400).json({ error: 'productId and quantity required' });
    }

    const { movement, product } = await stockService.createMovement({
      type: 'adjust',
      refType: 'adjustment',
      refNumber: `ADJUST-${Date.now()}`,
      productId,
      quantity: Math.abs(quantity), // Store absolute value, type indicates direction
      userId: req.user.id,
      notes: notes || reason || 'Stock adjustment'
    });

    res.json({ movement, product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/erp/stock/ledger/:productId — get stock ledger
router.get('/ledger/:productId', async (req, res) => {
  try {
    const { from, to } = req.query;

    const fromDate = from ? `${from}T00:00:00` : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = to ? `${to}T23:59:59` : new Date().toISOString();

    const ledger = await stockService.getStockLedger(req.params.productId, fromDate, toDate);
    res.json(ledger);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/erp/stock/summary — get stock summary
router.get('/summary', async (req, res) => {
  try {
    const summary = await stockService.getStockSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
