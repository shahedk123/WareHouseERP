const db = require('../lib/db');

// Create a stock movement (in/out/adjust) and update product stock
async function createMovement({ type, refType, refId, refNumber, productId, quantity, rate, partyId, partyName, notes, userId }) {
  // Validate product exists
  const product = await db.getProductByCode(productId);
  if (!product) throw new Error(`Product not found: ${productId}`);

  // Check stock for OUT movements
  if (type === 'out' && product.current_stock < quantity) {
    throw new Error(
      `Insufficient stock for ${product.name}: ` +
      `available ${product.current_stock} ${product.unit}, ` +
      `requested ${quantity} ${product.unit}`
    );
  }

  // Create stock movement record
  const movement = await db.createStockMovement({
    type, // 'in', 'out', 'adjust'
    ref_type: refType, // 'purchase', 'sale', 'adjustment', 'opening', 'whatsapp'
    ref_id: refId,
    ref_number: refNumber,
    product_id: product.id,
    product_name: product.name,
    product_code: product.code,
    quantity,
    unit: product.unit,
    rate,
    party_id: partyId,
    party_name: partyName,
    notes,
    created_by: userId,
    created_at: new Date().toISOString()
  });

  // Update product stock
  const delta = type === 'out' ? -quantity : quantity;
  const updated = await db.updateProductStock(product.id, delta);

  return { movement, product: updated };
}

// Get stock ledger for a product (with running balance)
async function getStockLedger(productId, fromDate, toDate) {
  const movements = await db.getStockLedger(productId, fromDate, toDate);

  // Compute running balance
  let balance = 0;
  const ledger = movements.map(m => {
    const delta = m.type === 'out' ? -m.quantity : m.quantity;
    balance += delta;
    return {
      ...m,
      balance
    };
  });

  return ledger;
}

// Get current stock summary by product
async function getStockSummary() {
  // This will be implemented via a query to products table
  // For now, just return all products with stock
  const { data } = await require('@supabase/supabase-js')
    .createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    .from('products')
    .select('id, code, name, unit, current_stock, reorder_qty, active')
    .eq('active', true)
    .order('name');

  return (data || []).map(p => ({
    ...p,
    status: p.current_stock === 0 ? 'out_of_stock' : p.current_stock <= p.reorder_qty ? 'low' : 'ok'
  }));
}

// Get low stock alerts
async function getLowStockAlerts() {
  const { data } = await require('@supabase/supabase-js')
    .createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    .from('products')
    .select('id, code, name, unit, current_stock, reorder_qty')
    .eq('active', true)
    .lte('current_stock', 'reorder_qty')
    .order('current_stock');

  return data || [];
}

module.exports = {
  createMovement,
  getStockLedger,
  getStockSummary,
  getLowStockAlerts
};
