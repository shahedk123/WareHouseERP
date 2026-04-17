const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET /api/settings — get company settings
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) return res.status(404).json({ error: 'Settings not found' });
    res.json(data);
  } catch (err) {
    console.error('Settings GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings — update company settings (admin only)
router.put('/', async (req, res) => {
  try {
    const {
      company_name, address, phone, email, gstin, pan, trn,
      tax_regime, state_code, currency, logo_url, invoice_prefix
    } = req.body;

    const { data, error } = await supabase
      .from('company_settings')
      .update({
        company_name, address, phone, email, gstin, pan, trn,
        tax_regime, state_code, currency, logo_url, invoice_prefix,
        updated_at: new Date().toISOString()
      })
      .limit(1)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Settings PUT error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
