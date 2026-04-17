const express = require('express');
const db = require('../../lib/db');
const notifyService = require('../../services/notifyService');
const format = require('../../lib/format');
const storage = require('../../lib/storage');

const router = express.Router();

// GET /api/whatsapp/queue — get bills by state
router.get('/', async (req, res) => {
  try {
    const state = req.query.state || 'pending';
    const bills = await db.getPendingBills(state);

    // Enrich with signed URLs
    for (const bill of bills) {
      if (bill.photo_storage_path) {
        bill.photo_url = await storage.getSignedUrl(bill.photo_storage_path);
      }
    }

    res.json(bills);
  } catch (err) {
    console.error('Queue GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/whatsapp/queue/:ref — get single bill
router.get('/:ref', async (req, res) => {
  try {
    const bill = await db.getBillByRef(req.params.ref);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    if (bill.photo_storage_path) {
      bill.photo_url = await storage.getSignedUrl(bill.photo_storage_path);
    }

    res.json(bill);
  } catch (err) {
    console.error('Queue GET/:ref error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/whatsapp/queue/:ref/claim — claim a bill
router.patch('/:ref/claim', async (req, res) => {
  try {
    const { claimedByWA, claimedByName } = req.body;
    if (!claimedByWA || !claimedByName) {
      return res.status(400).json({ error: 'claimedByWA and claimedByName required' });
    }

    const bill = await db.updateBill(req.params.ref, {
      state: 'claimed',
      claimed_by_wa: claimedByWA,
      claimed_by_name: claimedByName,
      claimed_at: new Date().toISOString()
    });

    // Notify other accountants on WhatsApp
    await notifyService.broadcastToRole('accountant',
      format.claimNotifyMsg(req.params.ref, claimedByName)
    );

    res.json(bill);
  } catch (err) {
    console.error('Queue claim error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/whatsapp/queue/:ref/done — mark done
router.patch('/:ref/done', async (req, res) => {
  try {
    const bill = await db.getBillByRef(req.params.ref);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const resolveMinutes = Math.floor(
      (new Date() - new Date(bill.submitted_at)) / 60000
    );

    const updated = await db.updateBill(req.params.ref, {
      state: 'done',
      resolved_by_wa: req.body.resolvedByWA,
      resolved_by_name: req.body.resolvedByName,
      resolved_at: new Date().toISOString()
    });

    // Delete photo
    if (bill.photo_storage_path) {
      await storage.deletePhoto(bill.photo_storage_path);
    }

    // Notify via WhatsApp
    const pending = await db.getPendingBills('pending');
    await notifyService.sendToUser(
      bill.picker_wa,
      format.donePickerMsg(req.params.ref, resolveMinutes)
    );

    await notifyService.broadcastToRole('manager',
      format.doneManagerMsg(req.params.ref, req.body.resolvedByName, resolveMinutes, pending.length)
    );

    res.json(updated);
  } catch (err) {
    console.error('Queue done error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/whatsapp/queue/:ref/skip — move to bottom
router.patch('/:ref/skip', async (req, res) => {
  try {
    const updated = await db.updateBill(req.params.ref, {
      state: 'pending',
      claimed_by_wa: null,
      claimed_by_name: null,
      claimed_at: null,
      submitted_at: new Date().toISOString() // Reprioritize to bottom
    });

    res.json(updated);
  } catch (err) {
    console.error('Queue skip error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/whatsapp/stats/today — today's stats
router.get('/stats/today', async (req, res) => {
  try {
    const bills = await db.getBillsToday();
    const done = bills.filter(b => b.state === 'done');

    const stats = {
      total: bills.length,
      done: done.length,
      pending: bills.filter(b => b.state === 'pending').length,
      claimed: bills.filter(b => b.state === 'claimed').length,
      stale: bills.filter(b =>
        (b.state === 'pending' || b.state === 'claimed') &&
        Date.now() - new Date(b.submitted_at) > 2 * 60 * 60 * 1000
      ).length
    };

    res.json(stats);
  } catch (err) {
    console.error('Stats today error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/whatsapp/stats/week — 7-day stats
router.get('/stats/week', async (req, res) => {
  try {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const from = date.toISOString().split('T')[0] + 'T00:00:00';
      const to = date.toISOString().split('T')[0] + 'T23:59:59';

      const bills = await db.getBillsInRange(from, to);
      const done = bills.filter(b => b.state === 'done');

      days.push({
        date: date.toISOString(),
        total: bills.length,
        done: done.length
      });
    }

    res.json(days);
  } catch (err) {
    console.error('Stats week error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
