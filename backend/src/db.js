require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getUserByWA(waNumber) {
  const { data } = await supabase
    .from('warehouse_users')
    .select('*')
    .eq('wa_number', waNumber)
    .eq('active', true)
    .single();
  return data;
}

async function getUsersByRole(role) {
  const { data } = await supabase
    .from('warehouse_users')
    .select('*')
    .eq('role', role)
    .eq('active', true);
  return data || [];
}

async function getAllActiveUsers() {
  const { data } = await supabase
    .from('warehouse_users')
    .select('*')
    .eq('active', true)
    .order('name');
  return data || [];
}

async function logMessage(direction, waNumber, type, content, refNumber = null) {
  await supabase.from('message_log').insert({
    direction, wa_number: waNumber, message_type: type,
    content, ref_number: refNumber
  });
}

async function nextRef() {
  const { count } = await supabase
    .from('pending_bills')
    .select('*', { count: 'exact', head: true });
  return 'WV' + String((count || 0) + 1).padStart(3, '0');
}

async function insertBill(bill) {
  const { data, error } = await supabase
    .from('pending_bills')
    .insert(bill)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getBillByRef(ref) {
  const { data } = await supabase
    .from('pending_bills')
    .select('*')
    .ilike('ref_number', ref)
    .single();
  return data;
}

async function updateBill(id, updates) {
  const { data, error } = await supabase
    .from('pending_bills')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getPendingBills(limit = 50) {
  const { data } = await supabase
    .from('pending_bills')
    .select('*')
    .in('state', ['pending', 'claimed'])
    .order('submitted_at', { ascending: true })
    .limit(limit);
  return data || [];
}

async function getBillsToday() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('pending_bills')
    .select('*')
    .gte('submitted_at', todayStart.toISOString())
    .order('submitted_at', { ascending: true });
  return data || [];
}

async function getDoneBillsToday() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('pending_bills')
    .select('*')
    .eq('state', 'done')
    .gte('resolved_at', todayStart.toISOString())
    .order('resolved_at', { ascending: false });
  return data || [];
}

async function getOldestUnclaimed() {
  const { data } = await supabase
    .from('pending_bills')
    .select('*')
    .eq('state', 'pending')
    .order('submitted_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

async function getStaleBills(cutoff) {
  const { data } = await supabase
    .from('pending_bills')
    .select('*')
    .in('state', ['pending', 'claimed'])
    .lt('submitted_at', cutoff.toISOString())
    .is('stale_alerted_at', null);
  return data || [];
}

async function markStaleAlerted(id) {
  await supabase
    .from('pending_bills')
    .update({ stale_alerted_at: new Date().toISOString() })
    .eq('id', id);
}

async function getBillsInRange(start, end) {
  const { data } = await supabase
    .from('pending_bills')
    .select('*')
    .gte('submitted_at', start.toISOString())
    .lt('submitted_at', end.toISOString());
  return data || [];
}

async function getPickerBillsToday(pickerWa) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('pending_bills')
    .select('*')
    .eq('picker_wa', pickerWa)
    .gte('submitted_at', todayStart.toISOString());
  return data || [];
}

module.exports = {
  supabase,
  getUserByWA, getUsersByRole, getAllActiveUsers, logMessage, nextRef,
  insertBill, getBillByRef, updateBill, getPendingBills, getBillsToday,
  getDoneBillsToday, getOldestUnclaimed, getStaleBills, markStaleAlerted,
  getBillsInRange, getPickerBillsToday
};
