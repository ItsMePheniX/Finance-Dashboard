import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'

type RecordType = 'income' | 'expense'

type FinancialRecord = {
  id: string
  user_id: string
  category: string
  amount: number
  type: RecordType
  currency: string
  note?: string
  record_date: string
  created_at: string
  updated_at: string
}

type RecordInput = {
  category: string
  amount: string
  type: RecordType
  currency: string
  note: string
  record_date: string
}

type RecordFilters = {
  type: '' | RecordType
  category: string
  start_date: string
  end_date: string
}

const blankForm: RecordInput = {
  category: '',
  amount: '',
  type: 'expense',
  currency: 'USD',
  note: '',
  record_date: new Date().toISOString().slice(0, 10),
}

function App() {
  const apiBaseUrl = useMemo(
    () => import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
    [],
  )

  const [accessToken, setAccessToken] = useState('')
  const [records, setRecords] = useState<FinancialRecord[]>([])
  const [filters, setFilters] = useState<RecordFilters>({
    type: '',
    category: '',
    start_date: '',
    end_date: '',
  })
  const [createForm, setCreateForm] = useState<RecordInput>(blankForm)
  const [editForm, setEditForm] = useState<RecordInput>(blankForm)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const startGoogleAuth = () => {
    window.location.href = `${apiBaseUrl}/auth/google/login`
  }

  const clearFeedback = () => {
    setStatusMessage('')
    setErrorMessage('')
  }

  const parseErrorMessage = (fallback: string, payload: unknown) => {
    if (
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof payload.message === 'string'
    ) {
      return payload.message
    }
    return fallback
  }

  const apiRequest = async (
    path: string,
    options: RequestInit = {},
  ): Promise<unknown> => {
    if (!accessToken.trim()) {
      throw new Error('Paste a valid access token first')
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        ...(options.headers ?? {}),
      },
    })

    const payload = (await response.json().catch(() => ({}))) as unknown
    if (!response.ok) {
      throw new Error(parseErrorMessage(`request failed with ${response.status}`, payload))
    }

    return payload
  }

  const loadRecords = async () => {
    clearFeedback()
    try {
      const query = new URLSearchParams()
      if (filters.type) query.set('type', filters.type)
      if (filters.category.trim()) query.set('category', filters.category.trim())
      if (filters.start_date) query.set('start_date', filters.start_date)
      if (filters.end_date) query.set('end_date', filters.end_date)

      const suffix = query.toString() ? `?${query.toString()}` : ''
      const result = (await apiRequest(`/api/records${suffix}`)) as {
        records: FinancialRecord[]
      }
      setRecords(result.records ?? [])
      setStatusMessage('Records loaded')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'failed to load records')
    }
  }

  const toPayload = (form: RecordInput) => ({
    category: form.category.trim(),
    amount: Number(form.amount),
    type: form.type,
    currency: form.currency.trim().toUpperCase(),
    note: form.note.trim(),
    record_date: form.record_date,
  })

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearFeedback()
    setIsSubmitting(true)
    try {
      await apiRequest('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(createForm)),
      })
      setCreateForm(blankForm)
      await loadRecords()
      setStatusMessage('Record created')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'failed to create record')
    } finally {
      setIsSubmitting(false)
    }
  }

  const startEdit = (record: FinancialRecord) => {
    setEditingRecordId(record.id)
    setEditForm({
      category: record.category,
      amount: String(record.amount),
      type: record.type,
      currency: record.currency,
      note: record.note ?? '',
      record_date: record.record_date,
    })
    clearFeedback()
  }

  const cancelEdit = () => {
    setEditingRecordId(null)
    setEditForm(blankForm)
  }

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingRecordId) return

    clearFeedback()
    setIsSubmitting(true)
    try {
      await apiRequest(`/api/records/${editingRecordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(editForm)),
      })
      cancelEdit()
      await loadRecords()
      setStatusMessage('Record updated')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'failed to update record')
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteRecord = async (id: string) => {
    clearFeedback()
    setIsSubmitting(true)
    try {
      await apiRequest(`/api/records/${id}`, { method: 'DELETE' })
      if (editingRecordId === id) {
        cancelEdit()
      }
      await loadRecords()
      setStatusMessage('Record deleted')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'failed to delete record')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page">
      <section className="card">
        <p className="kicker">Phase 4 Frontend</p>
        <h1>Records Console</h1>
        <p>
          Use your Supabase access token to manage financial records directly
          against your Go API.
        </p>

        <div className="actions">
          <button type="button" onClick={startGoogleAuth}>
            Sign in with Google
          </button>
          <a href={`${apiBaseUrl}/health`} target="_blank" rel="noreferrer">
            Health check
          </a>
        </div>

        <label className="fieldLabel" htmlFor="token">
          Access token
        </label>
        <textarea
          id="token"
          className="tokenInput"
          placeholder="Paste bearer token here"
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
        />

        <div className="statusLine">
          {statusMessage && <p className="ok">{statusMessage}</p>}
          {errorMessage && <p className="error">{errorMessage}</p>}
        </div>
      </section>

      <section className="card">
        <h2>Filter Records</h2>
        <div className="gridForm">
          <select
            value={filters.type}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                type: event.target.value as '' | RecordType,
              }))
            }
          >
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>

          <input
            placeholder="Category"
            value={filters.category}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, category: event.target.value }))
            }
          />

          <input
            type="date"
            value={filters.start_date}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, start_date: event.target.value }))
            }
          />

          <input
            type="date"
            value={filters.end_date}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, end_date: event.target.value }))
            }
          />
        </div>

        <div className="actions">
          <button type="button" onClick={() => void loadRecords()} disabled={isSubmitting}>
            Load records
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setFilters({ type: '', category: '', start_date: '', end_date: '' })
            }}
          >
            Reset filters
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Create Record</h2>
        <form className="gridForm" onSubmit={submitCreate}>
          <input
            required
            placeholder="Category"
            value={createForm.category}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, category: event.target.value }))
            }
          />
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount"
            value={createForm.amount}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, amount: event.target.value }))
            }
          />
          <select
            value={createForm.type}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                type: event.target.value as RecordType,
              }))
            }
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <input
            required
            maxLength={8}
            placeholder="Currency"
            value={createForm.currency}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, currency: event.target.value }))
            }
          />
          <input
            required
            type="date"
            value={createForm.record_date}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, record_date: event.target.value }))
            }
          />
          <input
            placeholder="Note"
            value={createForm.note}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, note: event.target.value }))
            }
          />
          <button type="submit" disabled={isSubmitting}>
            Add record
          </button>
        </form>
      </section>

      {editingRecordId && (
        <section className="card">
          <h2>Edit Record</h2>
          <form className="gridForm" onSubmit={submitEdit}>
            <input
              required
              placeholder="Category"
              value={editForm.category}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, category: event.target.value }))
              }
            />
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Amount"
              value={editForm.amount}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, amount: event.target.value }))
              }
            />
            <select
              value={editForm.type}
              onChange={(event) =>
                setEditForm((prev) => ({
                  ...prev,
                  type: event.target.value as RecordType,
                }))
              }
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <input
              required
              maxLength={8}
              placeholder="Currency"
              value={editForm.currency}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, currency: event.target.value }))
              }
            />
            <input
              required
              type="date"
              value={editForm.record_date}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, record_date: event.target.value }))
              }
            />
            <input
              placeholder="Note"
              value={editForm.note}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, note: event.target.value }))
              }
            />
            <div className="actions">
              <button type="submit" disabled={isSubmitting}>
                Save changes
              </button>
              <button type="button" className="ghost" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="card">
        <h2>Records ({records.length})</h2>
        {records.length === 0 ? (
          <p className="muted">No records loaded yet.</p>
        ) : (
          <div className="recordList">
            {records.map((record) => (
              <article key={record.id} className="recordItem">
                <div>
                  <p className="recordTitle">{record.category}</p>
                  <p className="muted">
                    {record.type.toUpperCase()} | {record.currency} {record.amount} |{' '}
                    {record.record_date}
                  </p>
                  {record.note && <p className="muted">{record.note}</p>}
                </div>
                <div className="actions compact">
                  <button type="button" className="ghost" onClick={() => startEdit(record)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="danger"
                    disabled={isSubmitting}
                    onClick={() => void deleteRecord(record.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default App
