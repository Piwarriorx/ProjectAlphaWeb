'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { login, register } from './actions'

type StoredUser = {
  id?: number | string
  userId?: number | string
  user_id?: number | string
  username?: string
  role?: string
}

type PendingUser = {
  id: number
  username: string
}

type UserRealtimeRow = {
  id?: number
  username?: string | null
  role?: string | null
  group_id?: string | null
  hwid?: string | null
  hwid_approved?: boolean | null
  dismissed_banner_id?: number | null
  last_login_at?: string | null
  last_launch_at?: string | null
}

function buildSessionUser(row: UserRealtimeRow, fallback: PendingUser) {
  const id = Number(row.id || fallback.id)
  const username = String(row.username || fallback.username || '')
  const role = String(row.role || 'user')

  return {
    id,
    userId: id,
    username,
    role,
    group_id: row.group_id ?? null,
    hwid: row.hwid ?? null,
    hwid_approved: row.hwid_approved ?? false,
    dismissed_banner_id: row.dismissed_banner_id ?? null,
    last_login_at: row.last_login_at ?? null,
    last_launch_at: row.last_launch_at ?? null,
  }
}

function getRedirectForApprovedUser(row: UserRealtimeRow) {
  return row.role === 'admin' || row.hwid_approved === true ? '/dashboard' : '/hwid'
}

export default function LoginPage() {
  const [message, setMessage] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null)

  useEffect(() => {
    const session = localStorage.getItem('ezcrosshair_user')
    if (session) {
      let userData: StoredUser | null = null

      try {
        userData = JSON.parse(session)
      } catch {
        localStorage.removeItem('ezcrosshair_user')
        userData = null
      }

      const rawId = userData?.id ?? userData?.userId ?? userData?.user_id
      const parsedId = typeof rawId === 'string' ? parseInt(rawId, 10) : rawId

      if (!parsedId || Number.isNaN(parsedId)) {
        localStorage.removeItem('ezcrosshair_user')
      } else {
        ;(async () => {
          const supabase = createClient()
          const { data, error } = await supabase
            .from('users')
            .select('id, username, role, group_id, hwid, hwid_approved, dismissed_banner_id, last_login_at, last_launch_at')
            .eq('id', parsedId)
            .single()

          // If the admin deleted/rejected this user while the browser still had
          // localStorage, clear the stale local session and stay on /login.
          if (error || !data || data.role === 'pending') {
            localStorage.removeItem('ezcrosshair_user')
            return
          }

          const dbUser = data as UserRealtimeRow
          const sessionUser = {
            id: Number(dbUser.id),
            userId: Number(dbUser.id),
            username: dbUser.username || userData?.username || '',
            role: dbUser.role || userData?.role || 'user',
            group_id: dbUser.group_id ?? null,
            hwid: dbUser.hwid ?? null,
            hwid_approved: dbUser.hwid_approved ?? false,
            dismissed_banner_id: dbUser.dismissed_banner_id ?? null,
            last_login_at: dbUser.last_login_at ?? null,
            last_launch_at: dbUser.last_launch_at ?? null,
          }

          localStorage.setItem('ezcrosshair_user', JSON.stringify(sessionUser))
          window.location.href = getRedirectForApprovedUser(dbUser)
        })()
        return
      }
    }

    const pendingSession = localStorage.getItem('ezcrosshair_pending_user')
    if (pendingSession) {
      try {
        const parsedPending = JSON.parse(pendingSession) as Partial<PendingUser>
        const pendingId = Number(parsedPending.id)

        if (pendingId && !Number.isNaN(pendingId)) {
          setPendingUser({
            id: pendingId,
            username: String(parsedPending.username || ''),
          })
          setMessage('Account created. Waiting for approval.')
        } else {
          localStorage.removeItem('ezcrosshair_pending_user')
        }
      } catch {
        localStorage.removeItem('ezcrosshair_pending_user')
      }
    }  }, [])

  useEffect(() => {
    if (!pendingUser?.id) return

    const supabase = createClient()
    let cancelled = false

    const rejectPendingUser = () => {
      localStorage.removeItem('ezcrosshair_pending_user')
      setPendingUser(null)
      setMessage('Registration was rejected. Please contact an admin.')
    }

    const approvePendingUser = (row: UserRealtimeRow) => {
      if (!row.role || row.role === 'pending') {
        setMessage('Account created. Waiting for approval.')
        return
      }

      const sessionUser = buildSessionUser(row, pendingUser)
      localStorage.setItem('ezcrosshair_user', JSON.stringify(sessionUser))
      localStorage.removeItem('ezcrosshair_pending_user')
      setPendingUser(null)
      setMessage('Approved. Redirecting...')

      window.location.href = getRedirectForApprovedUser(row)
    }

    // Initial check catches cases where the admin approved/deleted the row
    // while this tab was offline or before the realtime subscription connected.
    ;(async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, role, group_id, hwid, hwid_approved, dismissed_banner_id, last_login_at, last_launch_at')
        .eq('id', pendingUser.id)
        .single()

      if (cancelled) return

      if (error || !data) {
        rejectPendingUser()
        return
      }

      approvePendingUser(data as UserRealtimeRow)
    })()

    const channel = supabase
      .channel(`pending-user-approval-${pendingUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${pendingUser.id}`,
        },
        (payload) => {
          const changedUser = payload.new as UserRealtimeRow | null
          if (!changedUser) return

          approvePendingUser(changedUser)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          const deletedUserId = Number((payload.old as { id?: number | string } | null)?.id)

          if (deletedUserId === pendingUser.id) {
            rejectPendingUser()
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [pendingUser?.id, pendingUser?.username])


  async function handleLogin(formData: FormData) {
  setMessage('')
  const result = await login(formData)
  
  if (result?.error) {
    setMessage(result.error)
    return
  }
  
  if (result?.success === 'login' && result?.userId) {
    localStorage.setItem('ezcrosshair_user', JSON.stringify({
      id: result.userId,
      userId: result.userId,
      username: result.username,
      role: result.role  // <-- Store role
    }))
    
    window.location.href = result.redirectTo || '/dashboard'
  }
}

  async function handleRegister(formData: FormData) {
    setMessage('')
    const result = await register(formData)

    if (result && 'error' in result && result.error) {
      setMessage(result.error)
      return
    }

    if (result && 'success' in result && result.success) {
      setMessage(result.success)

      const pendingUserId = 'pendingUserId' in result ? Number(result.pendingUserId) : null
      if (pendingUserId && !Number.isNaN(pendingUserId)) {
        const nextPendingUser = {
          id: pendingUserId,
          username: 'username' in result ? String(result.username || '') : '',
        }

        setPendingUser(nextPendingUser)
        localStorage.setItem('ezcrosshair_pending_user', JSON.stringify(nextPendingUser))
        setIsRegister(false)
      }
    }
  }

  const isPositiveMessage =
    message.toLowerCase().includes('success') ||
    message.toLowerCase().includes('created') ||
    message.toLowerCase().includes('approved') ||
    message.toLowerCase().includes('approval') ||
    message.toLowerCase().includes('wait') ||
    message.toLowerCase().includes('pending')

  return (
    <>
      <style jsx global>{`
        :root {
          --accent-primary: #ff9500;
          --accent-hover: #ffad33;
          --accent-soft: rgba(255, 149, 0, 0.12);
          --accent-border: rgba(255, 149, 0, 0.35);
          --bg-main: #0a0c15;
          --bg-card: rgba(18, 21, 34, 0.86);
          --bg-field: rgba(7, 9, 16, 0.74);
          --text-main: #ffffff;
          --text-secondary: #a5acbd;
          --text-muted: #6f7688;
          --border-soft: rgba(255, 255, 255, 0.1);
          --danger: #ff5555;
          --success: #00d47e;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: var(--bg-main);
        }

        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          color: var(--text-main);
          font-family: Inter, "Segoe UI", system-ui, -apple-system, sans-serif;
          background:
            radial-gradient(circle at top, rgba(255, 149, 0, 0.12), transparent 34%),
            linear-gradient(135deg, #0a0c15 0%, #101423 54%, #090b12 100%);
        }

        .auth-card {
          width: 100%;
          max-width: 420px;
          padding: 34px;
          border: 1px solid var(--border-soft);
          border-radius: 18px;
          background: var(--bg-card);
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(14px);
        }

        .auth-brand {
          text-align: center;
          margin-bottom: 28px;
        }

        .auth-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-bottom: 10px;
          font-size: 32px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .auth-logo-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 34px;
          height: 34px;
          padding: 0 9px;
          border-radius: 9px;
          background: linear-gradient(135deg, var(--accent-primary), #ff7600);
          color: #080a10;
          box-shadow: 0 0 24px rgba(255, 149, 0, 0.28);
        }

        .auth-subtitle {
          color: var(--text-secondary);
          font-size: 13px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .auth-message,
        .pending-box {
          margin-bottom: 18px;
          padding: 13px 14px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.5;
        }

        .auth-message.success,
        .pending-box {
          border: 1px solid var(--accent-border);
          background: var(--accent-soft);
          color: var(--accent-hover);
        }

        .auth-message.error {
          border: 1px solid rgba(255, 85, 85, 0.38);
          background: rgba(255, 85, 85, 0.1);
          color: var(--danger);
        }

        .pending-box strong {
          display: block;
          color: var(--text-main);
          margin-bottom: 4px;
        }

        .auth-form {
          display: grid;
          gap: 16px;
        }

        .field-label {
          display: block;
          margin-bottom: 8px;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .field-input {
          width: 100%;
          height: 50px;
          border: 1px solid var(--border-soft);
          border-radius: 12px;
          background: var(--bg-field);
          color: var(--text-main);
          outline: none;
          padding: 0 14px;
          font-size: 15px;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }

        .field-input::placeholder {
          color: var(--text-muted);
        }

        .field-input:focus {
          border-color: var(--accent-primary);
          background: rgba(8, 10, 18, 0.92);
          box-shadow: 0 0 0 3px rgba(255, 149, 0, 0.12);
        }

        .auth-button {
          width: 100%;
          height: 50px;
          margin-top: 4px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--accent-primary), #ff7600);
          color: #080a10;
          cursor: pointer;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
        }

        .auth-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 28px rgba(255, 149, 0, 0.22);
          filter: brightness(1.04);
        }

        .auth-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 24px 0 20px;
          color: var(--text-muted);
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .auth-divider::before,
        .auth-divider::after {
          content: '';
          height: 1px;
          flex: 1;
          background: var(--border-soft);
        }

        .auth-switch {
          text-align: center;
          color: var(--text-secondary);
          font-size: 14px;
        }

        .auth-switch button {
          margin-left: 6px;
          border: 0;
          background: transparent;
          color: var(--accent-primary);
          cursor: pointer;
          font: inherit;
          font-weight: 700;
          padding: 0;
        }

        .auth-switch button:hover {
          color: var(--accent-hover);
        }

        .auth-footer {
          margin-top: 24px;
          padding-top: 18px;
          border-top: 1px solid var(--border-soft);
          text-align: center;
          color: var(--text-muted);
          font-size: 12px;
        }

        @media (max-width: 480px) {
          .auth-page {
            padding: 16px;
            align-items: flex-start;
            padding-top: 54px;
          }

          .auth-card {
            padding: 26px 20px;
            border-radius: 16px;
          }

          .auth-logo {
            font-size: 28px;
          }
        }
      `}</style>

      <main className="auth-page">
        <section className="auth-card" aria-label={isRegister ? 'Create account form' : 'Sign in form'}>
          <div className="auth-brand">
            <div className="auth-logo">
              <span>EzCrosshair</span>
              <span className="auth-logo-mark">X</span>
            </div>
            <div className="auth-subtitle">Account Access</div>
          </div>

          {message && (
            <div className={`auth-message ${isPositiveMessage ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          {pendingUser && (
            <div className="pending-box">
              <strong>Approval pending</strong>
              Your account is under review. This page will continue automatically after approval.
            </div>
          )}

          {!isRegister ? (
            <form action={handleLogin} className="auth-form">
              <div>
                <label className="field-label" htmlFor="login-username">Username</label>
                <input
                  id="login-username"
                  className="field-input"
                  name="username"
                  type="text"
                  placeholder="Username"
                  required
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  className="field-input"
                  name="password"
                  type="password"
                  placeholder="Password"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className="auth-button">
                Sign In
              </button>
            </form>
          ) : (
            <form action={handleRegister} className="auth-form">
              <div>
                <label className="field-label" htmlFor="register-username">Username</label>
                <input
                  id="register-username"
                  className="field-input"
                  name="username"
                  type="text"
                  placeholder="Username"
                  required
                  minLength={3}
                  maxLength={32}
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="register-password">Password</label>
                <input
                  id="register-password"
                  className="field-input"
                  name="password"
                  type="password"
                  placeholder="Password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="register-password-confirm">Confirm Password</label>
                <input
                  id="register-password-confirm"
                  className="field-input"
                  name="passwordConfirm"
                  type="password"
                  placeholder="Confirm password"
                  required
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className="auth-button">
                Create Account
              </button>
            </form>
          )}

          <div className="auth-divider">Access</div>

          <div className="auth-switch">
            <span>{isRegister ? 'Already have an account?' : "Need an account?"}</span>
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister)
                setMessage('')
              }}
            >
              {isRegister ? 'Sign in' : 'Register'}
            </button>
          </div>

          <div className="auth-footer">Protected login</div>
        </section>
      </main>
    </>
  )
}
