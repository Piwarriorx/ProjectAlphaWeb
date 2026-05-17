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
          setMessage('Account created! Waiting for admin approval.')
        } else {
          localStorage.removeItem('ezcrosshair_pending_user')
        }
      } catch {
        localStorage.removeItem('ezcrosshair_pending_user')
      }
    }

    const particlesContainer = document.getElementById('particles')
    if (particlesContainer && particlesContainer.children.length === 0) {
      for (let i = 0; i < 28; i++) {
        const particle = document.createElement('div')
        particle.className = 'particle'
        particle.style.left = `${Math.random() * 100}%`
        particle.style.animationDelay = `${Math.random() * 16}s`
        particle.style.animationDuration = `${14 + Math.random() * 12}s`
        particle.style.setProperty('--drift', `${Math.random() * 140 - 70}px`)
        particle.style.setProperty('--size', `${2 + Math.random() * 4}px`)
        particlesContainer.appendChild(particle)
      }
    }
  }, [])

  useEffect(() => {
    if (!pendingUser?.id) return

    const supabase = createClient()
    let cancelled = false

    const rejectPendingUser = () => {
      localStorage.removeItem('ezcrosshair_pending_user')
      setPendingUser(null)
      setMessage('Your registration was rejected. Please contact an admin or register again.')
    }

    const approvePendingUser = (row: UserRealtimeRow) => {
      if (!row.role || row.role === 'pending') {
        setMessage('Account created! Waiting for admin approval.')
        return
      }

      const sessionUser = buildSessionUser(row, pendingUser)
      localStorage.setItem('ezcrosshair_user', JSON.stringify(sessionUser))
      localStorage.removeItem('ezcrosshair_pending_user')
      setPendingUser(null)
      setMessage('Account approved! Redirecting...')

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
        role: result.role,
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

  const normalizedMessage = message.toLowerCase()
  const isPositiveMessage =
    normalizedMessage.includes('success') ||
    normalizedMessage.includes('created') ||
    normalizedMessage.includes('approval') ||
    normalizedMessage.includes('approved') ||
    normalizedMessage.includes('redirecting') ||
    normalizedMessage.includes('wait') ||
    normalizedMessage.includes('pending')
  const messageIcon = isPositiveMessage
    ? normalizedMessage.includes('wait') || normalizedMessage.includes('pending')
      ? '⏳'
      : '✓'
    : '⚠'

  return (
    <>
      <style jsx global>{`
        :root {
          --accent-primary: #ff9500;
          --accent-secondary: #ff7700;
          --accent-soft: rgba(255, 149, 0, 0.12);
          --accent-glow: rgba(255, 149, 0, 0.52);
          --accent-glow-strong: rgba(255, 149, 0, 0.78);
          --bg-deep: #070912;
          --bg-card: rgba(14, 17, 30, 0.72);
          --bg-field: rgba(3, 6, 14, 0.62);
          --text-primary: #fff7eb;
          --text-secondary: #a4acbf;
          --text-muted: #626a80;
          --glass-border: rgba(255, 255, 255, 0.1);
          --glass-border-strong: rgba(255, 149, 0, 0.34);
          --danger: #ff4d5e;
          --danger-glow: rgba(255, 77, 94, 0.38);
          --success: #00ff88;
          --success-glow: rgba(0, 255, 136, 0.42);
        }

        * {
          box-sizing: border-box;
        }

        html,
        body {
          min-height: 100%;
          background: var(--bg-deep);
        }

        button,
        input {
          font: inherit;
        }

        .login-shell {
          min-height: 100vh;
          min-height: 100svh;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 18px;
          color: var(--text-primary);
          background:
            radial-gradient(circle at 18% 16%, rgba(255, 149, 0, 0.2), transparent 30%),
            radial-gradient(circle at 82% 20%, rgba(255, 119, 0, 0.12), transparent 28%),
            radial-gradient(circle at 50% 110%, rgba(255, 149, 0, 0.14), transparent 34%),
            linear-gradient(135deg, #070912 0%, #101321 42%, #090b13 100%);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .login-shell::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 149, 0, 0.065) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 149, 0, 0.055) 1px, transparent 1px);
          background-size: 46px 46px;
          mask-image: radial-gradient(circle at 50% 45%, black, transparent 78%);
          opacity: 0.7;
          pointer-events: none;
        }

        .login-shell::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, transparent, rgba(255, 149, 0, 0.04) 50%, transparent);
          background-size: 100% 9px;
          opacity: 0.36;
          mix-blend-mode: screen;
          pointer-events: none;
          animation: scanline 8s linear infinite;
        }

        .particles {
          position: fixed;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 0;
        }

        .particle {
          position: absolute;
          top: 106%;
          width: var(--size, 3px);
          height: var(--size, 3px);
          border-radius: 999px;
          background: var(--accent-primary);
          opacity: 0;
          box-shadow: 0 0 14px var(--accent-glow);
          animation: particleFloat 16s linear infinite;
        }

        .login-stage {
          width: min(100%, 1120px);
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(360px, 440px);
          gap: clamp(22px, 5vw, 74px);
          align-items: center;
        }

        .login-copy {
          max-width: 560px;
          padding: 14px;
        }

        .eyebrow {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 9px 14px;
          margin-bottom: 26px;
          border-radius: 999px;
          background: rgba(255, 149, 0, 0.08);
          border: 1px solid rgba(255, 149, 0, 0.24);
          color: #ffd8a3;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          box-shadow: 0 0 36px rgba(255, 149, 0, 0.08);
        }

        .eyebrow-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--accent-primary);
          box-shadow: 0 0 18px var(--accent-glow-strong);
        }

        .hero-title {
          margin: 0;
          font-size: clamp(42px, 7vw, 76px);
          line-height: 0.96;
          letter-spacing: -3.5px;
          font-weight: 900;
          text-wrap: balance;
        }

        .hero-gradient {
          display: block;
          color: transparent;
          background: linear-gradient(135deg, #fff9ef, #ff9500 48%, #ff6d00);
          background-clip: text;
          -webkit-background-clip: text;
          text-shadow: 0 0 42px rgba(255, 149, 0, 0.22);
        }

        .hero-copy {
          margin: 22px 0 0;
          color: var(--text-secondary);
          font-size: 16px;
          line-height: 1.8;
          max-width: 510px;
        }

        .feature-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 34px;
        }

        .feature-chip {
          min-height: 96px;
          padding: 16px;
          border-radius: 18px;
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.025));
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(18px);
        }

        .feature-chip strong {
          display: block;
          color: #fff4df;
          font-size: 13px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .feature-chip span {
          display: block;
          margin-top: 8px;
          color: var(--text-muted);
          font-size: 12px;
          line-height: 1.5;
        }

        .login-card {
          position: relative;
          width: 100%;
          overflow: hidden;
          isolation: isolate;
          padding: clamp(26px, 4vw, 38px);
          border-radius: 30px;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.105), rgba(255, 255, 255, 0.026)),
            var(--bg-card);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(28px) saturate(130%);
          box-shadow:
            0 34px 90px rgba(0, 0, 0, 0.55),
            0 0 0 1px rgba(255, 149, 0, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
        }

        .login-card::before {
          content: '';
          position: absolute;
          inset: 0;
          padding: 1px;
          border-radius: inherit;
          background: linear-gradient(145deg, rgba(255, 149, 0, 0.66), rgba(255, 255, 255, 0.04), rgba(255, 119, 0, 0.36));
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          pointer-events: none;
          opacity: 0.9;
        }

        .card-glow {
          position: absolute;
          pointer-events: none;
          z-index: -1;
          border-radius: 999px;
          filter: blur(4px);
        }

        .card-glow--one {
          width: 280px;
          height: 280px;
          right: -130px;
          top: -130px;
          background: radial-gradient(circle, rgba(255, 149, 0, 0.36), transparent 65%);
        }

        .card-glow--two {
          width: 220px;
          height: 220px;
          left: -110px;
          bottom: -120px;
          background: radial-gradient(circle, rgba(255, 119, 0, 0.16), transparent 68%);
        }

        .corner {
          position: absolute;
          width: 42px;
          height: 42px;
          pointer-events: none;
          opacity: 0.78;
        }

        .corner::before,
        .corner::after {
          content: '';
          position: absolute;
          background: var(--accent-primary);
          box-shadow: 0 0 18px var(--accent-glow);
        }

        .corner::before {
          width: 100%;
          height: 1px;
        }

        .corner::after {
          width: 1px;
          height: 100%;
        }

        .corner--tl {
          top: 18px;
          left: 18px;
        }

        .corner--br {
          right: 18px;
          bottom: 18px;
          transform: rotate(180deg);
        }

        .brand-block {
          position: relative;
          z-index: 1;
          text-align: center;
          margin-bottom: 26px;
        }

        .brand-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 10px;
          font-size: clamp(30px, 6vw, 38px);
          font-weight: 900;
          letter-spacing: -1.8px;
          color: #fffaf0;
        }

        .brand-mark {
          min-width: 43px;
          height: 43px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          color: #100800;
          background: linear-gradient(135deg, #ffb13d, #ff9500 46%, #ff6d00);
          box-shadow:
            0 0 28px rgba(255, 149, 0, 0.62),
            inset 0 1px 0 rgba(255, 255, 255, 0.5);
          transform: translateY(1px);
        }

        .brand-subtitle {
          margin: 0;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 2.3px;
          text-transform: uppercase;
        }

        .mode-switch {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 6px;
          margin-bottom: 24px;
          border-radius: 18px;
          background: rgba(3, 6, 14, 0.54);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .mode-pill {
          height: 42px;
          border: 0;
          border-radius: 13px;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          transition: 180ms ease;
        }

        .mode-pill:hover {
          color: #ffd7a1;
          background: rgba(255, 149, 0, 0.08);
        }

        .mode-pill.is-active {
          color: #140900;
          background: linear-gradient(135deg, #ffb13d, #ff9500 48%, #ff7700);
          box-shadow: 0 10px 28px rgba(255, 149, 0, 0.28);
        }

        .status-banner,
        .pending-panel {
          position: relative;
          z-index: 1;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 18px;
          padding: 14px 15px;
          border-radius: 16px;
          font-size: 13px;
          line-height: 1.55;
          animation: bannerIn 260ms ease both;
          backdrop-filter: blur(16px);
        }

        .status-banner {
          align-items: center;
        }

        .status-accent,
        .pending-panel {
          color: #ffd09a;
          background: rgba(255, 149, 0, 0.1);
          border: 1px solid rgba(255, 149, 0, 0.27);
          box-shadow: 0 0 26px rgba(255, 149, 0, 0.07);
        }

        .status-danger {
          color: #ff98a1;
          background: rgba(255, 77, 94, 0.1);
          border: 1px solid rgba(255, 77, 94, 0.34);
          box-shadow: 0 0 26px rgba(255, 77, 94, 0.07);
        }

        .status-icon {
          flex: 0 0 auto;
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.08);
        }

        .pending-panel strong {
          display: block;
          margin-bottom: 2px;
          color: #fff0d5;
        }

        .auth-form {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 17px;
          text-align: left;
        }

        .input-group {
          display: grid;
          gap: 9px;
        }

        .field-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.25px;
          text-transform: uppercase;
        }

        .field-label span:last-child {
          color: rgba(255, 149, 0, 0.84);
          font-size: 11px;
          font-weight: 800;
        }

        .input-shell {
          position: relative;
          border-radius: 16px;
          transition: transform 180ms ease, box-shadow 180ms ease;
        }

        .input-shell:focus-within {
          transform: translateY(-1px);
          box-shadow: 0 0 0 4px rgba(255, 149, 0, 0.08), 0 18px 34px rgba(0, 0, 0, 0.22);
        }

        .field-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255, 149, 0, 0.82);
          font-size: 17px;
          z-index: 2;
          pointer-events: none;
          text-shadow: 0 0 16px rgba(255, 149, 0, 0.3);
        }

        .cyber-input {
          width: 100%;
          height: 54px;
          padding: 14px 16px 14px 48px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          outline: none;
          color: var(--text-primary);
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.05), transparent),
            var(--bg-field);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
          transition: border-color 180ms ease, background 180ms ease, color 180ms ease;
        }

        .cyber-input::placeholder {
          color: rgba(164, 172, 191, 0.42);
        }

        .cyber-input:focus {
          border-color: rgba(255, 149, 0, 0.58);
          background:
            linear-gradient(135deg, rgba(255, 149, 0, 0.08), transparent),
            rgba(3, 6, 14, 0.78);
        }

        .cyber-button {
          position: relative;
          width: 100%;
          height: 56px;
          margin-top: 6px;
          overflow: hidden;
          border: 0;
          border-radius: 17px;
          cursor: pointer;
          color: #150900;
          background: linear-gradient(135deg, #ffbd57, #ff9500 48%, #ff6d00);
          box-shadow:
            0 18px 38px rgba(255, 149, 0, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.46);
          font-weight: 950;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
        }

        .cyber-button:hover {
          transform: translateY(-2px);
          filter: saturate(1.1);
          box-shadow:
            0 24px 46px rgba(255, 149, 0, 0.34),
            0 0 44px rgba(255, 149, 0, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.52);
        }

        .cyber-button:active {
          transform: translateY(0);
        }

        .cyber-button::before {
          content: '';
          position: absolute;
          inset: 0;
          transform: translateX(-110%);
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.56), transparent);
          transition: transform 620ms ease;
        }

        .cyber-button:hover::before {
          transform: translateX(110%);
        }

        .button-content {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .toggle-copy {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 24px;
          color: var(--text-secondary);
          font-size: 13px;
        }

        .text-button {
          position: relative;
          border: 0;
          background: none;
          color: var(--accent-primary);
          cursor: pointer;
          font-weight: 900;
          letter-spacing: 0.2px;
          padding: 0 0 3px;
          transition: color 180ms ease, text-shadow 180ms ease;
        }

        .text-button::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 1px;
          transform: scaleX(0);
          transform-origin: left;
          background: var(--accent-primary);
          box-shadow: 0 0 10px var(--accent-glow);
          transition: transform 180ms ease;
        }

        .text-button:hover {
          color: #ffbf63;
          text-shadow: 0 0 16px rgba(255, 149, 0, 0.45);
        }

        .text-button:hover::after {
          transform: scaleX(1);
        }

        .security-badge {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          width: fit-content;
          margin: 22px auto 0;
          padding: 10px 16px;
          border-radius: 999px;
          color: var(--success);
          background: rgba(0, 255, 136, 0.055);
          border: 1px solid rgba(0, 255, 136, 0.2);
          box-shadow: 0 0 26px rgba(0, 255, 136, 0.06);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .security-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--success);
          box-shadow: 0 0 14px var(--success-glow);
        }

        @keyframes scanline {
          from { transform: translateY(-20%); }
          to { transform: translateY(20%); }
        }

        @keyframes particleFloat {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) scale(0.7) rotate(0deg);
          }
          12% { opacity: 0.62; }
          88% { opacity: 0.45; }
          100% {
            opacity: 0;
            transform: translate3d(var(--drift, 0), -118vh, 0) scale(1.18) rotate(720deg);
          }
        }

        @keyframes bannerIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 960px) {
          .login-stage {
            grid-template-columns: 1fr;
            max-width: 480px;
          }

          .login-copy {
            display: none;
          }
        }

        @media (max-width: 520px) {
          .login-shell {
            align-items: flex-start;
            padding: 18px 12px;
          }

          .login-card {
            border-radius: 24px;
            padding: 24px 18px;
          }

          .brand-logo {
            font-size: 29px;
          }

          .brand-mark {
            min-width: 38px;
            height: 38px;
            border-radius: 11px;
          }

          .mode-pill {
            height: 40px;
          }

          .feature-row {
            grid-template-columns: 1fr;
          }

          .toggle-copy {
            flex-direction: column;
            gap: 5px;
          }
        }
      `}</style>

      <div className="login-shell">
        <div className="particles" id="particles" aria-hidden="true" />

        <main className="login-stage">
          <section className="login-copy" aria-hidden="true">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Secure Access Console
            </div>
            <h1 className="hero-title">
              Cyber glass
              <span className="hero-gradient">control layer.</span>
            </h1>
            <p className="hero-copy">
              A sharper authentication screen for EzCrosshairX with realtime approval,
              HWID protection, and a premium orange-on-dark visual system.
            </p>

            <div className="feature-row">
              <div className="feature-chip">
                <strong>Realtime</strong>
                <span>Auto-continues after admin approval.</span>
              </div>
              <div className="feature-chip">
                <strong>HWID Guard</strong>
                <span>Routes users based on approval status.</span>
              </div>
              <div className="feature-chip">
                <strong>Glass UI</strong>
                <span>Polished, responsive, and production-ready.</span>
              </div>
            </div>
          </section>

          <section className="login-card" aria-label={isRegister ? 'Create account form' : 'Login form'}>
            <div className="card-glow card-glow--one" />
            <div className="card-glow card-glow--two" />
            <span className="corner corner--tl" aria-hidden="true" />
            <span className="corner corner--br" aria-hidden="true" />

            <div className="brand-block">
              <div className="brand-logo">
                EzCrosshair<span className="brand-mark">X</span>
              </div>
              <p className="brand-subtitle">Cyber Gaming Tool</p>
            </div>

            <div className="mode-switch" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                role="tab"
                aria-selected={!isRegister}
                className={`mode-pill ${!isRegister ? 'is-active' : ''}`}
                onClick={() => {
                  setIsRegister(false)
                  setMessage('')
                }}
              >
                Login
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isRegister}
                className={`mode-pill ${isRegister ? 'is-active' : ''}`}
                onClick={() => {
                  setIsRegister(true)
                  setMessage('')
                }}
              >
                Register
              </button>
            </div>

            {message && (
              <div
                className={`status-banner ${isPositiveMessage ? 'status-accent' : 'status-danger'}`}
                aria-live="polite"
              >
                <span className="status-icon">{messageIcon}</span>
                <span>{message}</span>
              </div>
            )}

            {pendingUser && (
              <div className="pending-panel" aria-live="polite">
                <span className="status-icon">⏳</span>
                <span>
                  <strong>Waiting for admin approval</strong>
                  Keep this page open. Once your account is approved, it will continue automatically.
                </span>
              </div>
            )}

            {!isRegister ? (
              <form action={handleLogin} className="auth-form">
                <div className="input-group">
                  <label className="field-label" htmlFor="login-username">
                    <span>Username</span>
                    <span>Required</span>
                  </label>
                  <div className="input-shell">
                    <span className="field-icon" aria-hidden="true">◈</span>
                    <input
                      id="login-username"
                      className="cyber-input"
                      name="username"
                      type="text"
                      placeholder="Enter your username"
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="field-label" htmlFor="login-password">
                    <span>Password</span>
                    <span>Secure</span>
                  </label>
                  <div className="input-shell">
                    <span className="field-icon" aria-hidden="true">⌬</span>
                    <input
                      id="login-password"
                      className="cyber-input"
                      name="password"
                      type="password"
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <button type="submit" className="cyber-button">
                  <span className="button-content">
                    Initialize Login <span aria-hidden="true">→</span>
                  </span>
                </button>
              </form>
            ) : (
              <form action={handleRegister} className="auth-form">
                <div className="input-group">
                  <label className="field-label" htmlFor="register-username">
                    <span>Username</span>
                    <span>3–32 chars</span>
                  </label>
                  <div className="input-shell">
                    <span className="field-icon" aria-hidden="true">◈</span>
                    <input
                      id="register-username"
                      className="cyber-input"
                      name="username"
                      type="text"
                      placeholder="Choose a username"
                      required
                      minLength={3}
                      maxLength={32}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="field-label" htmlFor="register-password">
                    <span>Password</span>
                    <span>Min 6</span>
                  </label>
                  <div className="input-shell">
                    <span className="field-icon" aria-hidden="true">⌬</span>
                    <input
                      id="register-password"
                      className="cyber-input"
                      name="password"
                      type="password"
                      placeholder="Create a password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="field-label" htmlFor="register-password-confirm">
                    <span>Confirm Password</span>
                    <span>Match</span>
                  </label>
                  <div className="input-shell">
                    <span className="field-icon" aria-hidden="true">↻</span>
                    <input
                      id="register-password-confirm"
                      className="cyber-input"
                      name="passwordConfirm"
                      type="password"
                      placeholder="Repeat your password"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <button type="submit" className="cyber-button">
                  <span className="button-content">
                    Create Account <span aria-hidden="true">→</span>
                  </span>
                </button>
              </form>
            )}

            <div className="toggle-copy">
              <span>{isRegister ? 'Already have an account?' : "Don't have an account?"}</span>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setIsRegister(!isRegister)
                  setMessage('')
                }}
              >
                {isRegister ? 'Sign in instead' : 'Create one'}
              </button>
            </div>

            <div className="security-badge">
              <span className="security-dot" />
              Protected Auth Flow
            </div>
          </section>
        </main>
      </div>
    </>
  )
}
