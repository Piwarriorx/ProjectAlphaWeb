'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { approveUser, rejectUser } from './actions'
import { uploadFile, listFiles, deleteFile, getSignedDownloadUrl } from './file-actions'
import { saveUserConfig, getUserConfig } from './config-actions'
import { updateUserGroup, getUsersWithGroups, getAvailableGroups, updateUserRole } from './group-actions'

interface User {
  id: number
  username: string
  role: string
  created_at: string
  last_login_at?: string | null
  group_id?: string | null
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

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState('')
  const [activeTab, setActiveTab] = useState<'users' | 'files' | 'config' | 'management'>('files')
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [configText, setConfigText] = useState('')
  const [configMessage, setConfigMessage] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [managementMessage, setManagementMessage] = useState('')
  const [updatingGroup, setUpdatingGroup] = useState<number | null>(null)
  
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
      setActiveTab('users')
    }

    fetchUsers()
    fetchFiles()
    
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
  }, [])

  async function fetchUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, role, created_at, last_login_at, group_id')
      .order('created_at', { ascending: false })

    setUsers(data || [])
    setLoading(false)
  }

  async function fetchFiles() {
    const { files, error } = await listFiles()
    if (!error) setFiles(files)
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

  function logout() {
    localStorage.removeItem('ezcrosshair_user')
    window.location.href = '/login'
  }

  if (!user) return null
  if (loading) return <div style={{ color: '#fff', padding: 32 }}>Loading...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c15', padding: '32px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
          paddingBottom: '24px',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '32px', fontWeight: 700 }}>
              ProjectAlpha
            </h1>
            <p style={{ color: '#ff9500', fontSize: '18px', marginTop: '8px' }}>
              Welcome, {user.role.charAt(0).toUpperCase() + user.role.slice(1)} {user.username}!
            </p>
            <div style={{ color: '#fff', fontSize: '20px', fontFamily: 'monospace', fontWeight: 600, letterSpacing: '2px', marginTop: '6px' }}>
              {time} <span style={{ fontSize: '11px', color: '#5a6072', fontWeight: 400, letterSpacing: '1px' }}>PHT</span>
            </div>
          </div>

          <button
            onClick={logout}
            style={{
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
                background: 'rgba(20, 22, 35, 0.5)',
                borderRadius: '12px',
                overflow: 'hidden',
                marginBottom: '24px'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 150px',
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
                  <div>Current Group</div>
                </div>

                {users
                  .filter(u => u.role !== 'pending')
                  .sort((a, b) => {
                    // Admin roles first
                    if (a.role === 'admin' && b.role !== 'admin') return -1
                    if (a.role !== 'admin' && b.role === 'admin') return 1
                    return 0
                  })
                  .map(u => (
                  <div key={u.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 150px',
                    padding: '16px 24px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    alignItems: 'center',
                  }}>
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
                          <option value="not set">not set</option>
                        </select>
                      )}
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

      </div>
    </div>
  )
}
