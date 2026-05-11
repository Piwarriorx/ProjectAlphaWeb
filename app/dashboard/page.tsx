'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { approveUser, rejectUser } from './actions'
import { uploadFile, listFiles, deleteFile, getSignedDownloadUrl } from './file-actions'
import { saveUserConfig, getUserConfig } from './config-actions'
import { updateUserGroup, updateUserRole, updateUserHwidApproval, bulkUpdateUserRole, bulkUpdateUserGroup, bulkDeleteUsers, updateGroupExpiration } from './group-actions'

interface User {
  id: number
  userId?: number | string
  user_id?: number | string
  username: string
  role: string
  created_at: string
  last_login_at?: string | null
  group_id?: string | null
  hwid?: string | null
  hwid_approved?: boolean | null
}

interface LaunchCredential {
  token: string
  version: string
}

interface GroupExpiration {
  id: number
  group_id: string
  servertime: string
  expiretime: string
}

interface FileRecord {
  id: number
  filename: string
  original_name: string
  size: number
  mime_type: string
  storage_path: string
  uploaded_by: string
  created_at: string
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

function formatRemainingTime(expiretime: string) {
  const diff = new Date(expiretime).getTime() - Date.now()
  if (Number.isNaN(diff)) return 'Invalid date'
  if (diff <= 0) return 'Expired'

  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`) // always show seconds

  return parts.join(' ')
}

function getUserId(user: User | null) {
  if (!user) return null

  const rawId = user.id ?? user.userId ?? user.user_id
  if (typeof rawId === 'string') {
    const parsed = parseInt(rawId, 10)
    return Number.isNaN(parsed) ? null : parsed
  }

  return typeof rawId === 'number' && rawId > 0 ? rawId : null
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState('')
  const [activeTab, setActiveTab] = useState<'users' | 'files' | 'config' | 'management' | 'group'>('files')
  const [launchData, setLaunchData] = useState<LaunchCredential | null>(null)
  const [groupExpirations, setGroupExpirations] = useState<GroupExpiration[]>([])
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [configText, setConfigText] = useState('')
  const [configMessage, setConfigMessage] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [managementMessage, setManagementMessage] = useState('')
  const [updatingGroup, setUpdatingGroup] = useState<number | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [bulkRole, setBulkRole] = useState('user')
  const [bulkGroupId, setBulkGroupId] = useState('not set')
  const [bulkProcessing, setBulkProcessing] = useState(false)

  // Expiration Editor State
  const [isExpModalOpen, setIsExpModalOpen] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState('')
  const [expDays, setExpDays] = useState('0')
  const [expHours, setExpHours] = useState('0')
  const [expMinutes, setExpMinutes] = useState('0')
  const [expSeconds, setExpSeconds] = useState('0')
  
  // Predefined groups
  const predefinedGroups = ['not set', '1', '2', '3', '4', '5']
  const supabase = createClient()

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString('en-PH', {
          timeZone: 'Asia/Manila',
          hour12: true,
        })
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const session = localStorage.getItem('ezcrosshair_user')
    if (!session) {
      window.location.href = '/login'
      return
    }

    const userData = JSON.parse(session)
    console.log('User data from localStorage:', userData)
    console.log('User ID type:', typeof userData?.id)
    console.log('User ID value:', userData?.id)
    
    setUser(userData)

    // Set default tab based on user role
    if (userData.role === 'user') {
      setActiveTab('files')
    } else if (userData.role === 'admin') {
      setActiveTab('files')
    }

    fetchUsers()
    fetchFiles()
    fetchGroupExpirations()
    
    // Try different possible ID field names like in handleSaveConfig
    let userId = userData.id || userData.user_id || userData.userId
    console.log('Extracted userId in useEffect:', userId, 'Type:', typeof userId)
    
    // Convert to number if it's a string
    if (typeof userId === 'string') {
      userId = parseInt(userId, 10)
    }
    
    if (userId && !isNaN(userId) && userId !== 0) {
      console.log('Calling fetchUserConfig with userId:', userId)
      fetchUserConfig(userId)
    } else {
      console.error('User data or ID is missing/invalid:', userData, 'Extracted ID:', userId)
    }

    fetchLaunchData()
  }, [])

  useEffect(() => {
    if (!user || loading) return

    const currentUserId = getUserId(user)
    if (!currentUserId) return

    const currentUserRow = users.find(u => u.id === currentUserId)
    if (currentUserRow === undefined) return

    // Redirect pending users back to login
  if (currentUserRow.role === 'pending' && window.location.pathname !== '/login') {
    window.location.href = '/login'
    return
  }

    if (currentUserRow.role !== 'admin' && currentUserRow.hwid_approved !== true && window.location.pathname !== '/hwid') {
      window.location.href = '/hwid'
    }

  }, [user, loading, users])

      useEffect(() => {
    if (user?.role !== 'admin') return

    const channel = supabase
      .channel('admin-hwid-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        (payload) => {
          const changedUser = payload.new as Partial<User> | null
          const oldUser = payload.old as Partial<User> | null

          fetchUsers()

          // Auto-refresh kapag nagbago ang role ng current user
          if (
            payload.eventType === 'UPDATE' &&
            changedUser?.role !== oldUser?.role
          ) {
            const currentUserId = getUserId(user)
            if (currentUserId && changedUser?.id === currentUserId) {
              const session = localStorage.getItem('ezcrosshair_user')
              if (session) {
                const userData = JSON.parse(session)
                userData.role = changedUser.role
                localStorage.setItem('ezcrosshair_user', JSON.stringify(userData))
              }
              window.location.reload()
            }
          }

          // Auto-refresh kapag nagbago ang group_id ng current user
          if (
            payload.eventType === 'UPDATE' &&
            changedUser?.group_id !== oldUser?.group_id
          ) {
            const currentUserId = getUserId(user)
            if (currentUserId && changedUser?.id === currentUserId) {
              const session = localStorage.getItem('ezcrosshair_user')
              if (session) {
                const userData = JSON.parse(session)
                userData.group_id = changedUser.group_id
                localStorage.setItem('ezcrosshair_user', JSON.stringify(userData))
              }
              window.location.reload()
            }
          }

          if (
            payload.eventType === 'UPDATE' &&
            changedUser?.hwid?.trim() &&
            changedUser.hwid_approved !== true
          ) {
            setManagementMessage('New HWID request received!')
            setTimeout(() => setManagementMessage(''), 3000)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

    // Realtime listener for group_expirations changes (for all users)
  useEffect(() => {
    const channel = supabase
      .channel('group-expirations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_expirations' },
        (payload) => {
          console.log('Group expiration changed:', payload)
          fetchGroupExpirations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Auto-refresh page when current user's role changes
    // Auto-refresh page when current user's role or group_id changes
  useEffect(() => {
    if (!user) return

    const currentUserId = getUserId(user)
    if (!currentUserId) return

    const channel = supabase
      .channel('user-role-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${currentUserId}`
        },
        (payload) => {
          const changedUser = payload.new as Partial<User>
          const oldUser = payload.old as Partial<User>

          // Auto-refresh kapag nagbago ang role
          if (changedUser.role !== oldUser.role) {
            const session = localStorage.getItem('ezcrosshair_user')
            if (session) {
              const userData = JSON.parse(session)
              userData.role = changedUser.role
              localStorage.setItem('ezcrosshair_user', JSON.stringify(userData))
            }
            window.location.reload()
          }

          // Auto-refresh kapag nagbago ang group_id
          if (changedUser.group_id !== oldUser.group_id) {
            const session = localStorage.getItem('ezcrosshair_user')
            if (session) {
              const userData = JSON.parse(session)
              userData.group_id = changedUser.group_id
              localStorage.setItem('ezcrosshair_user', JSON.stringify(userData))
            }
            window.location.reload()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  async function fetchUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, role, created_at, last_login_at, group_id, hwid, hwid_approved')
      .order('created_at', { ascending: false })

    setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => {
    setSelectedUserIds(prev => prev.filter(id => users.some(user => user.id === id)))
  }, [users])

  // Auto-refresh Group Expirations every 1 second
useEffect(() => {
  if (activeTab !== 'group') return;

  const interval = setInterval(() => {
    fetchGroupExpirations(); // fetch latest data from Supabase
  }, 1000); // every 1 second

  return () => clearInterval(interval); // cleanup on unmount or tab change
}, [activeTab]);

  async function fetchLaunchData() {
    const { data, error } = await supabase
      .from('user_launch_credentials')
      .select('token, version')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('Error fetching launch data:', error)
      }
      setLaunchData(null)
      return
    }

    setLaunchData(data)
  }

  async function fetchFiles() {
    const { files, error } = await listFiles()
    if (!error) setFiles(files)
  }

  async function fetchGroupExpirations() {
    const { data, error } = await supabase
      .from('group_expirations')
      .select('id, group_id, servertime, expiretime')
      .order('group_id', { ascending: true })

    if (error) {
      console.error('Error fetching group expirations:', error)
      setGroupExpirations([])
      return
    }

    setGroupExpirations((data || []) as GroupExpiration[])
  }

  async function fetchUserConfig(userId: number) {
    console.log('fetchUserConfig called with userId:', userId, 'Type:', typeof userId)
    
    if (!userId || userId === null || userId === undefined) {
      console.error('Invalid userId in fetchUserConfig:', userId)
      return
    }
    
    console.log('Fetching config for user ID:', userId)
    const { configText, error } = await getUserConfig(userId)
    console.log('getUserConfig result:', { configText, error })
    
    if (!error) {
      console.log('Setting configText state to:', configText)
      setConfigText(configText)
    } else {
      console.error('Error fetching user config:', error)
    }
  }

  async function handleApprove(id: number) {
    await approveUser(id)
    fetchUsers()
  }

  async function handleReject(id: number) {
    await rejectUser(id)
    fetchUsers()
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setUploading(true)
    setUploadMessage('')
    if (user) formData.set('uploadedBy', user.username)

    const result = await uploadFile(formData)
    if (result.error) {
      setUploadMessage(result.error)
    } else {
      setUploadMessage('File uploaded successfully!')
      fetchFiles()
    }
    setUploading(false)
    ;(document.getElementById('fileInput') as HTMLInputElement).value = ''
  }

  async function handleDelete(file: FileRecord) {
    if (!confirm(`Delete "${file.original_name}"?`)) return
    const result = await deleteFile(file.id, file.storage_path)
    if (result.error) {
      alert(result.error)
    } else {
      fetchFiles()
    }
  }

  async function handleDownload(file: FileRecord) {
    const result = await getSignedDownloadUrl(file.storage_path)
    if (result.error || !result.url) {
      alert(result.error || 'Failed to generate download link')
      return
    }
    const a = document.createElement('a')
    a.href = result.url
    a.download = file.original_name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function handleSaveConfig() {
    console.log('handleSaveConfig called, user object:', user)
    
    // Get user data directly from localStorage to bypass any state issues
    const session = localStorage.getItem('ezcrosshair_user')
    if (!session) {
      setConfigMessage('No session found. Please log in again.')
      return
    }

    let userData
    try {
      userData = JSON.parse(session)
      console.log('Raw user data from localStorage:', userData)
    } catch (e) {
      console.error('Failed to parse user data:', e)
      setConfigMessage('Invalid session data. Please log in again.')
      return
    }
    
    // Try different possible ID field names
    let userId = userData.id || userData.user_id || userData.userId
    console.log('Extracted userId:', userId, 'Type:', typeof userId)
    
    // Convert to number if it's a string
    if (typeof userId === 'string') {
      userId = parseInt(userId, 10)
    }
    
    if (!userId || isNaN(userId) || userId === 0) {
      console.error('Invalid userId after extraction:', userId)
      setConfigMessage(`Invalid user ID: ${userId}. Please log in again.`)
      return
    }
    
    setSavingConfig(true)
    setConfigMessage('')
    console.log('Attempting to save config with userId:', userId)
    
    const result = await saveUserConfig(userId, configText)
    if (result.error) {
      setConfigMessage(result.error)
    } else {
      setConfigMessage('Configuration saved successfully!')
    }
    setSavingConfig(false)
  }

  async function handleUpdateGroup(userId: number, newGroupId: string) {
    setUpdatingGroup(userId)
    setManagementMessage('')
    
    const result = await updateUserGroup(userId, newGroupId === 'not set' ? null : newGroupId)
    if (result.error) {
      setManagementMessage(result.error)
    } else {
      setManagementMessage('User group updated successfully!')
      fetchUsers()
    }
    
    setUpdatingGroup(null)
    
    // Clear message after 3 seconds
    setTimeout(() => setManagementMessage(''), 3000)
  }

  async function handleUpdateRole(userId: number, newRole: string) {
    setUpdatingGroup(userId)
    setManagementMessage('')
    
    const result = await updateUserRole(userId, newRole)
    if (result.error) {
      setManagementMessage(result.error)
    } else {
      setManagementMessage('User role updated successfully!')
      fetchUsers()
    }
    
    setUpdatingGroup(null)
    
    // Clear message after 3 seconds
    setTimeout(() => setManagementMessage(''), 3000)
  }

  async function handleUpdateHwidApproval(userId: number, approved: boolean) {
    setUpdatingGroup(userId)
    setManagementMessage('')

    const result = await updateUserHwidApproval(userId, approved)
    if (result.error) {
      setManagementMessage(result.error)
    } else {
      setManagementMessage(approved ? 'HWID approved successfully!' : 'HWID denied and cleared successfully!')
      fetchUsers()
    }

    setUpdatingGroup(null)

    setTimeout(() => setManagementMessage(''), 3000)
  }

  function toggleSelectedUser(userId: number) {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  function selectAllManagementUsers() {
    const manageableUsers = users.filter(u => u.role !== 'pending').map(u => u.id)
    setSelectedUserIds(manageableUsers)
  }

  function clearSelectedUsers() {
    setSelectedUserIds([])
  }

  async function handleBulkRoleUpdate() {
    if (selectedUserIds.length === 0) return
    setBulkProcessing(true)
    setManagementMessage('')

    const result = await bulkUpdateUserRole(selectedUserIds, bulkRole)
    if (result.error) {
      setManagementMessage(result.error)
    } else {
      setManagementMessage(`Updated role for ${selectedUserIds.length} user(s) successfully!`)
      clearSelectedUsers()
      await fetchUsers()
    }

    setBulkProcessing(false)
    setTimeout(() => setManagementMessage(''), 3000)
  }

  async function handleBulkGroupUpdate() {
    if (selectedUserIds.length === 0) return
    setBulkProcessing(true)
    setManagementMessage('')

    const result = await bulkUpdateUserGroup(selectedUserIds, bulkGroupId === 'not set' ? null : bulkGroupId)
    if (result.error) {
      setManagementMessage(result.error)
    } else {
      setManagementMessage(`Updated group for ${selectedUserIds.length} user(s) successfully!`)
      clearSelectedUsers()
      await fetchUsers()
    }

    setBulkProcessing(false)
    setTimeout(() => setManagementMessage(''), 3000)
  }

  async function handleBulkDelete() {
    if (selectedUserIds.length === 0) return
    if (!confirm(`Delete ${selectedUserIds.length} selected user(s)?`)) return

    setBulkProcessing(true)
    setManagementMessage('')

    const result = await bulkDeleteUsers(selectedUserIds)
    if (result.error) {
      setManagementMessage(result.error)
    } else {
      setManagementMessage(`Deleted ${selectedUserIds.length} user(s) successfully!`)
      clearSelectedUsers()
      await fetchUsers()
    }

    setBulkProcessing(false)
    setTimeout(() => setManagementMessage(''), 3000)
  }

  async function handleSaveExpiration() {
    if (!editingGroupId) return
    setBulkProcessing(true)
    setManagementMessage('')

    try {
      const d = parseInt(expDays) || 0
      const h = parseInt(expHours) || 0
      const m = parseInt(expMinutes) || 0
      const s = parseInt(expSeconds) || 0
      const totalSeconds = (d * 86400) + (h * 3600) + (m * 60) + s

      if (totalSeconds <= 0) {
        setManagementMessage('Please set an expiration time greater than 0')
        setBulkProcessing(false)
        return
      }

      const now = new Date()
      const expireDate = new Date(now.getTime() + totalSeconds * 1000)

      console.log('Attempting to save expiration for group:', editingGroupId, 'Expire Time:', expireDate.toISOString());
      const result = await updateGroupExpiration(
        editingGroupId,
        expireDate.toISOString()
      )
      console.log('Result from updateGroupExpiration server action:', result);

      if (result.error) {
        setManagementMessage(result.error)
      } else {
        setManagementMessage(`Successfully updated expiration for Group ${editingGroupId}`)
        await fetchGroupExpirations()
        setIsExpModalOpen(false)
        // Reset form inputs
        setExpDays('0')
        setExpHours('0')
        setExpMinutes('0')
        setExpSeconds('0')
      }
    } catch (err: any) {
      console.error('Error in handleSaveExpiration:', err)
      setManagementMessage(err?.message || 'Failed to save expiration')
    } finally {
      setBulkProcessing(false)
      setTimeout(() => setManagementMessage(''), 3000)
    }
  }

  function logout() {
    localStorage.removeItem('ezcrosshair_user')
    window.location.href = '/login'
  }

    const currentUserId = getUserId(user)
  const currentUserRow = currentUserId ? users.find(u => u.id === currentUserId) : null
  const currentHwid = currentUserRow?.hwid?.trim() || ''
  const hasApprovedHwid = currentUserRow?.role === 'admin' || currentUserRow?.hwid_approved === true

  // Get user's group and check expiration
  const userGroupId = currentUserRow?.group_id || user?.group_id || null
  const userGroupExpiration = userGroupId
    ? groupExpirations.find(ge => ge.group_id === String(userGroupId))
    : null
  const isGroupExpired = userGroupExpiration
    ? new Date(userGroupExpiration.expiretime).getTime() <= Date.now()
    : false

  const launchUrl =
    launchData && currentHwid
      ? `ezcrosshairalpha://launch?token=${encodeURIComponent(launchData.token)}&hw=${encodeURIComponent(currentHwid)}&ver=${encodeURIComponent(launchData.version)}`
      : ''

  // Disable launch if group is expired
  const isPending = user?.role === 'pending'
const canLaunch = Boolean(launchUrl) && hasApprovedHwid && !isGroupExpired && !isPending

let launchLabel: string
if (isPending) {
  launchLabel = 'Pending approval'
} else if (!launchUrl) {
  launchLabel = 'Launch unavailable'
} else if (isGroupExpired) {
  launchLabel = 'Launch unavailable'
} else if (!hasApprovedHwid) {
  launchLabel = 'Launch unavailable'
} else {
  launchLabel = 'Launch'
}
  const manageableUsers = users
    .filter(u => u.role !== 'pending')
    .sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1
      if (a.role !== 'admin' && b.role === 'admin') return 1
      return 0
    })
  const sortedGroupExpirations = [...groupExpirations].sort((a, b) => a.group_id.localeCompare(b.group_id))

  if (!user) return null
  if (loading) return <div style={{ color: '#fff', padding: 32 }}>Loading...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c15', padding: '32px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
          alignItems: 'center',
          gap: '24px',
          marginBottom: '32px',
          paddingBottom: '24px',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ minWidth: 0 }}>
                        <h1 
              onClick={() => window.location.reload()}
              style={{ 
                color: '#fff', 
                fontSize: '32px', 
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'opacity 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              //title="Click to refresh"
            >
              ProjectAlpha
            </h1>
            <p style={{ color: '#ff9500', fontSize: '18px', marginTop: '8px' }}>
              Welcome, {user.role.charAt(0).toUpperCase() + user.role.slice(1)} {user.username}!
            </p>
            <div style={{ color: '#fff', fontSize: '20px', fontFamily: 'monospace', fontWeight: 600, letterSpacing: '2px', marginTop: '6px' }}>
  Server Time: {time} <span style={{ fontSize: '11px', color: '#5a6072', fontWeight: 400, letterSpacing: '1px' }}>PHT</span>
</div>

{/* Users in the same group */}
            <div style={{
              marginTop: '12px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignItems: 'center',
              maxWidth: '520px',
            }}>
              {(() => {
                const userId = getUserId(user)
                const dbUser = users.find(u => u.id === userId)
                const myGroupRaw = dbUser?.group_id ?? user.group_id ?? 'not set'
                const myGroup = String(myGroupRaw)
                const sameGroup = users
                  .filter(u => String(u.group_id || 'not set') === myGroup)
                  .filter(u => u.role !== 'pending')
                  .sort((a, b) => a.username.localeCompare(b.username))

                if (sameGroup.length === 0) {
                  return <span style={{ color: '#5a6072', fontSize: '12px' }}>No users in your group</span>
                }

                return sameGroup.map(u => (
                  <span key={u.id} style={{
                    padding: '6px 10px',
                    borderRadius: '999px',
                    background: 'rgba(10, 12, 21, 0.65)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: u.role === 'admin' ? '#ff9500' : '#00ff88',
                      display: 'inline-block',
                    }} />
                    {u.username}
                  </span>
                ))
              })()}
            </div>
          </div>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
                            onClick={() => {
                if (!canLaunch) {
                  alert(`Launch blocked!\n\ncanLaunch: ${canLaunch}\nlaunchUrl: ${launchUrl || 'empty'}\nhasApprovedHwid: ${hasApprovedHwid}\nisGroupExpired: ${isGroupExpired}\nuserGroupId: ${userGroupId || 'none'}\nuserGroupExpiration: ${userGroupExpiration ? userGroupExpiration.expiretime : 'none'}`)
                  return
                }
                alert(`Launching!\n\nURL: ${launchUrl}`)
                window.location.href = launchUrl
              }}
              disabled={!canLaunch}
              style={{
                minWidth: '200px',
                padding: '12px 24px',
                background: canLaunch ? 'rgba(0, 255, 136, 0.12)' : 'rgba(58, 61, 78, 0.5)',
                color: canLaunch ? '#00ff88' : '#5a6072',
                border: `1.5px solid ${canLaunch ? 'rgba(0, 255, 136, 0.35)' : 'rgba(90, 96, 114, 0.35)'}`,
                borderRadius: '10px',
                cursor: canLaunch ? 'pointer' : 'not-allowed',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                transition: 'all 0.25s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
              onMouseEnter={(e) => {
                if (!canLaunch) return
                e.currentTarget.style.background = 'rgba(0, 255, 136, 0.18)'
                e.currentTarget.style.borderColor = 'rgba(0, 255, 136, 0.55)'
              }}
              onMouseLeave={(e) => {
                if (!canLaunch) return
                e.currentTarget.style.background = 'rgba(0, 255, 136, 0.12)'
                e.currentTarget.style.borderColor = 'rgba(0, 255, 136, 0.35)'
              }}
            >
              <span>{launchLabel}</span>
              {userGroupId && userGroupId !== 'not set' && userGroupExpiration && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  letterSpacing: '0.5px',
                  color: isGroupExpired ? '#ff4444' : '#00ff88',
                  opacity: 0.85,
                }}>
                  {isGroupExpired ? 'EXPIRED' : formatRemainingTime(userGroupExpiration.expiretime)}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={logout}
            style={{
              justifySelf: 'end',
              padding: '10px 22px',
              background: 'transparent',
              color: '#ff6b6b',
              border: '1.5px solid rgba(255, 107, 107, 0.4)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.5px',
              transition: 'all 0.25s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 107, 107, 0.1)'
              e.currentTarget.style.borderColor = 'rgba(255, 107, 107, 0.7)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'rgba(255, 107, 107, 0.4)'
            }}
          >
            <span style={{ fontSize: '14px' }}>→</span> Log Out
          </button>
        </div>


        {/* Admin Tabs */}
        {user.role === 'admin' && (
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '32px',
            padding: '4px',
            background: 'rgba(20, 22, 35, 0.5)',
            borderRadius: '12px',
            width: 'fit-content',
          }}>
            <button
              onClick={() => setActiveTab('files')}
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                background: activeTab === 'files' ? 'rgba(255, 149, 0, 0.15)' : 'transparent',
                color: activeTab === 'files' ? '#ff9500' : '#5a6072',
              }}
            >
              Files
            </button>
            <button
              onClick={() => setActiveTab('config')}
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                background: activeTab === 'config' ? 'rgba(255, 149, 0, 0.15)' : 'transparent',
                color: activeTab === 'config' ? '#ff9500' : '#5a6072',
              }}
            >
              Config
            </button>
            <button
              onClick={() => setActiveTab('users')}
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                background: activeTab === 'users' ? 'rgba(255, 149, 0, 0.15)' : 'transparent',
                color: activeTab === 'users' ? '#ff9500' : '#5a6072',
              }}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('management')}
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                background: activeTab === 'management' ? 'rgba(255, 149, 0, 0.15)' : 'transparent',
                color: activeTab === 'management' ? '#ff9500' : '#5a6072',
              }}
            >
              Management
            </button>
            <button
              onClick={() => setActiveTab('group')}
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                background: activeTab === 'group' ? 'rgba(255, 149, 0, 0.15)' : 'transparent',
                color: activeTab === 'group' ? '#ff9500' : '#5a6072',
              }}
            >
              Group
            </button>
          </div>
        )}

        {/* Admin - Users Tab */}
        {user.role === 'admin' && activeTab === 'users' && (
          <div>
            {/* Pending Users */}
            <div style={{ marginBottom: '48px' }}>
              <h2 style={{
                color: '#ff9500',
                fontSize: '22px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                Pending Approval
                <span style={{
                  padding: '4px 12px',
                  background: 'rgba(255, 149, 0, 0.2)',
                  borderRadius: '20px',
                  fontSize: '14px',
                }}>
                  {users.filter(u => u.role === 'pending').length}
                </span>
              </h2>

              {users.filter(u => u.role === 'pending').length === 0 && (
                <div style={{
                  background: 'rgba(20, 22, 35, 0.5)',
                  border: '1px dashed rgba(255, 149, 0, 0.3)',
                  borderRadius: '12px',
                  padding: '40px',
                  textAlign: 'center',
                  color: '#5a6072',
                }}>
                  No pending registrations
                </div>
              )}

              {users.filter(u => u.role === 'pending').map(pendingUser => (
                <div key={pendingUser.id} style={{
                  background: 'rgba(20, 22, 35, 0.7)',
                  border: '1px solid rgba(255, 149, 0, 0.3)',
                  borderRadius: '12px',
                  padding: '24px',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{
                      color: '#fff',
                      fontSize: '20px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      {pendingUser.username}
                      <span style={{
                        padding: '4px 10px',
                        background: 'rgba(255, 149, 0, 0.15)',
                        color: '#ff9500',
                        borderRadius: '6px',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                      }}>
                        Pending
                      </span>
                    </div>
                    <div style={{ color: '#8b92a8', fontSize: '13px', marginTop: '6px' }}>
                      Registered: {new Date(pendingUser.created_at).toLocaleString()}
                      <br />
                      Last login: {pendingUser.last_login_at ? new Date(pendingUser.last_login_at).toLocaleString() : '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={() => handleApprove(pendingUser.id)}
                      style={{
                        padding: '12px 24px',
                        background: '#00ff88',
                        color: '#0a0c15',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '14px',
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 255, 136, 0.3)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(pendingUser.id)}
                      style={{
                        padding: '12px 24px',
                        background: 'transparent',
                        color: '#ff4444',
                        border: '1px solid #ff4444',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '14px',
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 68, 68, 0.1)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* All Users */}
            <div>
              <h2 style={{
                color: '#00ff88',
                fontSize: '22px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                All Users
                <span style={{
                  padding: '4px 12px',
                  background: 'rgba(0, 255, 136, 0.2)',
                  borderRadius: '20px',
                  fontSize: '14px',
                }}>
                  {users.filter(u => u.role !== 'pending').length}
                </span>
              </h2>

              <div style={{
                background: 'rgba(20, 22, 35, 0.5)',
                borderRadius: '12px',
                overflow: 'hidden',
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 200px 240px',
                  padding: '16px 24px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  color: '#8b92a8',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600,
                }}>
                  <div>Username</div>
                  <div>Role</div>
                  <div>Registered</div>
                  <div>Last login</div>
                </div>

                {users.filter(u => u.role !== 'pending').map(u => (
                  <div key={u.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 200px 240px',
                    padding: '16px 24px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    alignItems: 'center',
                  }}>
                    <div style={{ color: '#fff', fontWeight: 600 }}>
                      {u.username}
                    </div>
                    <div>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        background: u.role === 'admin'
                          ? 'rgba(255, 149, 0, 0.15)'
                          : 'rgba(0, 255, 136, 0.1)',
                        color: u.role === 'admin' ? '#ff9500' : '#00ff88',
                      }}>
                        {u.role}
                      </span>
                    </div>
                    <div style={{ color: '#5a6072', fontSize: '13px' }}>
                      {new Date(u.created_at).toLocaleString()}
                    </div>
                    <div style={{ color: '#5a6072', fontSize: '13px' }}>
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Admin - Files Tab */}
        {user.role === 'admin' && activeTab === 'files' && (
          <div>
            {/* Upload Area */}
            <div style={{
              background: 'rgba(20, 22, 35, 0.7)',
              border: '1px dashed rgba(0, 255, 136, 0.3)',
              borderRadius: '12px',
              padding: '32px',
              marginBottom: '48px',
              textAlign: 'center',
            }}>
              <h2 style={{ color: '#00ff88', fontSize: '20px', marginBottom: '16px' }}>
                Upload File
              </h2>
              <form onSubmit={handleUpload}>
                <input
                  id="fileInput"
                  type="file"
                  name="file"
                  required
                  style={{
                    color: '#fff',
                    fontSize: '14px',
                    marginBottom: '16px',
                  }}
                />
                <br />
                <button
                  type="submit"
                  disabled={uploading}
                  style={{
                    padding: '12px 28px',
                    background: uploading ? '#3a3d4e' : '#00ff88',
                    color: '#0a0c15',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: '14px',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </form>
              {uploadMessage && (
                <p style={{
                  marginTop: '12px',
                  color: uploadMessage.includes('success') ? '#00ff88' : '#ff4444',
                  fontSize: '14px',
                }}>
                  {uploadMessage}
                </p>
              )}
            </div>

            {/* File List */}
            <h2 style={{
              color: '#ff9500',
              fontSize: '22px',
              marginBottom: '20px',
            }}>
              Available Files
            </h2>

            {files.length === 0 && (
              <div style={{
                background: 'rgba(20, 22, 35, 0.5)',
                border: '1px dashed rgba(255, 149, 0, 0.3)',
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center',
                color: '#5a6072',
              }}>
                No files uploaded yet
              </div>
            )}

            <div style={{
              background: 'rgba(20, 22, 35, 0.5)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 120px 160px',
                padding: '16px 24px',
                background: 'rgba(0, 0, 0, 0.3)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                color: '#8b92a8',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: 600,
              }}>
                <div>Name</div>
                <div>Size</div>
                <div>Uploaded</div>
                <div>Actions</div>
              </div>

              {files.map(file => (
                <div key={file.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 120px 160px',
                  padding: '16px 24px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  alignItems: 'center',
                }}>
                  <div style={{ color: '#fff', fontWeight: 600 }}>
                    {file.original_name}
                  </div>
                  <div style={{ color: '#8b92a8', fontSize: '13px' }}>
                    {formatBytes(file.size)}
                  </div>
                  <div>
                    <div style={{ color: '#5a6072', fontSize: '13px' }}>
                      {new Date(file.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}
                    </div>
                    <div style={{ color: '#5a6072', fontSize: '13px' }}>
                      {new Date(file.created_at).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour12: true })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleDownload(file)}
                      style={{
                        padding: '6px 14px',
                        background: 'rgba(0, 255, 136, 0.1)',
                        color: '#00ff88',
                        border: '1px solid rgba(0, 255, 136, 0.3)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      Download
                    </button>
                    <button
                      onClick={() => handleDelete(file)}
                      style={{
                        padding: '6px 14px',
                        background: 'transparent',
                        color: '#ff4444',
                        border: '1px solid #ff4444',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin - Config Tab */}
        {user.role === 'admin' && activeTab === 'config' && (
          <div>
            <div style={{
              background: 'rgba(20, 22, 35, 0.7)',
              border: '1px solid rgba(0, 255, 136, 0.2)',
              borderRadius: '16px',
              padding: '32px',
            }}>
              <h2 style={{ color: '#00ff88', fontSize: '24px', marginBottom: '24px' }}>
                Configuration Settings
              </h2>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '12px',
                }}>
                  Configuration Text
                </label>
                <textarea
                  value={configText}
                  onChange={(e) => setConfigText(e.target.value)}
                  placeholder="Enter your import key here..."
                  style={{
                    width: '100%',
                    height: '300px',
                    background: 'rgba(10, 12, 21, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '16px',
                    color: '#fff',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0, 255, 136, 0.5)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  }}
                />
              </div>
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '24px',
              }}>
                <div>
                  {configMessage && (
                    <p style={{
                      color: configMessage.includes('success') ? '#00ff88' : '#ff4444',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}>
                      {configMessage}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  style={{
                    padding: '12px 28px',
                    background: savingConfig ? '#3a3d4e' : '#00ff88',
                    color: '#0a0c15',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: savingConfig ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: '14px',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {savingConfig ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Admin - Management Tab */}
        {user.role === 'admin' && activeTab === 'management' && (
          <div>
            <div style={{
              background: 'rgba(20, 22, 35, 0.7)',
              border: '1px solid rgba(255, 149, 0, 0.2)',
              borderRadius: '16px',
              padding: '32px',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
              }}>
                <h2 style={{ color: '#ff9500', fontSize: '24px', margin: 0 }}>
                  User Group Management
                </h2>
                {managementMessage && (
                  <div style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    background: managementMessage.includes('success') ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 68, 68, 0.1)',
                    color: managementMessage.includes('success') ? '#00ff88' : '#ff4444',
                    border: `1px solid ${managementMessage.includes('success') ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 68, 68, 0.3)'}`,
                  }}>
                    {managementMessage}
                  </div>
                )}
              </div>

              <div style={{
                marginBottom: '18px',
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(20, 22, 35, 0.5)',
                border: '1px solid rgba(255, 149, 0, 0.15)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ color: '#8b92a8', fontSize: '13px' }}>
                  {selectedUserIds.length} selected
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={selectAllManagementUsers}
                    disabled={bulkProcessing || manageableUsers.length === 0}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(255, 149, 0, 0.12)',
                      color: '#ff9500',
                      border: '1px solid rgba(255, 149, 0, 0.25)',
                      borderRadius: '8px',
                      cursor: bulkProcessing || manageableUsers.length === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={clearSelectedUsers}
                    disabled={bulkProcessing || selectedUserIds.length === 0}
                    style={{
                      padding: '8px 12px',
                      background: 'transparent',
                      color: '#5a6072',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '8px',
                      cursor: bulkProcessing || selectedUserIds.length === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    Clear
                  </button>
                  <select
                    value={bulkRole}
                    onChange={(e) => setBulkRole(e.target.value)}
                    disabled={bulkProcessing}
                    style={{
                      padding: '8px 10px',
                      background: 'rgba(10, 12, 21, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: bulkProcessing ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="pending">pending</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleBulkRoleUpdate}
                    disabled={bulkProcessing || selectedUserIds.length === 0}
                    style={{
                      padding: '8px 12px',
                      background: '#00ff88',
                      color: '#0a0c15',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: bulkProcessing || selectedUserIds.length === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    Apply Role
                  </button>
                  <select
                    value={bulkGroupId}
                    onChange={(e) => setBulkGroupId(e.target.value)}
                    disabled={bulkProcessing}
                    style={{
                      padding: '8px 10px',
                      background: 'rgba(10, 12, 21, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: bulkProcessing ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {predefinedGroups.map(group => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleBulkGroupUpdate}
                    disabled={bulkProcessing || selectedUserIds.length === 0}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(0, 255, 136, 0.12)',
                      color: '#00ff88',
                      border: '1px solid rgba(0, 255, 136, 0.3)',
                      borderRadius: '8px',
                      cursor: bulkProcessing || selectedUserIds.length === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    Apply Group
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={bulkProcessing || selectedUserIds.length === 0}
                    style={{
                      padding: '8px 12px',
                      background: 'transparent',
                      color: '#ff4444',
                      border: '1px solid rgba(255, 68, 68, 0.4)',
                      borderRadius: '8px',
                      cursor: bulkProcessing || selectedUserIds.length === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    Delete Selected
                  </button>
                </div>
              </div>

              <div style={{
                background: 'rgba(20, 22, 35, 0.5)',
                borderRadius: '12px',
                overflow: 'hidden',
                marginBottom: '24px'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr 120px minmax(180px, 240px) 150px',
                  padding: '16px 24px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  color: '#8b92a8',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600,
                }}>
                  <div>Select</div>
                  <div>Username</div>
                  <div>Role</div>
                  <div>HWID</div>
                  <div>Group ID</div>
                </div>

                {manageableUsers.map(u => (
                  <div key={u.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '48px 1fr 120px minmax(180px, 240px) 150px',
                    padding: '16px 24px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    alignItems: 'center',
                  }}>
                    <div>
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.id)}
                        onChange={() => toggleSelectedUser(u.id)}
                        disabled={bulkProcessing}
                        style={{ width: '16px', height: '16px', cursor: bulkProcessing ? 'not-allowed' : 'pointer' }}
                      />
                    </div>
                    <div style={{ color: '#fff', fontWeight: 600 }}>
                      {u.username}
                    </div>
                    <div>
                      {u.role === 'admin' ? (
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          background: 'rgba(255, 149, 0, 0.15)',
                          color: '#ff9500',
                        }}>
                          {u.role}
                        </span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                          disabled={updatingGroup === u.id}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(10, 12, 21, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '11px',
                            cursor: updatingGroup === u.id ? 'not-allowed' : 'pointer',
                            opacity: updatingGroup === u.id ? 0.6 : 1,
                            textTransform: 'uppercase',
                            fontWeight: 600,
                          }}
                        >
                          <option value="user">user</option>

                          <option value="pending">pending</option>
                        </select>
                      )}
                    </div>
                    <div>
                      <div
                        title={u.hwid || 'not set'}
                        style={{
                          color: u.hwid ? '#fff' : '#5a6072',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {u.hwid || 'not set'}
                      </div>
                    </div>
                    <div>
                      <select
                        value={u.group_id || 'not set'}
                        onChange={(e) => handleUpdateGroup(u.id, e.target.value)}
                        disabled={updatingGroup === u.id}
                        style={{
                          padding: '6px 10px',
                          background: 'rgba(10, 12, 21, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '12px',
                          cursor: updatingGroup === u.id ? 'not-allowed' : 'pointer',
                          opacity: updatingGroup === u.id ? 0.6 : 1,
                        }}
                      >
                        {predefinedGroups.map(group => (
                          <option key={group} value={group}>{group}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          <div style={{
            background: 'rgba(20, 22, 35, 0.7)',
            border: '1px solid rgba(0, 255, 136, 0.2)',
            borderRadius: '16px',
            padding: '32px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <div>
                <h2 style={{ color: '#00ff88', fontSize: '24px', margin: 0 }}>
                  HWID Approval
                </h2>
                <p style={{ color: '#5a6072', fontSize: '13px', margin: '6px 0 0' }}>
                  Approve device IDs before launch is allowed.
                </p>
              </div>
            </div>

            <div style={{
              background: 'rgba(20, 22, 35, 0.5)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr minmax(220px, 1.6fr) 140px 140px',
                padding: '16px 24px',
                background: 'rgba(0, 0, 0, 0.3)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                color: '#8b92a8',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: 600,
              }}>
                <div>Username</div>
                <div>HWID</div>
                <div>Status</div>
                <div>Action</div>
              </div>

              {users
                .filter(u => u.role !== 'pending')
                .sort((a, b) => {
                  const aMissing = !a.hwid?.trim()
                  const bMissing = !b.hwid?.trim()
                  if (aMissing !== bMissing) return aMissing ? -1 : 1
                  const aApproved = a.hwid_approved === true
                  const bApproved = b.hwid_approved === true
                  if (aApproved !== bApproved) return aApproved ? 1 : -1
                  return a.username.localeCompare(b.username)
                })
                .map(u => {
                  const hasHwid = Boolean(u.hwid?.trim())
                  const isApproved = u.hwid_approved === true

                  return (
                    <div key={u.id} style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr minmax(220px, 1.6fr) 140px 140px',
                      padding: '16px 24px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      alignItems: 'center',
                    }}>
                      <div style={{ color: '#fff', fontWeight: 600 }}>
                        {u.username}
                      </div>
                      <div>
                        <div
                          title={u.hwid || 'not set'}
                          style={{
                            color: hasHwid ? '#fff' : '#5a6072',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {u.hwid || 'not set'}
                        </div>
                      </div>
                      <div>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          background: !hasHwid
                            ? 'rgba(90, 96, 114, 0.15)'
                            : isApproved
                              ? 'rgba(0, 255, 136, 0.12)'
                              : 'rgba(255, 149, 0, 0.12)',
                          color: !hasHwid
                            ? '#5a6072'
                            : isApproved
                              ? '#00ff88'
                              : '#ff9500',
                        }}>
                          {!hasHwid ? 'No HWID' : isApproved ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                      <div>
                        <button
                          onClick={() => handleUpdateHwidApproval(u.id, !isApproved)}
                          disabled={!hasHwid || updatingGroup === u.id}
                          style={{
                            padding: '6px 14px',
                            background: !hasHwid
                              ? 'rgba(58, 61, 78, 0.5)'
                              : isApproved
                                ? 'transparent'
                                : 'rgba(0, 255, 136, 0.12)',
                            color: !hasHwid
                              ? '#5a6072'
                              : isApproved
                                ? '#ff6b6b'
                                : '#00ff88',
                            border: `1px solid ${!hasHwid
                              ? 'rgba(90, 96, 114, 0.35)'
                              : isApproved
                                ? 'rgba(255, 107, 107, 0.4)'
                                : 'rgba(0, 255, 136, 0.35)'}`,
                            borderRadius: '8px',
                            cursor: !hasHwid || updatingGroup === u.id ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: 700,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {!hasHwid ? 'Unavailable' : isApproved ? 'Revoke' : 'Approve'}
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
        )}

        {/* Admin - Group Tab */}
        {user.role === 'admin' && activeTab === 'group' && (
          <div>
            <div style={{
              background: 'rgba(20, 22, 35, 0.7)',
              border: '1px solid rgba(255, 149, 0, 0.2)',
              borderRadius: '16px',
              padding: '32px',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
              }}>
                <div>
                  <h2 style={{ color: '#ff9500', fontSize: '24px', margin: 0 }}>
                    Group Expirations
                  </h2>
                  <p style={{ color: '#5a6072', fontSize: '13px', margin: '6px 0 0' }}>
                    View each group's server time, expiration time, and remaining time.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {managementMessage && (
                    <div style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      background: managementMessage.includes('success') ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 68, 68, 0.1)',
                      color: managementMessage.includes('success') ? '#00ff88' : '#ff4444',
                      border: `1px solid ${managementMessage.includes('success') ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 68, 68, 0.3)'}`,
                    }}>
                      {managementMessage}
                    </div>
                  )}
                  <div style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    background: 'rgba(0, 255, 136, 0.1)',
                    color: '#00ff88',
                    border: '1px solid rgba(0, 255, 136, 0.3)',
                  }}>
                    {sortedGroupExpirations.length} group(s)
                  </div>
                </div>
              </div>

              <div style={{
                background: 'rgba(20, 22, 35, 0.5)',
                borderRadius: '12px',
                overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1.2fr 1.2fr 1fr 1.5fr 100px',
                  padding: '16px 24px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  color: '#8b92a8',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600,
                }}>
                  <div>Group ID</div>
                  <div>Server Time</div>
                  <div>Expire Time</div>
                  <div>Remaining</div>
                  <div>Users</div>
                  <div>Action</div>
                </div>

                {sortedGroupExpirations.length === 0 && (
                  <div style={{
                    padding: '28px 24px',
                    color: '#5a6072',
                    textAlign: 'center',
                    fontSize: '14px',
                  }}>
                    No group expirations configured yet.
                  </div>
                )}

                {sortedGroupExpirations.map(group => (
                  <div key={group.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1.2fr 1.2fr 1fr 1.5fr 100px',
                    padding: '16px 24px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    alignItems: 'center',
                  }}>
                    <div style={{ color: '#fff', fontWeight: 600 }}>{group.group_id}</div>
                    <div style={{ color: '#8b92a8', fontSize: '13px' }}>{formatDateTime(group.servertime)}</div>
                    <div style={{ color: '#8b92a8', fontSize: '13px' }}>{formatDateTime(group.expiretime)}</div>
                    <div>
                      <span style={{
                        display: 'inline-flex',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: new Date(group.expiretime).getTime() <= Date.now()
                          ? 'rgba(255, 68, 68, 0.12)'
                          : 'rgba(0, 255, 136, 0.12)',
                        color: new Date(group.expiretime).getTime() <= Date.now()
                          ? '#ff4444'
                          : '#00ff88',
                      }}>
                        {formatRemainingTime(group.expiretime)}
                      </span>
                    </div>
                    <div style={{ color: '#fff', fontSize: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {users
                        .filter(u => String(u.group_id || 'not set') === group.group_id)
                        .map(u => (
                          <span key={u.id} style={{
                            background: 'rgba(10,12,21,0.5)',
                            padding: '2px 6px',
                            borderRadius: '6px',
                          }}>
                            {u.username}
                          </span>
                        ))
                      }
                    </div>
                    <div>
                      <button
                        onClick={() => {
                          setEditingGroupId(group.group_id)
                          setExpDays('0')
                          setExpHours('0')
                          setExpMinutes('0')
                          setExpSeconds('0')
                          setIsExpModalOpen(true)
                        }}
                        style={{
                          padding: '6px 12px',
                          background: 'rgba(255, 149, 0, 0.12)',
                          color: '#ff9500',
                          border: '1px solid rgba(255, 149, 0, 0.3)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* Regular User - Tabs */}
        {user.role === 'user' && (
          <div>
            {/* User Tabs */}
            <div style={{
              display: 'flex',
              gap: '4px',
              marginBottom: '32px',
              padding: '4px',
              background: 'rgba(20, 22, 35, 0.5)',
              borderRadius: '12px',
              width: 'fit-content',
            }}>
              <button
                onClick={() => setActiveTab('files')}
                style={{
                  padding: '10px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  background: activeTab === 'files' ? 'rgba(255, 149, 0, 0.15)' : 'transparent',
                  color: activeTab === 'files' ? '#ff9500' : '#5a6072',
                }}
              >
                Files
              </button>
              <button
                onClick={() => setActiveTab('config')}
                style={{
                  padding: '10px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  background: activeTab === 'config' ? 'rgba(255, 149, 0, 0.15)' : 'transparent',
                  color: activeTab === 'config' ? '#ff9500' : '#5a6072',
                }}
              >
                Config
              </button>
            </div>

            {/* User - Files Tab */}
            {activeTab === 'files' && (
              <div>
                <div style={{
                  background: 'rgba(20, 22, 35, 0.7)',
                  border: '1px solid rgba(0, 255, 136, 0.2)',
                  borderRadius: '16px',
                  padding: '32px',
                }}>
                  <h2 style={{ color: '#00ff88', fontSize: '24px', marginBottom: '8px' }}>
                    Downloads
                  </h2>

                  {files.length === 0 && (
                    <div style={{
                      background: 'rgba(20, 22, 35, 0.5)',
                      border: '1px dashed rgba(0, 255, 136, 0.3)',
                      borderRadius: '12px',
                      padding: '40px',
                      textAlign: 'center',
                      color: '#5a6072',
                    }}>
                      No files available yet
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {files.map(file => (
                      <div key={file.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px 20px',
                        background: 'rgba(20, 22, 35, 0.5)',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                            <div style={{ color: '#fff', fontWeight: 600, fontSize: '15px' }}>
                              {file.original_name}
                            </div>
                            <div style={{ color: '#5a6072', fontSize: '12px' }}>
                              {formatBytes(file.size)}
                            </div>
                          </div>
                          <div style={{ color: '#5a6072', fontSize: '12px', marginTop: '4px' }}>
                            {new Date(file.created_at).toLocaleString('en-PH', {
                              timeZone: 'Asia/Manila',
                              year: 'numeric',
                              month: 'short',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownload(file)}
                          style={{
                            padding: '8px 18px',
                            background: 'rgba(0, 255, 136, 0.1)',
                            color: '#00ff88',
                            border: '1px solid rgba(0, 255, 136, 0.3)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(0, 255, 136, 0.2)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(0, 255, 136, 0.1)'
                          }}
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* User - Config Tab */}
            {activeTab === 'config' && (
              <div>
                <div style={{
                  background: 'rgba(20, 22, 35, 0.7)',
                  border: '1px solid rgba(0, 255, 136, 0.2)',
                  borderRadius: '16px',
                  padding: '32px',
                }}>
                  <h2 style={{ color: '#00ff88', fontSize: '24px', marginBottom: '24px' }}>
                    Configuration Settings
                  </h2>
                  
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{
                      display: 'block',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 600,
                      marginBottom: '12px',
                    }}>
                      Configuration Text
                    </label>
                    <textarea
                      value={configText}
                      onChange={(e) => setConfigText(e.target.value)}
                      placeholder="Enter your configuration settings here..."
                      style={{
                        width: '100%',
                        height: '300px',
                        background: 'rgba(10, 12, 21, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '16px',
                        color: '#fff',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        resize: 'vertical',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 255, 136, 0.5)'
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                      }}
                    />
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '24px',
                  }}>
                    <div>
                      {configMessage && (
                        <p style={{
                          color: configMessage.includes('success') ? '#00ff88' : '#ff4444',
                          fontSize: '14px',
                          fontWeight: 500,
                        }}>
                          {configMessage}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleSaveConfig}
                      disabled={savingConfig}
                      style={{
                        padding: '12px 28px',
                        background: savingConfig ? '#3a3d4e' : '#00ff88',
                        color: '#0a0c15',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: savingConfig ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        fontSize: '14px',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {savingConfig ? 'Saving...' : 'Save Configuration'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Expiration Editor Modal */}
        {isExpModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
          }}>
            <div style={{
              background: '#0a0c15',
              padding: '32px',
              borderRadius: '20px',
              border: '1px solid rgba(255, 149, 0, 0.3)',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            }}>
              <h2 style={{ color: '#ff9500', fontSize: '22px', marginBottom: '8px' }}>Set Group Expiration</h2>
              <p style={{ color: '#5a6072', fontSize: '14px', marginBottom: '24px' }}>
                Updating group: <span style={{ color: '#fff', fontWeight: 600 }}>{editingGroupId}</span>
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                {[
                  { label: 'Days', val: expDays, set: setExpDays },
                  { label: 'Hours', val: expHours, set: setExpHours },
                  { label: 'Minutes', val: expMinutes, set: setExpMinutes },
                  { label: 'Seconds', val: expSeconds, set: setExpSeconds },
                ].map((input) => (
                  <div key={input.label}>
                    <label style={{ display: 'block', color: '#8b92a8', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 600 }}>
                      {input.label}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={input.val}
                      onChange={(e) => input.set(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'rgba(10, 12, 21, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setIsExpModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    color: '#8b92a8',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveExpiration}
                  disabled={bulkProcessing}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#ff9500',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#0a0c15',
                    cursor: bulkProcessing ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 700,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {bulkProcessing ? 'Saving...' : 'Update Expiration'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}