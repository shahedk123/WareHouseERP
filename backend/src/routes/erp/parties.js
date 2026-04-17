const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authorize } = require('../../middleware/auth');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET /api/erp/parties — list parties
router.get('/', async (req, res) => {
  try {
    const { type, search, active = true } = req.query;

    let query = supabase.from('parties').select('*');

    if (active !== 'false') {
      query = query.eq('active', true);
    }

    if (type) {
      query = query.or(`type.eq.${type},type.eq.both`);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query.order('name');
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/erp/parties/:id — get single party
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('parties')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Party not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/erp/parties — create party
router.post('/', authorize('admin', 'accountant'), async (req, res) => {
  try {
    const {
      type, name, phone, email, address, city, state, state_code, country,
      gstin, trn, credit_days, credit_limit
    } = req.body;

    if (!type || !name) {
      return res.status(400).json({ error: 'type and name required' });
    }

    const { data, error } = await supabase
      .from('parties')
      .insert({
        type: type || 'customer',
        name,
        phone,
        email,
        address,
        city,
        state,
        state_code,
        country: country || 'India',
        gstin,
        trn,
        credit_days: credit_days || 0,
        credit_limit: credit_limit || 0,
        balance: 0,
        active: true
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/erp/parties/:id — update party
router.put('/:id', authorize('admin', 'accountant'), async (req, res) => {
  try {
    const {
      type, name, phone, email, address, city, state, state_code, country,
      gstin, trn, credit_days, credit_limit, active
    } = req.body;

    const { data, error } = await supabase
      .from('parties')
      .update({
        type, name, phone, email, address, city, state, state_code, country,
        gstin, trn, credit_days, credit_limit, active
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(404).json({ error: 'Party not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/erp/parties/:id — soft delete party
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { error } = await supabase
      .from('parties')
      .update({ active: false })
      .eq('id', req.params.id);

    if (error) return res.status(404).json({ error: 'Party not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
