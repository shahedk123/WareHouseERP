const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── Users ────────────────────────────────────────────────────
async function getUserByWA(wa_number) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('wa_number', wa_number)
    .single();
  return data;
}

async function getUsersByRole(role) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('role', role)
    .eq('active', true);
  return data || [];
}

async function getAllActiveUsers() {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('active', true);
  return data || [];
}

async function getActiveUsersByRole(role) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('role', role)
    .eq('active', true);
  return data || [];
}

// ─── Pending Bills ────────────────────────────────────────────
async function nextRef() {
  const { data } = await supabase
    .from('pending_bills')
    .select('ref_number')
    .order('submitted_at', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return 'WV001';

  const lastRef = data[0].ref_number; // WV047
  const num = parseInt(lastRef.slice(2)) + 1;
  return `WV${String(num).padStart(3, '0')}`;
}

async function insertBill(billData) {
  const { data, error } = await supabase
    .from('pending_bills')
    .insert(billData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getBillByRef(ref_number) {
  const { data } = await supabase
    .from('pending_bills')
    .select('*')
    .eq('ref_number', ref_number)
    .single();
  return data;
}

async function updateBill(ref_number, updates) {
  const { data, error } = await supabase
    .from('pending_bills')
    .update(updates)
    .eq('ref_number', ref_number)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getPendingBills(state) {
  const { data } = await supabase
    .from('pending_bills')
    .select('*')
    .eq('state', state)
    .order('submitted_at', { ascending: true });
  return data || [];
}

async function getBillsToday() {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('pending_bills')
    .select('*')
    .gte('submitted_at', `${today}T00:00:00`)
    .lt('submitted_at', `${today}T23:59:59`);
  return data || [];
}

async function getDoneBillsToday() {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('pending_bills')
    .select('*')
    .eq('state', 'done')
    .gte('resolved_at', `${today}T00:00:00`)
    .lt('resolved_at', `${today}T23:59:59`);
  return data || [];
}

async function getOldestUnclaimed() {
  const { data } = await supabase
    .from('pending_bills')
    .select('*')
    .in('state', ['pending', 'claimed'])
    .order('submitted_at', { ascending: true })
    .limit(1);
  return data ? data[0] : null;
}

async function getStaleBills(minutes) {
  const staleTime = new Date(Date.now() - minutes * 60000).toISOString();
  const { data } = await supabase
    .from('pending_bills')
    .select('*')
    .in('state', ['pending', 'claimed'])
    .lt('submitted_at', staleTime)
    .is('stale_alerted_at', null);
  return data || [];
}

async function markStaleAlerted(ref_number) {
  return updateBill(ref_number, { stale_alerted_at: new Date().toISOString() });
}

async function getBillsInRange(fromDate, toDate) {
  const { data } = await supabase
    .from('pending_bills')
    .select('*')
    .gte('submitted_at', fromDate)
    .lte('submitted_at', toDate);
  return data || [];
}

async function getPickerBillsToday(picker_wa) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('pending_bills')
    .select('*')
    .eq('picker_wa', picker_wa)
    .gte('submitted_at', `${today}T00:00:00`)
    .lt('submitted_at', `${today}T23:59:59`);
  return data || [];
}

// ─── Message Log ──────────────────────────────────────────────
async function logMessage(direction, wa_number, message_type, content, ref_number = null) {
  const { error } = await supabase
    .from('message_log')
    .insert({
      direction,
      wa_number,
      message_type,
      content,
      ref_number
    });
  if (error) throw error;
}

// ─── Products ─────────────────────────────────────────────────
async function getProductByCode(code) {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('code', code)
    .eq('active', true)
    .single();
  return data;
}

async function searchProducts(query) {
  const { data } = await supabase
    .from('products')
    .select('id, code, name, name_alt, unit, current_stock')
    .eq('active', true)
    .or(`name.ilike.%${query}%,code.ilike.%${query}%`)
    .limit(20);
  return data || [];
}

// ─── Stock Movements ──────────────────────────────────────────
async function createStockMovement(movementData) {
  const { data, error } = await supabase
    .from('stock_movements')
    .insert(movementData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getProductCurrentStock(product_id) {
  const { data } = await supabase
    .from('products')
    .select('current_stock')
    .eq('id', product_id)
    .single();
  return data ? data.current_stock : 0;
}

async function updateProductStock(product_id, delta) {
  const current = await getProductCurrentStock(product_id);
  const newStock = current + delta;
  const { data, error } = await supabase
    .from('products')
    .update({ current_stock: newStock })
    .eq('id', product_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Company Settings ─────────────────────────────────────────
async function getCompanySettings() {
  const { data } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1)
    .single();
  return data;
}

module.exports = {
  // Users
  getUserByWA,
  getUsersByRole,
  getAllActiveUsers,
  getActiveUsersByRole,

  // Pending Bills
  nextRef,
  insertBill,
  getBillByRef,
  updateBill,
  getPendingBills,
  getBillsToday,
  getDoneBillsToday,
  getOldestUnclaimed,
  getStaleBills,
  markStaleAlerted,
  getBillsInRange,
  getPickerBillsToday,

  // Message Log
  logMessage,

  // Products
  getProductByCode,
  searchProducts,

  // Stock
  createStockMovement,
  getProductCurrentStock,
  updateProductStock,

  // Settings
  getCompanySettings,
};
