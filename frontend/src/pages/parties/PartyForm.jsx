import React, { useState, useEffect } from 'react';
import { useParties } from '../../hooks/useParties';
import { Button } from '../../components/ui/Button';

const STATES = [
  { code: '01', name: 'Andaman and Nicobar' },
  { code: '02', name: 'Andhra Pradesh' },
  { code: '03', name: 'Arunachal Pradesh' },
  { code: '04', name: 'Assam' },
  { code: '05', name: 'Bihar' },
  { code: '06', name: 'Chhattisgarh' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Goa' },
  { code: '09', name: 'Gujarat' },
  { code: '10', name: 'Haryana' },
  { code: '12', name: 'Himachal Pradesh' },
  { code: '13', name: 'Jharkhand' },
  { code: '14', name: 'Karnataka' },
  { code: '15', name: 'Kerala' },
  { code: '16', name: 'Madhya Pradesh' },
  { code: '17', name: 'Maharashtra' },
  { code: '18', name: 'Manipur' },
  { code: '19', name: 'Meghalaya' },
  { code: '20', name: 'Mizoram' },
  { code: '21', name: 'Nagaland' },
  { code: '22', name: 'Odisha' },
  { code: '23', name: 'Puducherry' },
  { code: '24', name: 'Punjab' },
  { code: '25', name: 'Rajasthan' },
  { code: '26', name: 'Sikkim' },
  { code: '27', name: 'Tamil Nadu' },
  { code: '28', name: 'Telangana' },
  { code: '29', name: 'Tripura' },
  { code: '30', name: 'Uttar Pradesh' },
  { code: '31', name: 'Uttarakhand' },
  { code: '32', name: 'West Bengal' },
];

export default function PartyForm({ party, onSuccess, onCancel }) {
  const { createParty, updateParty } = useParties();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    type: 'customer',
    name: '',
    phone: '',
    address: '',
    state: '',
    state_code: '',
    gstin: '',
    credit_days: 30,
    credit_limit: 0,
  });

  useEffect(() => {
    if (party) {
      setForm({
        type: party.type || 'customer',
        name: party.name || '',
        phone: party.phone || '',
        address: party.address || '',
        state: party.state || '',
        state_code: party.state_code || '',
        gstin: party.gstin || '',
        credit_days: party.credit_days || 30,
        credit_limit: party.credit_limit || 0,
      });
    }
  }, [party]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));

    if (field === 'state') {
      const selectedState = STATES.find(s => s.name === value);
      if (selectedState) {
        setForm(prev => ({ ...prev, state_code: selectedState.code }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (party) {
        await updateParty(party.id, form);
      } else {
        await createParty(form);
      }
      onSuccess();
    } catch (err) {
      setError(err.message || 'Error saving party');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && (
        <div style={{ padding: '12px 16px', background: '#FEE2E2', color: '#991B1B', borderRadius: '6px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
          Party Type
        </label>
        <select
          value={form.type}
          onChange={(e) => handleChange('type', e.target.value)}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
        >
          <option value="customer">Customer</option>
          <option value="supplier">Supplier</option>
          <option value="both">Both</option>
        </select>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
          Name *
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
          required
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
          Phone
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder="+919876543210"
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
          Address
        </label>
        <textarea
          value={form.address}
          onChange={(e) => handleChange('address', e.target.value)}
          rows="3"
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
          State
        </label>
        <select
          value={form.state}
          onChange={(e) => handleChange('state', e.target.value)}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
        >
          <option value="">Select state...</option>
          {STATES.map(s => (
            <option key={s.code} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
          GSTIN
        </label>
        <input
          type="text"
          value={form.gstin}
          onChange={(e) => handleChange('gstin', e.target.value)}
          placeholder="27AABCT1234H1Z0"
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
        />
      </div>

      {form.type === 'customer' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                Credit Days
              </label>
              <input
                type="number"
                min="0"
                value={form.credit_days}
                onChange={(e) => handleChange('credit_days', parseInt(e.target.value))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                Credit Limit (₹)
              </label>
              <input
                type="number"
                min="0"
                value={form.credit_limit}
                onChange={(e) => handleChange('credit_limit', parseInt(e.target.value))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={loading}>
          {party ? 'Update Party' : 'Create Party'}
        </Button>
      </div>
    </form>
  );
}
