const { createClient } = require('@supabase/supabase-js');
const taxService = require('./taxService');
const stockService = require('./stockService');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Create a new invoice (sale, purchase, return, etc.)
async function createInvoice({
  type,          // 'sale', 'purchase', 'sale_return', 'purchase_return'
  partyId,
  items,         // array of { productId, quantity, rate, discountPct, taxRate }
  date = new Date().toISOString().split('T')[0],
  dueDate = null,
  notes = '',
  userId,
  pendingBillId = null
}) {
  try {
    // Get company settings
    const settings = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single();

    if (settings.error) throw new Error('Company settings not found');

    const company = settings.data;

    // Get party
    const partyRes = await supabase
      .from('parties')
      .select('*')
      .eq('id', partyId)
      .single();

    if (partyRes.error) throw new Error('Party not found');
    const party = partyRes.data;

    // Determine if interstate
    const isInterstate = party.state_code && party.state_code !== company.state_code;

    // Calculate line items with tax
    const calculatedItems = [];
    for (const item of items) {
      const product = await supabase
        .from('products')
        .select('*')
        .eq('id', item.productId)
        .single();

      if (product.error) throw new Error(`Product not found: ${item.productId}`);
      const prod = product.data;

      const lineCalc = taxService.calcLineItem({
        qty: item.quantity,
        rate: item.rate || (type === 'purchase' ? prod.purchase_rate : prod.selling_rate),
        discountPct: item.discountPct || 0,
        taxRate: prod.tax_rate,
        isInterstate,
        taxRegime: company.tax_regime
      });

      calculatedItems.push({
        product_id: prod.id,
        product_name: prod.name,
        product_code: prod.code,
        hsn_code: prod.hsn_code,
        quantity: item.quantity,
        unit: prod.unit,
        rate: lineCalc.gross / item.quantity,
        discount_pct: item.discountPct || 0,
        taxable_amount: lineCalc.taxable,
        tax_rate: prod.tax_rate,
        cgst_rate: lineCalc.cgstRate,
        cgst_amount: lineCalc.cgstAmt,
        sgst_rate: lineCalc.sgstRate,
        sgst_amount: lineCalc.sgstAmt,
        igst_rate: lineCalc.igstRate,
        igst_amount: lineCalc.igstAmt,
        vat_rate: lineCalc.vatRate,
        vat_amount: lineCalc.vatAmt,
        line_total: lineCalc.lineTotal
      });
    }

    // Calculate invoice totals
    const totals = taxService.calcInvoiceTotals(calculatedItems);

    // Generate invoice number
    const invoiceNum = `${company.invoice_prefix}-${String(company.invoice_seq).padStart(4, '0')}`;

    // Create invoice
    const invoiceRes = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNum,
        type,
        pending_bill_id: pendingBillId,
        party_id: partyId,
        party_name: party.name,
        party_gstin: party.gstin,
        party_address: party.address,
        invoice_date: date,
        due_date: dueDate,
        place_of_supply: party.state,
        is_interstate: isInterstate,
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        taxable_amount: totals.taxableAmount,
        cgst_amount: totals.cgstAmount,
        sgst_amount: totals.sgstAmount,
        igst_amount: totals.igstAmount,
        vat_amount: totals.vatAmount,
        total_tax: totals.totalTax,
        grand_total: totals.grandTotal,
        balance_due: totals.grandTotal,
        status: 'draft',
        notes,
        created_by: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (invoiceRes.error) throw invoiceRes.error;
    const invoice = invoiceRes.data;

    // Insert invoice items
    const itemsWithInvoiceId = calculatedItems.map(item => ({
      ...item,
      invoice_id: invoice.id
    }));

    const itemsRes = await supabase
      .from('invoice_items')
      .insert(itemsWithInvoiceId);

    if (itemsRes.error) throw itemsRes.error;

    // Create stock movements (don't auto-confirm, just draft invoice)
    // Accountant must click "Confirm" to lock stock movements
    // For now, we'll create the movements but they can be rolled back

    for (const item of calculatedItems) {
      const movementType = type === 'sale' ? 'out' : type === 'purchase' ? 'in' : null;
      if (movementType) {
        await stockService.createMovement({
          type: movementType,
          refType: type === 'sale' ? 'sale' : 'purchase',
          refId: invoice.id,
          refNumber: invoiceNum,
          productId: item.product_id,
          quantity: item.quantity,
          rate: item.rate,
          partyId,
          partyName: party.name,
          notes: `Invoice ${invoiceNum}`,
          userId
        });
      }
    }

    // Update party balance (for credit tracking)
    const balanceDelta = type === 'sale' ? totals.grandTotal : type === 'purchase' ? -totals.grandTotal : 0;
    if (balanceDelta !== 0) {
      const currentBalance = party.balance || 0;
      await supabase
        .from('parties')
        .update({ balance: currentBalance + balanceDelta })
        .eq('id', partyId);
    }

    // Increment invoice sequence
    await supabase
      .from('company_settings')
      .update({ invoice_seq: company.invoice_seq + 1 })
      .eq('id', company.id);

    // Link to pending_bill if applicable
    if (pendingBillId) {
      await supabase
        .from('pending_bills')
        .update({
          state: 'invoiced',
          invoice_id: invoice.id
        })
        .eq('id', pendingBillId);
    }

    return {
      invoice,
      items: calculatedItems,
      totals
    };

  } catch (err) {
    console.error('createInvoice error:', err.message);
    throw err;
  }
}

// Cancel an invoice (reverse stock movements and party balance)
async function cancelInvoice(invoiceId) {
  try {
    // Get invoice with items
    const invRes = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', invoiceId)
      .single();

    if (invRes.error) throw new Error('Invoice not found');
    const invoice = invRes.data;

    if (invoice.status === 'cancelled') {
      throw new Error('Invoice already cancelled');
    }

    // Reverse stock movements for each item
    for (const item of invoice.invoice_items || []) {
      const reverseType = invoice.type === 'sale' ? 'in' : 'out';
      const movementType = invoice.type === 'sale' ? 'sale' : 'purchase';

      // Create reverse movement
      await supabase
        .from('stock_movements')
        .insert({
          type: reverseType,
          ref_type: 'cancellation',
          ref_id: invoiceId,
          ref_number: `${invoice.invoice_number} (CANCELLED)`,
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          notes: `Reversal of ${invoice.invoice_number}`,
          created_at: new Date().toISOString()
        });

      // Update product stock back
      const delta = reverseType === 'out' ? -item.quantity : item.quantity;
      await supabase.rpc('update_product_stock', {
        product_id: item.product_id,
        delta
      }).catch(() => {
        // Fallback: update directly
        return supabase
          .from('products')
          .select('current_stock')
          .eq('id', item.product_id)
          .single()
          .then(res => {
            if (!res.error) {
              return supabase
                .from('products')
                .update({ current_stock: (res.data.current_stock || 0) + delta })
                .eq('id', item.product_id);
            }
          });
      });
    }

    // Reverse party balance
    const balanceDelta = invoice.type === 'sale' ? -invoice.grand_total : invoice.grand_total;
    if (balanceDelta !== 0) {
      const partyRes = await supabase
        .from('parties')
        .select('balance')
        .eq('id', invoice.party_id)
        .single();

      if (!partyRes.error) {
        await supabase
          .from('parties')
          .update({ balance: (partyRes.data.balance || 0) + balanceDelta })
          .eq('id', invoice.party_id);
      }
    }

    // Mark invoice as cancelled
    await supabase
      .from('invoices')
      .update({ status: 'cancelled' })
      .eq('id', invoiceId);

    return { ok: true, invoiceNumber: invoice.invoice_number };

  } catch (err) {
    console.error('cancelInvoice error:', err.message);
    throw err;
  }
}

// Confirm (lock) an invoice and mark stock movements as committed
async function confirmInvoice(invoiceId) {
  try {
    const invRes = await supabase
      .from('invoices')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', invoiceId)
      .select()
      .single();

    if (invRes.error) throw invRes.error;
    return invRes.data;
  } catch (err) {
    console.error('confirmInvoice error:', err.message);
    throw err;
  }
}

module.exports = {
  createInvoice,
  cancelInvoice,
  confirmInvoice
};
