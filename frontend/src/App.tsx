import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

type AppRole = 'viewer' | 'analyst' | 'admin'
type RecordType = 'income' | 'expense'
type DashboardView = 'overview' | 'records' | 'import' | 'admin'

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

type TokenInfo = {
  valid: boolean
  expired: boolean
  expiresAtText: string
  secondsLeft: number
  error?: string
}

type RefreshResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

type AuthMeResponse = {
  user: {
    id: string
    email: string
    roles: AppRole[]
  }
}

type SummaryData = {
  total_income: number
  total_expenses: number
  net_balance: number
  recent_activity: FinancialRecord[]
}

type CategoryTotal = {
  type: RecordType
  category: string
  amount: number
}

type TrendPoint = {
  period: string
  total_income: number
  total_expense: number
  net_balance: number
}

type AdminUser = {
  id: string
  email: string
  full_name: string
  is_active: boolean
  roles: AppRole[]
}

const roleLabels: Record<AppRole, string> = {
  viewer: 'General User',
  analyst: 'Data Analyst',
  admin: 'Admin',
}

const blankForm: RecordInput = {
  category: '',
  amount: '',
  type: 'expense',
  currency: 'USD',
  note: '',
  record_date: new Date().toISOString().slice(0, 10),
}

const tokenStorageKey = 'finance-dashboard.access-token'

const decodeTokenInfo = (token: string): TokenInfo => {
  const trimmed = token.trim()
  if (!trimmed) {
    return {
      valid: false,
      expired: false,
      expiresAtText: '-',
      secondsLeft: 0,
      error: 'missing token',
    }
  }

  const parts = trimmed.split('.')
  if (parts.length !== 3) {
    return {
      valid: false,
      expired: false,
      expiresAtText: '-',
      secondsLeft: 0,
      error: 'invalid jwt format',
    }
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const normalized =
      base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const payload = JSON.parse(atob(normalized)) as { exp?: number }
    if (!payload.exp || typeof payload.exp !== 'number') {
      return {
        valid: false,
        expired: false,
        expiresAtText: '-',
        secondsLeft: 0,
        error: 'exp claim missing',
      }
    }

    const now = Math.floor(Date.now() / 1000)
    const secondsLeft = payload.exp - now
    const expired = secondsLeft <= 0

    return {
      valid: true,
      expired,
      expiresAtText: new Date(payload.exp * 1000).toLocaleString(),
      secondsLeft,
    }
  } catch {
    return {
      valid: false,
      expired: false,
      expiresAtText: '-',
      secondsLeft: 0,
      error: 'unable to decode token',
    }
  }
}

function App() {
  const apiBaseUrl = useMemo(
    () => import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
    [],
  )

  const [accessToken, setAccessToken] = useState('')
  const [activeView, setActiveView] = useState<DashboardView>('overview')
  const [profile, setProfile] = useState<AuthMeResponse['user'] | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
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
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)
  const [isRefreshingSession, setIsRefreshingSession] = useState(false)
  const [limit, setLimit] = useState(10)
  const [offset, setOffset] = useState(0)
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState<FinancialRecord | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([])
  const [trends, setTrends] = useState<TrendPoint[]>([])
  const [isLoadingOverview, setIsLoadingOverview] = useState(false)
  const [importText, setImportText] = useState(
    'category,amount,type,currency,record_date,note\nGroceries,1200,expense,INR,2026-04-10,Weekly essentials',
  )
  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [roleDraftByUser, setRoleDraftByUser] = useState<Record<string, AppRole>>({})

  const tokenInfo = useMemo(() => decodeTokenInfo(accessToken), [accessToken])
  const roles = profile?.roles ?? []
  const primaryRole: AppRole | null = roles.includes('admin')
    ? 'admin'
    : roles.includes('analyst')
      ? 'analyst'
      : roles.includes('viewer')
        ? 'viewer'
        : null
  const primaryRoleLabel = primaryRole ? roleLabels[primaryRole] : 'No role'
  const canReadData = roles.includes('viewer') || roles.includes('analyst') || roles.includes('admin')
  const canWriteRecords = roles.includes('analyst') || roles.includes('admin')
  const canImportData = roles.includes('analyst') || roles.includes('admin')
  const canManageUsers = roles.includes('admin')

  useEffect(() => {
    const saved = localStorage.getItem(tokenStorageKey)
    if (saved) {
      setAccessToken(saved)
    }
  }, [])

  useEffect(() => {
    if (accessToken.trim()) {
      localStorage.setItem(tokenStorageKey, accessToken)
      return
    }
    localStorage.removeItem(tokenStorageKey)
  }, [accessToken])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authSuccess = params.get('auth') === 'success'

    if (authSuccess) {
      params.delete('auth')
      const query = params.toString()
      const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`
      window.history.replaceState({}, '', nextUrl)
    }

    if (!authSuccess && accessToken.trim()) {
      return
    }

    void refreshSessionFromCookie(true)
  }, [])

  useEffect(() => {
    if (!accessToken.trim() || !tokenInfo.valid || tokenInfo.expired) {
      setProfile(null)
      return
    }
    void loadProfile()
  }, [accessToken, tokenInfo.valid, tokenInfo.expired])

  useEffect(() => {
    if (!canManageUsers && activeView === 'admin') {
      setActiveView('overview')
    }
    if (!canImportData && activeView === 'import') {
      setActiveView('records')
    }
  }, [activeView, canImportData, canManageUsers])

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

  const refreshSessionFromCookie = async (silent = false) => {
    if (!silent) {
      clearFeedback()
    }

    setIsRefreshingSession(true)
    try {
      const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })

      const payload = (await response.json().catch(() => ({}))) as unknown
      if (!response.ok) {
        throw new Error(parseErrorMessage(`refresh failed with ${response.status}`, payload))
      }

      const data = payload as RefreshResponse
      if (!data.access_token) {
        throw new Error('refresh response missing access token')
      }

      setAccessToken(data.access_token)
      setStatusMessage('Signed in from browser session')
    } catch (error) {
      if (!silent) {
        setErrorMessage(error instanceof Error ? error.message : 'failed to refresh session')
      }
    } finally {
      setIsRefreshingSession(false)
    }
  }

  const apiRequest = async (
    path: string,
    options: RequestInit = {},
  ): Promise<unknown> => {
    if (!accessToken.trim()) {
      throw new Error('Sign in first or restore session token')
    }

    if (!tokenInfo.valid) {
      throw new Error('Token looks invalid. Sign in again or restore session token')
    }

    if (tokenInfo.expired) {
      throw new Error('Token is expired. Sign in again to get a fresh token')
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

  const loadProfile = async () => {
    setIsLoadingProfile(true)
    try {
      const result = (await apiRequest('/auth/me')) as AuthMeResponse
      setProfile(result.user)
    } catch (error) {
      setProfile(null)
      setErrorMessage(error instanceof Error ? error.message : 'failed to load profile')
    } finally {
      setIsLoadingProfile(false)
    }
  }

  const loadOverviewData = async () => {
    clearFeedback()
    setIsLoadingOverview(true)
    try {
      const query = new URLSearchParams()
      if (filters.start_date) query.set('start_date', filters.start_date)
      if (filters.end_date) query.set('end_date', filters.end_date)
      const suffix = query.toString() ? `?${query.toString()}` : ''

      const [summaryRes, categoriesRes, trendsRes] = await Promise.all([
        apiRequest(`/api/summaries${suffix}`),
        apiRequest(`/api/summaries/by-category${suffix}`),
        apiRequest(`/api/summaries/trends${suffix}`),
      ])

      setSummary((summaryRes as { summary: SummaryData }).summary)
      setCategoryTotals((categoriesRes as { totals: CategoryTotal[] }).totals ?? [])
      setTrends((trendsRes as { trends: TrendPoint[] }).trends ?? [])
      setStatusMessage('Overview loaded')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'failed to load overview')
    } finally {
      setIsLoadingOverview(false)
    }
  }

  const parseImportRows = (text: string): RecordInput[] => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length === 0) return []

    const hasHeader = lines[0].toLowerCase().startsWith('category,amount,type')
    const payload = hasHeader ? lines.slice(1) : lines

    return payload.map((line) => {
      const [category, amount, type, currency, record_date, ...noteParts] = line.split(',')
      return {
        category: (category ?? '').trim(),
        amount: (amount ?? '').trim(),
        type: ((type ?? '').trim().toLowerCase() === 'income' ? 'income' : 'expense') as RecordType,
        currency: (currency ?? 'INR').trim().toUpperCase(),
        record_date: (record_date ?? '').trim(),
        note: noteParts.join(',').trim(),
      }
    })
  }

  const importRecords = async () => {
    if (!canImportData) return

    clearFeedback()
    const rows = parseImportRows(importText)
    if (rows.length === 0) {
      setErrorMessage('No rows found for import')
      return
    }

    setIsSubmitting(true)
    let successCount = 0
    try {
      for (const row of rows) {
        if (!row.category || !row.amount || !row.record_date) {
          continue
        }
        await apiRequest('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toPayload(row)),
        })
        successCount += 1
      }
      await loadRecords(0)
      setStatusMessage(`Imported ${successCount} record(s)`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'failed to import records')
    } finally {
      setIsSubmitting(false)
    }
  }

  const loadUsers = async () => {
    clearFeedback()
    setIsLoadingUsers(true)
    try {
      const result = (await apiRequest('/api/users')) as { users: AdminUser[] }
      setUsers(result.users ?? [])
      setStatusMessage('Users loaded')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'failed to load users')
    } finally {
      setIsLoadingUsers(false)
    }
  }

  const assignRole = async (userID: string) => {
    const role = roleDraftByUser[userID] ?? 'viewer'
    clearFeedback()
    setIsSubmitting(true)
    try {
      await apiRequest(`/api/users/${userID}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      await loadUsers()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'failed to assign role')
    } finally {
      setIsSubmitting(false)
    }
  }

  const setUserStatus = async (userID: string, is_active: boolean) => {
    clearFeedback()
    setIsSubmitting(true)
    try {
      await apiRequest(`/api/users/${userID}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      })
      await loadUsers()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'failed to update user status')
    } finally {
      setIsSubmitting(false)
    }
  }

  const loadRecords = async (nextOffset = offset) => {
    clearFeedback()
    setIsLoadingRecords(true)
    try {
      const query = new URLSearchParams()
      if (filters.type) query.set('type', filters.type)
      if (filters.category.trim()) query.set('category', filters.category.trim())
      if (filters.start_date) query.set('start_date', filters.start_date)
      if (filters.end_date) query.set('end_date', filters.end_date)
      query.set('limit', String(limit))
      query.set('offset', String(nextOffset))

      const suffix = query.toString() ? `?${query.toString()}` : ''
      const result = (await apiRequest(`/api/records${suffix}`)) as {
        records: FinancialRecord[]
      }
      setRecords(result.records ?? [])
      setOffset(nextOffset)
      setStatusMessage('Records loaded')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'failed to load records')
    } finally {
      setIsLoadingRecords(false)
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
    if (!canWriteRecords) return
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
    if (!canWriteRecords) return
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
    if (!editingRecordId || !canWriteRecords) return

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
    if (!canWriteRecords) return
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

  const requestDeleteRecord = (record: FinancialRecord) => {
    if (!canWriteRecords) return
    clearFeedback()
    setPendingDeleteRecord(record)
  }

  const confirmDeleteRecord = async () => {
    if (!pendingDeleteRecord) return
    const targetId = pendingDeleteRecord.id
    setPendingDeleteRecord(null)
    await deleteRecord(targetId)
  }

  const page = Math.floor(offset / limit) + 1
  const hasNextPage = records.length === limit
  const canGoPrev = offset > 0

  return (
    <main className="page">
      <section className="card">
        <p className="kicker">Role-based Dashboard</p>
        <h1>Finance Workspace</h1>
        <p>
          Shared shell for all users with role-specific views.
        </p>

        <div className="actions">
          <button type="button" onClick={startGoogleAuth}>
            Sign in with Google
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => void refreshSessionFromCookie()}
            disabled={isRefreshingSession}
          >
            {isRefreshingSession ? 'Restoring...' : 'Use browser session'}
          </button>
          <a href={`${apiBaseUrl}/health`} target="_blank" rel="noreferrer">
            Health check
          </a>
        </div>

        <label className="fieldLabel" htmlFor="token">
          Access token
        </label>
        <p className="hintText">
          Access token is auto-restored after login. Manual paste is optional for debugging.
        </p>

        <div className="tokenMetaRow">
          {!accessToken.trim() && <span className="tokenChip tokenChipNeutral">No token</span>}
          {accessToken.trim() && tokenInfo.valid && !tokenInfo.expired && (
            <span className="tokenChip tokenChipOk">Valid token</span>
          )}
          {accessToken.trim() && tokenInfo.valid && tokenInfo.expired && (
            <span className="tokenChip tokenChipError">Expired token</span>
          )}
          {accessToken.trim() && !tokenInfo.valid && (
            <span className="tokenChip tokenChipError">Invalid token</span>
          )}

          <span className="tokenMetaText">Expires: {tokenInfo.expiresAtText}</span>
        </div>

        {accessToken.trim() && tokenInfo.valid && !tokenInfo.expired && (
          <p className="hintText">
            About {Math.max(0, Math.floor(tokenInfo.secondsLeft / 60))} minute(s) remaining.
          </p>
        )}
        {accessToken.trim() && !tokenInfo.valid && tokenInfo.error && (
          <p className="error">Token issue: {tokenInfo.error}</p>
        )}
        <textarea
          id="token"
          className="tokenInput"
          placeholder="Paste bearer token here"
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
        />

        <div className="actions compactTop">
          <button
            type="button"
            className="ghost"
            onClick={() => setAccessToken('')}
            disabled={!accessToken}
          >
            Clear token
          </button>
        </div>

        <div className="statusLine">
          {statusMessage && <p className="ok">{statusMessage}</p>}
          {errorMessage && <p className="error">{errorMessage}</p>}
        </div>

        <p className="hintText roleLine">
          {isLoadingProfile && 'Loading role...'}
          {!isLoadingProfile && profile && (
            <>
              Signed in as <strong>{profile.email}</strong> | roles: {profile.roles.join(', ') || 'none'}
            </>
          )}
          {!isLoadingProfile && !profile && 'Sign in to load role-specific dashboard.'}
        </p>

        {profile && (
          <div className="roleBadgeRow">
            <span className="roleBadgeLabel">Current role:</span>
            <span className={`roleBadge roleBadge${primaryRole ? primaryRole[0].toUpperCase() + primaryRole.slice(1) : 'Neutral'}`}>
              {primaryRoleLabel}
            </span>
          </div>
        )}

        {canReadData && (
          <>
            <div className="viewTabs">
              <button
                type="button"
                className={activeView === 'overview' ? 'tabButton active' : 'tabButton'}
                onClick={() => setActiveView('overview')}
              >
                Overview
              </button>
              <button
                type="button"
                className={activeView === 'records' ? 'tabButton active' : 'tabButton'}
                onClick={() => setActiveView('records')}
              >
                Records
              </button>
              {canImportData && (
                <button
                  type="button"
                  className={activeView === 'import' ? 'tabButton active' : 'tabButton'}
                  onClick={() => setActiveView('import')}
                >
                  Import
                </button>
              )}
              {canManageUsers && (
                <button
                  type="button"
                  className={activeView === 'admin' ? 'tabButton active' : 'tabButton'}
                  onClick={() => setActiveView('admin')}
                >
                  Admin
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {canReadData && activeView === 'overview' && (
        <section className="card">
          <p className="kicker">{primaryRoleLabel} Dashboard</p>
          <h2>Overview</h2>
          <div className="actions compactTop">
            <button type="button" onClick={() => void loadOverviewData()} disabled={isLoadingOverview}>
              {isLoadingOverview ? 'Loading...' : 'Load overview'}
            </button>
          </div>

          {summary && (
            <div className="metricGrid">
              <article className="metricCard">
                <p className="muted">Total Income</p>
                <p className="recordTitle">{summary.total_income.toFixed(2)}</p>
              </article>
              <article className="metricCard">
                <p className="muted">Total Expenses</p>
                <p className="recordTitle">{summary.total_expenses.toFixed(2)}</p>
              </article>
              <article className="metricCard">
                <p className="muted">Net Balance</p>
                <p className="recordTitle">{summary.net_balance.toFixed(2)}</p>
              </article>
            </div>
          )}

          {categoryTotals.length > 0 && (
            <div className="tableWrap">
              <h3>Category totals</h3>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryTotals.map((row) => (
                    <tr key={`${row.type}-${row.category}`}>
                      <td>{row.type}</td>
                      <td>{row.category}</td>
                      <td>{row.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {trends.length > 0 && (
            <div className="tableWrap">
              <h3>Monthly trends</h3>
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Income</th>
                    <th>Expense</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.map((row) => (
                    <tr key={row.period}>
                      <td>{row.period}</td>
                      <td>{row.total_income.toFixed(2)}</td>
                      <td>{row.total_expense.toFixed(2)}</td>
                      <td>{row.net_balance.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {canImportData && activeView === 'import' && (
        <section className="card">
          <p className="kicker">{primaryRoleLabel} Dashboard</p>
          <h2>Import Data</h2>
          <p className="muted">Analyst and admin can import CSV rows to create records quickly.</p>
          <textarea
            className="tokenInput"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
          />
          <div className="actions compactTop">
            <button type="button" onClick={() => void importRecords()} disabled={isSubmitting}>
              {isSubmitting ? 'Importing...' : 'Import records'}
            </button>
            <span className="pagerText">Rows: {parseImportRows(importText).length}</span>
          </div>
        </section>
      )}

      {canManageUsers && activeView === 'admin' && (
        <section className="card">
          <p className="kicker">{primaryRoleLabel} Dashboard</p>
          <h2>User Management</h2>
          <div className="actions compactTop">
            <button type="button" onClick={() => void loadUsers()} disabled={isLoadingUsers}>
              {isLoadingUsers ? 'Loading...' : 'Load users'}
            </button>
          </div>

          {users.length > 0 && (
            <div className="recordList">
              {users.map((user) => (
                <article key={user.id} className="recordItem">
                  <div>
                    <p className="recordTitle">{user.full_name || user.email}</p>
                    <p className="muted">{user.email}</p>
                    <p className="muted">Roles: {user.roles.join(', ') || 'none'}</p>
                    <p className="muted">Status: {user.is_active ? 'active' : 'inactive'}</p>
                  </div>
                  <div className="actions compact">
                    <select
                      value={roleDraftByUser[user.id] ?? 'viewer'}
                      onChange={(event) =>
                        setRoleDraftByUser((prev) => ({
                          ...prev,
                          [user.id]: event.target.value as AppRole,
                        }))
                      }
                    >
                      <option value="viewer">general user</option>
                      <option value="analyst">analyst</option>
                      <option value="admin">admin</option>
                    </select>
                    <button type="button" onClick={() => void assignRole(user.id)}>
                      Assign role
                    </button>
                    <button
                      type="button"
                      className={user.is_active ? 'danger' : 'ghost'}
                      onClick={() => void setUserStatus(user.id, !user.is_active)}
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {canReadData && activeView === 'records' && (
        <>

      <section className="card">
        <p className="kicker">{primaryRoleLabel} Dashboard</p>
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

          <select
            value={String(limit)}
            onChange={(event) => {
              const nextLimit = Number(event.target.value)
              setLimit(nextLimit)
              setOffset(0)
            }}
          >
            <option value="10">10 per page</option>
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
          </select>
        </div>

        <div className="actions">
          <button
            type="button"
            onClick={() => void loadRecords(0)}
            disabled={isSubmitting || isLoadingRecords}
          >
            {isLoadingRecords ? 'Loading...' : 'Load records'}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setFilters({ type: '', category: '', start_date: '', end_date: '' })
              setOffset(0)
            }}
            disabled={isLoadingRecords}
          >
            Reset filters
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Create Record</h2>
        {!canWriteRecords && <p className="muted">General user mode: read-only access.</p>}
        <form className="gridForm" onSubmit={submitCreate}>
          <input
            required
            disabled={!canWriteRecords}
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
            disabled={!canWriteRecords}
            placeholder="Amount"
            value={createForm.amount}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, amount: event.target.value }))
            }
          />
          <select
            disabled={!canWriteRecords}
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
            disabled={!canWriteRecords}
            placeholder="Currency"
            value={createForm.currency}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, currency: event.target.value }))
            }
          />
          <input
            required
            type="date"
            disabled={!canWriteRecords}
            value={createForm.record_date}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, record_date: event.target.value }))
            }
          />
          <input
            disabled={!canWriteRecords}
            placeholder="Note"
            value={createForm.note}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, note: event.target.value }))
            }
          />
          <button type="submit" disabled={isSubmitting || !canWriteRecords}>
            {isSubmitting ? 'Saving...' : 'Add record'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Records ({records.length})</h2>
        {records.length === 0 ? (
          <div className="emptyState">
            <p className="muted">No records found.</p>
            <p className="muted">Load records or create your first transaction.</p>
            <div className="actions compactTop">
              <button
                type="button"
                onClick={() => void loadRecords(0)}
                disabled={isSubmitting || isLoadingRecords}
              >
                {isLoadingRecords ? 'Loading...' : 'Load records'}
              </button>
            </div>
          </div>
        ) : (
          <div className="recordList">
            {records.map((record) => (
              <article key={record.id} className="recordItem">
                {canWriteRecords && editingRecordId === record.id ? (
                  <form className="inlineEdit" onSubmit={submitEdit}>
                    <div className="gridForm inlineEditGrid">
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
                    </div>
                    <div className="actions compact">
                      <button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save changes'}
                      </button>
                      <button type="button" className="ghost" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div>
                      <p className="recordTitle">{record.category}</p>
                      <p className="muted">
                        {record.type.toUpperCase()} | {record.currency} {record.amount} |{' '}
                        {record.record_date}
                      </p>
                      {record.note && <p className="muted">{record.note}</p>}
                    </div>
                    {canWriteRecords && (
                      <div className="actions compact">
                        <button type="button" className="ghost" onClick={() => startEdit(record)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={isSubmitting}
                          onClick={() => requestDeleteRecord(record)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </article>
            ))}
          </div>
        )}

        <div className="actions pagerRow">
          <button
            type="button"
            className="ghost"
            disabled={!canGoPrev || isLoadingRecords}
            onClick={() => void loadRecords(Math.max(0, offset - limit))}
          >
            Previous
          </button>
          <span className="pagerText">Page {page}</span>
          <button
            type="button"
            className="ghost"
            disabled={!hasNextPage || isLoadingRecords}
            onClick={() => void loadRecords(offset + limit)}
          >
            Next
          </button>
        </div>
      </section>

        </>
      )}

      {!canReadData && profile && (
        <section className="card">
          <h2>No Dashboard Access</h2>
          <p className="muted">
            Ask an admin to assign one role: general user (viewer), analyst, or admin.
          </p>
        </section>
      )}

      {pendingDeleteRecord && (
        <div className="modalBackdrop" role="dialog" aria-modal="true">
          <div className="modalCard">
            <h3>Delete record?</h3>
            <p className="muted">
              This will permanently remove {pendingDeleteRecord.category} ({pendingDeleteRecord.currency}{' '}
              {pendingDeleteRecord.amount}) from your records.
            </p>
            <div className="actions modalActions">
              <button
                type="button"
                className="danger"
                disabled={isSubmitting}
                onClick={() => void confirmDeleteRecord()}
              >
                {isSubmitting ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button
                type="button"
                className="ghost"
                disabled={isSubmitting}
                onClick={() => setPendingDeleteRecord(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
