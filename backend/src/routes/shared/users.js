const express = require('express');
const db = require('../../lib/db');

const router = express.Router();

// GET /api/users — list all active users
router.get('/', async (req, res) => {
  try {
    const users = await db.getAllActiveUsers();
    res.json(users);
  } catch (err) {
    console.error('Users GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id — get single user
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await require('@supabase/supabase-js')
      .createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'User not found' });
    res.json(data);
  } catch (err) {
    console.error('Users GET/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users — create new user (admin only)
router.post('/', async (req, res) => {
  try {
    const { email, wa_number, name, role } = req.body;

    if (!name || !role) {
      return res.status(400).json({ error: 'name and role required' });
    }

    const supabase = require('@supabase/supabase-js')
      .createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase
      .from('users')
      .insert({ email, wa_number, name, role, active: true })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Email or WA number already exists' });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Users POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id — update user
router.put('/:id', async (req, res) => {
  try {
    const { name, email, wa_number, role, active } = req.body;

    const supabase = require('@supabase/supabase-js')
      .createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase
      .from('users')
      .update({ name, email, wa_number, role, active, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(404).json({ error: 'User not found' });
    res.json(data);
  } catch (err) {
    console.error('Users PUT error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
