'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveUserHwid } from './actions'

interface SessionUser {
  id?: number
  userId?: number
  user_id?: number
  username?: string
  role?: string
}

export default function HwidPage() {
  const [userId, setUserId] = useState<number | null>(null)
  const [username, setUsername] = useState('')
  const [hwid, setHwid] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pendingApproval, setPendingApproval] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const session = localStorage.getItem('ezcrosshair_user')
    if (!session) {
      window.location.href = '/login'
      return
    }

    let user: SessionUser | null = null
    try {
      user = JSON.parse(session)
    } catch {
      localStorage.removeItem('ezcrosshair_user')
      window.location.href = '/login'
      return
    }

    if (!user) {
      window.location.href = '/login'
      return
    }

    const rawId = user.id ?? user.userId ?? user.user_id
    const parsedId = typeof rawId === 'string' ? parseInt(rawId, 10) : rawId
    if (!parsedId || Number.isNaN(parsedId)) {
      window.location.href = '/login'
      return
    }

    setUserId(parsedId)
    setUsername(user.username || '')

    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('hwid, hwid_approved')
        .eq('id', parsedId)
        .single()

      if (error || !data) {
        window.location.href = '/login'
        return
      }

      const storedHwid = data.hwid?.trim() || ''
      if (data.hwid_approved === true) {
        window.location.href = '/dashboard'
        return
      }

      setHwid(storedHwid)
      setPendingApproval(Boolean(storedHwid))
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    const applyUserUpdate = (row: {
      hwid?: string | null
      hwid_approved?: boolean | null
      role?: string | null
      group_id?: string | null
    }) => {
      const storedHwid = row.hwid?.trim() || ''

      if (row.hwid_approved === true) {
        const session = localStorage.getItem('ezcrosshair_user')
        if (session) {
          try {
            const sessionUser = JSON.parse(session)
            localStorage.setItem(
              'ezcrosshair_user',
              JSON.stringify({
                ...sessionUser,
                hwid: storedHwid || sessionUser.hwid,
                hwid_approved: true,
                role: row.role ?? sessionUser.role,
                group_id: row.group_id ?? sessionUser.group_id,
              })
            )
          } catch {
            localStorage.removeItem('ezcrosshair_user')
          }
        }

        window.location.href = '/dashboard'
        return
      }

      if (!storedHwid) {
        setPendingApproval(false)
        setHwid('')
        setMessage('Your HWID was denied. Please submit a new one.')
        return
      }

      setHwid(storedHwid)
      setPendingApproval(true)
    }

    const logoutDeletedUser = () => {
      localStorage.removeItem('ezcrosshair_user')
      window.location.href = '/login'
    }

    const channel = supabase
      .channel(`hwid-user-guard-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          console.log('HWID UPDATE payload:', payload)

          const changedUser = payload.new as {
            hwid?: string | null
            hwid_approved?: boolean | null
            role?: string | null
            group_id?: string | null
          } | null

          if (!changedUser) return

          if (changedUser.role === 'pending') {
            logoutDeletedUser()
            return
          }

          applyUserUpdate(changedUser)
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
          console.log('HWID DELETE payload:', payload)

          const deletedUserId = Number((payload.old as { id?: number | string } | null)?.id)

          if (deletedUserId === userId) {
            logoutDeletedUser()
          }
        }
      )
      .subscribe((status) => {
        console.log('HWID user guard realtime status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])


  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!userId) return

    setSaving(true)
    setMessage('')

    const result = await saveUserHwid(userId, hwid)
    if (result.error) {
      setMessage(result.error)
      setSaving(false)
      return
    }

    setPendingApproval(true)
    setMessage('HWID saved. Waiting for admin approval.')
    setSaving(false)
  }

  function logout() {
    localStorage.removeItem('ezcrosshair_user')
    window.location.href = '/login'
  }

  if (loading) return <div style={{ color: '#fff', padding: 32 }}>Loading...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c15', padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '520px', background: 'rgba(20, 22, 35, 0.75)', border: '1px solid rgba(0, 255, 136, 0.18)', borderRadius: '16px', padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button
            onClick={logout}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              color: '#ff6b6b',
              border: '1px solid rgba(255, 107, 107, 0.4)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Log Out
          </button>
        </div>
        <h1 style={{ color: '#fff', fontSize: '28px', margin: 0 }}>HWID Setup</h1>
        <p style={{ color: '#5a6072', marginTop: '8px' }}>
          {pendingApproval
            ? 'Your HWID is waiting for admin approval.'
            : username
              ? `Welcome, ${username}.`
              : 'Paste your HWID below.'}
        </p>

        {pendingApproval ? (
          <div style={{
            marginTop: '24px',
            padding: '18px',
            borderRadius: '12px',
            background: 'rgba(20, 22, 35, 0.5)',
            border: '1px solid rgba(255, 149, 0, 0.2)',
          }}>
            <div style={{ color: '#ff9500', fontSize: '14px', fontWeight: 700 }}>
              Waiting for admin approval
            </div>
            <div style={{ color: '#8b92a8', fontSize: '13px', marginTop: '8px', lineHeight: 1.6 }}>
              Your HWID has been submitted.
              <br />
              The textbox stays hidden while it is under review.
              <br />
              This page will move you to the dashboard automatically once approved.
            </div>
            {message && (
              <p style={{
                color: message.includes('denied') ? '#ff4444' : '#ff9500',
                fontSize: '13px',
                marginTop: '12px',
              }}>
                {message}
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: '24px' }}>
            <label style={{ display: 'block', color: '#fff', fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>
              HWID
            </label>
            <input
              value={hwid}
              onChange={(e) => setHwid(e.target.value)}
              placeholder="Paste your HWID here"
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'rgba(10, 12, 21, 0.8)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {message && (
              <p style={{ color: message.includes('saved') ? '#00ff88' : '#ff4444', fontSize: '13px', marginTop: '12px' }}>
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: '20px',
                width: '100%',
                padding: '12px 18px',
                background: saving ? '#3a3d4e' : '#00ff88',
                color: '#0a0c15',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Submit HWID'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
