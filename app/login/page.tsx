'use client'

import { useState, useEffect } from 'react'
import { login, register } from './actions'

export default function LoginPage() {
  const [message, setMessage] = useState('')
  const [isRegister, setIsRegister] = useState(false)

  useEffect(() => {
     const session = localStorage.getItem('ezcrosshair_user')
    if (session) {
      window.location.href = '/dashboard'
    }
    const particlesContainer = document.getElementById('particles')
    if (particlesContainer && particlesContainer.children.length === 0) {
      for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div')
        particle.className = 'particle'
        particle.style.left = Math.random() * 100 + '%'
        particle.style.animationDelay = Math.random() * 15 + 's'
        particle.style.animationDuration = (15 + Math.random() * 10) + 's'
        particlesContainer.appendChild(particle)
      }
    }

    const inputs = document.querySelectorAll('input')
    inputs.forEach(input => {
      input.addEventListener('focus', function() {
        const parent = this.parentElement
        if (parent) {
          parent.style.transform = 'scale(1.02)'
          parent.style.transition = 'transform 0.3s ease'
        }
      })
      
      input.addEventListener('blur', function() {
        const parent = this.parentElement
        if (parent) {
          parent.style.transform = 'scale(1)'
        }
      })
    })
  }, [])

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
    
    window.location.href = '/dashboard'
  }
}

  async function handleRegister(formData: FormData) {
    setMessage('')
    const result = await register(formData)
    if (result?.error) setMessage(result.error)
    if (result?.success) setMessage(result.success)
  }

  return (
    <>
      <style jsx global>{`
        :root {
          --accent-primary: #ff9500;
          --accent-glow: rgba(255, 149, 0, 0.5);
          --text-secondary: #8b92a8;
          --text-muted: #5a6072;
          --glass-border: rgba(255, 255, 255, 0.1);
          --danger: #ff4444;
          --danger-glow: rgba(255, 68, 68, 0.5);
          --success: #00ff88;
          --success-glow: rgba(0, 255, 136, 0.5);
        }

        .particles {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
          z-index: 0;
        }

        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: var(--accent-primary);
          border-radius: 50%;
          opacity: 0.3;
          animation: float 15s infinite;
          box-shadow: 0 0 10px var(--accent-glow);
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
          }
          10% { opacity: 0.3; }
          90% { opacity: 0.3; }
          100% {
            transform: translateY(-100vh) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        .btn-glow {
          position: relative;
          overflow: hidden;
        }

        .btn-glow::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          transition: left 0.5s;
        }

        .btn-glow:hover::before {
          left: 100%;
        }

        .register-link::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0;
          height: 2px;
          background: var(--accent-primary);
          transition: width 0.3s ease;
          box-shadow: 0 0 10px var(--accent-glow);
        }

        .register-link:hover::after {
          width: 100%;
        }
      `}</style>

      <div className="particles" id="particles"></div>

      <div style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px',
        position: 'relative',
        background: 'linear-gradient(135deg, #0a0c15 0%, #1a1d2e 50%, #0f111a 100%)',
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      }}>
        <div style={{
          width: '100%',
          maxWidth: '420px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: 'rgba(20, 22, 35, 0.7)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)',
          borderRadius: '20px',
          padding: '40px',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
          zIndex: 1,
        }}>
          <div style={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
            opacity: 0.1,
            pointerEvents: 'none',
          }}></div>

          {/* Logo */}
          <div style={{ marginBottom: '32px', position: 'relative', zIndex: 1 }}>
            <div style={{
              fontSize: '36px',
              marginBottom: '8px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#fff',
              fontWeight: 700,
            }}>
              EzCrosshair
              <span style={{
                color: '#000',
                background: 'linear-gradient(135deg, #ff9500, #ff7700)',
                padding: '4px 12px',
                borderRadius: '8px',
                boxShadow: '0 0 20px rgba(255, 149, 0, 0.6), 0 0 40px rgba(255, 149, 0, 0.3)',
                marginLeft: '4px',
                display: 'inline-block',
              }}>X</span>
            </div>
            <div style={{
              color: 'var(--text-secondary)',
              fontSize: '14px',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              marginTop: '8px',
            }}>
              Simple Gaming Tool
            </div>
          </div>

          {/* Message */}
            {message && (
            <div style={{
                background: message.includes('success') || message.includes('created') || message.includes('approval')
                ? 'rgba(255, 149, 0, 0.1)'  // Orange for pending
                : message.includes('wait')
                ? 'rgba(255, 149, 0, 0.1)'
                : 'rgba(255, 68, 68, 0.1)',
                border: `1px solid ${message.includes('success') || message.includes('created') || message.includes('approval') || message.includes('wait')
                ? 'var(--accent-primary)'  // Orange
                : 'var(--danger)'}`,
                color: message.includes('success') || message.includes('created') || message.includes('approval') || message.includes('wait')
                ? 'var(--accent-primary)'
                : 'var(--danger)',
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '24px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                animation: 'shake 0.5s ease',
            }}>
                <span style={{ fontSize: '16px' }}>
                {message.includes('success') || message.includes('created') ? '✓' : 
                message.includes('wait') || message.includes('pending') ? '⏳' : '⚠'}
                </span>
                {message}
            </div>
            )}

          {/* LOGIN FORM */}
          {!isRegister ? (
            <form action={handleLogin} style={{ textAlign: 'left', position: 'relative', zIndex: 1 }}>
              <div style={{ position: 'relative', marginBottom: '24px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '10px',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600,
                }}>
                  <span style={{ color: 'var(--accent-primary)', fontSize: '16px' }}>›</span>
                  Username
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    name="username" 
                    type="text" 
                    placeholder="Enter your username" 
                    required 
                    autoComplete="username"
                    style={{
                      width: '100%',
                      padding: '14px 16px 14px 44px',
                      fontSize: '15px',
                      height: '52px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '10px',
                      color: '#fff',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    fontSize: '18px',
                    pointerEvents: 'none',
                  }}>👤</span>
                </div>
              </div>

              <div style={{ position: 'relative', marginBottom: '24px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '10px',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600,
                }}>
                  <span style={{ color: 'var(--accent-primary)', fontSize: '16px' }}>›</span>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    name="password" 
                    type="password" 
                    placeholder="Enter your password" 
                    required 
                    autoComplete="current-password"
                    style={{
                      width: '100%',
                      padding: '14px 16px 14px 44px',
                      fontSize: '15px',
                      height: '52px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '10px',
                      color: '#fff',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    fontSize: '18px',
                    pointerEvents: 'none',
                  }}>🔐</span>
                </div>
              </div>

              <button 
                type="submit"
                className="btn-glow"
                style={{
                  width: '100%',
                  height: '52px',
                  fontSize: '15px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginTop: '8px',
                  background: 'linear-gradient(135deg, #ff9500, #ff7700)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(255, 149, 0, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <span>Initialize Login</span>
                <span style={{ marginLeft: '8px' }}>→</span>
              </button>
            </form>
          ) : (
            /* REGISTER FORM */
            <form action={handleRegister} style={{ textAlign: 'left', position: 'relative', zIndex: 1 }}>
              <div style={{ position: 'relative', marginBottom: '24px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '10px',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600,
                }}>
                  <span style={{ color: 'var(--accent-primary)', fontSize: '16px' }}>›</span>
                  Username
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    name="username" 
                    type="text" 
                    placeholder="Choose a username" 
                    required 
                    minLength={3}
                    maxLength={32}
                    autoComplete="username"
                    style={{
                      width: '100%',
                      padding: '14px 16px 14px 44px',
                      fontSize: '15px',
                      height: '52px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '10px',
                      color: '#fff',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    fontSize: '18px',
                    pointerEvents: 'none',
                  }}>👤</span>
                </div>
              </div>

              <div style={{ position: 'relative', marginBottom: '24px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '10px',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600,
                }}>
                  <span style={{ color: 'var(--accent-primary)', fontSize: '16px' }}>›</span>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    name="password" 
                    type="password" 
                    placeholder="Create a password" 
                    required 
                    minLength={6}
                    autoComplete="new-password"
                    style={{
                      width: '100%',
                      padding: '14px 16px 14px 44px',
                      fontSize: '15px',
                      height: '52px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '10px',
                      color: '#fff',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    fontSize: '18px',
                    pointerEvents: 'none',
                  }}>🔐</span>
                </div>
              </div>

              <div style={{ position: 'relative', marginBottom: '24px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '10px',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600,
                }}>
                  <span style={{ color: 'var(--accent-primary)', fontSize: '16px' }}>›</span>
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    name="passwordConfirm" 
                    type="password" 
                    placeholder="Repeat your password" 
                    required 
                    autoComplete="new-password"
                    style={{
                      width: '100%',
                      padding: '14px 16px 14px 44px',
                      fontSize: '15px',
                      height: '52px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '10px',
                      color: '#fff',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    fontSize: '18px',
                    pointerEvents: 'none',
                  }}>🔁</span>
                </div>
              </div>

              <button 
                type="submit"
                className="btn-glow"
                style={{
                  width: '100%',
                  height: '52px',
                  fontSize: '15px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginTop: '8px',
                  background: 'linear-gradient(135deg, #ff9500, #ff7700)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(255, 149, 0, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <span>Create Account</span>
                <span style={{ marginLeft: '8px' }}>→</span>
              </button>
            </form>
          )}

          {/* Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '28px 0',
            color: 'var(--text-muted)',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, var(--glass-border), transparent)' }}></div>
            <span style={{ padding: '0 16px' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, var(--glass-border), transparent)' }}></div>
          </div>

          {/* Toggle */}
          <div style={{ textAlign: 'center', paddingTop: '8px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px' }}>
              {isRegister ? 'Already have an account?' : "Don't have an account?"}
            </div>
            <button
              onClick={() => {
                setIsRegister(!isRegister)
                setMessage('')
              }}
              className="register-link"
              style={{
                color: 'var(--accent-primary)',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.3s ease',
                position: 'relative',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffbb33'
                e.currentTarget.style.textShadow = '0 0 10px var(--accent-glow)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--accent-primary)'
                e.currentTarget.style.textShadow = 'none'
              }}
            >
              <span>{isRegister ? 'Sign in' : 'Create one'}</span>
              <span>↗</span>
            </button>
          </div>

          {/* Security Badge */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '24px',
              padding: '10px 18px',
              background: 'rgba(0, 255, 136, 0.05)',
              border: '1px solid rgba(0, 255, 136, 0.2)',
              borderRadius: '20px',
              fontSize: '12px',
              color: 'var(--success)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              <span>🔒</span>
              Encrypted Connection
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
