import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { apiRequest } from '../api/client';

type RecordType = 'income' | 'expense';

type CreateRecordModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => Promise<void> | void;
  title?: string;
};

const initialState = {
  category: '',
  amount: '',
  type: 'expense' as RecordType,
  currency: 'INR',
  note: '',
  record_date: new Date().toISOString().slice(0, 10),
};

export default function CreateRecordModal({
  open,
  onClose,
  onCreated,
  title = 'Add record',
}: CreateRecordModalProps) {
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, loading, onClose]);

  const resetForm = () => {
    setForm(initialState);
    setError('');
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
    resetForm();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const category = form.category.trim();
    const amount = Number(form.amount);
    const currency = form.currency.trim().toUpperCase();

    if (!category) {
      setError('Category is required.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (!form.record_date) {
      setError('Record date is required.');
      return;
    }

    setLoading(true);
    try {
      await apiRequest<{ record: unknown }>('/api/records', {
        method: 'POST',
        body: {
          category,
          amount,
          type: form.type,
          currency: currency || 'INR',
          note: form.note.trim(),
          record_date: form.record_date,
        },
      });

      if (onCreated) {
        await onCreated();
      }
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create record');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(7, 10, 17, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 100,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-card)',
          backgroundColor: 'var(--color-bg-card)',
          boxShadow: '0 18px 44px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>{title}</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            style={{
              width: 30,
              height: 30,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
            }}
          >
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Category</span>
              <input
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                placeholder="Revenue"
                required
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Amount</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder="1200"
                required
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Type</span>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, type: event.target.value as RecordType }))
                }
                style={inputStyle}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Currency</span>
              <input
                value={form.currency}
                onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
                maxLength={8}
                required
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: '6px', gridColumn: '1 / -1' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Date</span>
              <input
                type="date"
                value={form.record_date}
                onChange={(event) => setForm((prev) => ({ ...prev, record_date: event.target.value }))}
                required
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: '6px', gridColumn: '1 / -1' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Note</span>
              <textarea
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="Optional note"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </label>
          </div>

          {error && (
            <div
              style={{
                marginTop: '12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(248, 113, 113, 0.35)',
                backgroundColor: 'var(--color-accent-red-soft)',
                color: 'var(--color-accent-red)',
                padding: '8px 10px',
                fontSize: '12px',
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              marginTop: '16px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              style={{
                padding: '9px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                fontSize: '13px',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '9px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'linear-gradient(135deg, var(--color-accent-blue), #7c3aed)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Saving...' : 'Create record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-subtle)',
  backgroundColor: 'var(--color-bg-dark)',
  color: 'var(--color-text-primary)',
  fontSize: '13px',
  fontFamily: 'inherit',
  padding: '9px 10px',
  outline: 'none',
};
