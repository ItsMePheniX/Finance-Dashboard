import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Plus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import CreateRecordModal from '../components/CreateRecordModal';

interface TransactionRow {
  id: string;
  description: string;
  vendor: string;
  category: string;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  icon: string;
}

type ApiRecord = {
  id: string;
  category: string;
  amount: number;
  type: 'income' | 'expense';
  currency: string;
  note: string;
  record_date: string;
};

const types = ['All', 'Income', 'Expense'];

const PAGE_SIZE = 8;

export default function TransactionsPage() {
  const { user } = useAuth();
  const canAdd = user?.role === 'Admin' || user?.role === 'NormalUser';
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const payload = await apiRequest<{ records: ApiRecord[] }>('/api/records?limit=200');
      setRecords(payload.records ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load records';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const allTransactions = useMemo<TransactionRow[]>(() => {
    return records.map((record) => ({
      id: record.id,
      description: record.note?.trim() || record.category,
      vendor: record.currency,
      category: record.category,
      type: record.type,
      amount: record.amount,
      date: record.record_date,
      status: 'completed',
      icon: record.type === 'income' ? '💰' : '💸',
    }));
  }, [records]);

  const categories = useMemo(() => {
    const set = new Set(allTransactions.map((item) => item.category));
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [allTransactions]);

  const filtered = useMemo(() => {
    let items = allTransactions;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.vendor.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q)
      );
    }
    if (selectedCategory !== 'All') items = items.filter((t) => t.category === selectedCategory);
    if (selectedType !== 'All') items = items.filter((t) => t.type === selectedType.toLowerCase());
    items = [...items].sort((a, b) =>
      sortDir === 'desc'
        ? new Date(b.date).getTime() - new Date(a.date).getTime()
        : new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return items;
  }, [allTransactions, search, selectedCategory, selectedType, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (totalPages === 0 && page !== 1) {
      setPage(1);
      return;
    }
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string }> = {
      completed: { bg: 'var(--color-accent-green-soft)', text: 'var(--color-accent-green)' },
      pending: { bg: 'var(--color-accent-amber-soft)', text: 'var(--color-accent-amber)' },
      failed: { bg: 'var(--color-accent-red-soft)', text: 'var(--color-accent-red)' },
    };
    const s = map[status] || map.completed;
    return (
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          padding: '4px 10px',
          borderRadius: '9999px',
          backgroundColor: s.bg,
          color: s.text,
          textTransform: 'capitalize',
        }}
      >
        {status}
      </span>
    );
  };

  const selectStyle: React.CSSProperties = {
    padding: '9px 14px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border-subtle)',
    backgroundColor: 'var(--color-bg-card)',
    color: 'var(--color-text-primary)',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238b8fa3' viewBox='0 0 24 24'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    paddingRight: '32px',
  };

  return (
    <div className="animate-fade-in" style={{ padding: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>Transactions</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {filtered.length} records found
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            id="export-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-card)',
              backgroundColor: 'transparent', color: 'var(--color-text-secondary)',
              cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent-blue)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-card)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          >
            <Download size={15} /> Export
          </button>
          {canAdd && (
            <button
              id="add-txn-btn"
              onClick={() => {
                setPage(1);
                setShowCreateModal(true);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px',
                borderRadius: 'var(--radius-md)', border: 'none',
                background: 'linear-gradient(135deg, var(--color-accent-blue), #7c3aed)',
                color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                boxShadow: '0 2px 12px rgba(79,140,255,0.25)', transition: 'all 0.25s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <Plus size={15} /> Add transaction
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)', padding: '9px 14px', flex: '1', maxWidth: '320px',
          }}
        >
          <Search size={16} color="var(--color-text-muted)" />
          <input
            id="txn-search"
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search transactions..."
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--color-text-primary)', fontSize: '13px', fontFamily: 'inherit', width: '100%',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)' }}>
          <Filter size={14} />
        </div>

        <select
          id="filter-category"
          value={selectedCategory}
          onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
          style={selectStyle}
        >
          {categories.map((c) => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
        </select>

        <select
          id="filter-type"
          value={selectedType}
          onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
          style={selectStyle}
        >
          {types.map((t) => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
        </select>

        <button
          id="sort-toggle"
          onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-secondary)',
            cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', transition: 'all 0.2s ease',
          }}
        >
          <ArrowUpDown size={14} />
          {sortDir === 'desc' ? 'Newest' : 'Oldest'}
        </button>
      </div>

      {/* Table */}
      {error && (
        <div
          style={{
            marginBottom: '12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            backgroundColor: 'var(--color-accent-red-soft)',
            padding: '10px 12px',
            color: 'var(--color-accent-red)',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {loading && (
        <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Loading transactions...
        </div>
      )}

      <div
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-card)',
          overflow: 'hidden',
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '50px 2fr 1fr 1fr 1fr 100px',
            padding: '14px 20px',
            borderBottom: '1px solid var(--color-border-subtle)',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-text-muted)',
          }}
        >
          <span></span>
          <span>Description</span>
          <span>Category</span>
          <span>Date</span>
          <span style={{ textAlign: 'right' }}>Amount</span>
          <span style={{ textAlign: 'center' }}>Status</span>
        </div>

        {/* Table rows */}
        {paginated.map((txn, idx) => (
          <div
            key={txn.id}
            id={`txn-${txn.id}`}
            className={`animate-fade-in stagger-${Math.min(idx + 1, 5)}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '50px 2fr 1fr 1fr 1fr 100px',
              padding: '16px 20px',
              alignItems: 'center',
              borderBottom: '1px solid var(--color-border-subtle)',
              transition: 'background-color 0.15s ease',
              cursor: 'default',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-card-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div
              style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-dark)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '16px',
              }}
            >
              {txn.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {txn.description} — {txn.vendor}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {txn.id}
              </div>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{txn.category}</span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              {new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span
              style={{
                fontSize: '14px', fontWeight: 700, textAlign: 'right',
                color: txn.type === 'income' ? 'var(--color-accent-green)' : 'var(--color-accent-red)',
              }}
            >
              {txn.type === 'income' ? '+' : '-'}₹{txn.amount.toLocaleString('en-IN')}
            </span>
            <div style={{ textAlign: 'center' }}>{statusBadge(txn.status)}</div>
          </div>
        ))}

        {paginated.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>
            No transactions found matching your filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: '16px', padding: '0 4px',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              id="prev-page"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-bg-card)',
                color: page === 1 ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              id="next-page"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-bg-card)',
                color: page === totalPages ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <CreateRecordModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={async () => {
          setPage(1);
          await loadRecords();
        }}
        title="Add transaction"
      />
    </div>
  );
}
