import { useState, useEffect } from 'react'
import { useLockout } from '../hooks/useLockout'
import { usePassword } from '../hooks/usePassword'
import { useAuth } from '../hooks/useAuth'
import './PicturePasswordAuth.css'

// Using emoji/images as password options for simplicity
const PASSWORD_IMAGES = [
  { id: 1, emoji: '🔑', name: 'key' },
  { id: 2, emoji: '⭐', name: 'star' },
  { id: 3, emoji: '❤️', name: 'heart' },
  { id: 4, emoji: '🌟', name: 'star2' },
  { id: 5, emoji: '🎯', name: 'target' },
  { id: 6, emoji: '🔥', name: 'fire' },
  { id: 7, emoji: '💎', name: 'diamond' },
  { id: 8, emoji: '🚀', name: 'rocket' },
  { id: 9, emoji: '🎨', name: 'palette' },
  { id: 10, emoji: '⚡', name: 'lightning' },
  { id: 11, emoji: '🌙', name: 'moon' },
  { id: 12, emoji: '☀️', name: 'sun' },
]

const MAX_ATTEMPTS = 3

export function PicturePasswordAuth() {
  const [selectedSequence, setSelectedSequence] = useState([])
  const [isSettingPassword, setIsSettingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState([])
  const [confirmPassword, setConfirmPassword] = useState([])
  const [step, setStep] = useState('check') // 'check', 'set', 'confirm'
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  
  // Use server-side authentication hook
  const { createSession, checkAuthStatus } = useAuth()

  // Use server-side password hook
  const {
    passwordExists,
    passwordSequence,
    loading: passwordLoading,
    savePassword,
    validatePassword
  } = usePassword()

  // Use server-side lockout hook
  const {
    isLocked,
    lockoutTimeLeft,
    failedAttempts,
    loading: lockoutLoading,
    recordFailedAttempt,
    resetLockout,
    checkLockoutStatus
  } = useLockout()

  // Don't check auth status here - App.jsx handles it

  // Check if password exists on server and set up mode accordingly
  useEffect(() => {
    if (!passwordLoading) {
      if (!passwordExists) {
        setIsSettingPassword(true)
        setStep('set')
        setMessage('Set up your picture password. Select 3-5 images in order.')
      } else {
        setIsSettingPassword(false)
        setStep('check')
      }
    }
  }, [passwordExists, passwordLoading])

  const formatTimeLeft = (ms) => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const handleImageClick = async (imageId) => {
    if (isLocked) return
    
    setError('')
    
    if (isSettingPassword) {
      if (step === 'set') {
        if (newPassword.includes(imageId)) {
          setError('Image already selected. Click to remove or continue.')
          return
        }
        const updated = [...newPassword, imageId]
        setNewPassword(updated)
        if (updated.length >= 3) {
          setMessage(`Password set! Confirm by selecting the same ${updated.length} images again.`)
        }
      } else if (step === 'confirm') {
        const updated = [...confirmPassword, imageId]
        setConfirmPassword(updated)
        
        if (updated.length === newPassword.length) {
          if (JSON.stringify(updated) === JSON.stringify(newPassword)) {
            // Save password to server
            const result = await savePassword(newPassword)
            if (result.success) {
              // Reset lockout on successful password setup
              await resetLockout()
              // Create server-side session
              const sessionResult = await createSession()
              if (sessionResult.success) {
                setMessage('Password confirmed! Welcome!')
                // Wait a moment then reload to refresh auth status
                setTimeout(() => {
                  window.location.reload()
                }, 1000)
              } else {
                setError('Failed to create session. Please try again.')
              }
            } else {
              setError('Failed to save password. Please try again.')
            }
          } else {
            setError('Passwords do not match. Please try again.')
            setNewPassword([])
            setConfirmPassword([])
            setStep('set')
            setMessage('Set up your picture password again.')
          }
        }
      }
    } else {
      // Login attempt - validate against server
      if (isLocked) {
        setError('Account is locked. Please wait.')
        return
      }
      
      if (selectedSequence.includes(imageId)) {
        setError('Image already selected')
        return
      }
      
      const updated = [...selectedSequence, imageId]
      setSelectedSequence(updated)
      
      // Check if we have the password length to validate
      if (passwordSequence && updated.length === passwordSequence.length) {
        try {
          // Validate password against server
          const validation = await validatePassword(updated)
          
          if (validation.valid) {
            // Successful login - reset failed attempts on server
            await resetLockout()
            // Create server-side session
            const sessionResult = await createSession()
            if (sessionResult.success) {
              setMessage('Access granted!')
              // Wait a moment then reload to refresh auth status
              setTimeout(() => {
                window.location.reload()
              }, 1000)
            } else {
              setError('Failed to create session. Please try again.')
            }
          } else {
            // Failed login attempt - record on server (server-side function)
            const lockoutResult = await recordFailedAttempt()
            
            if (!lockoutResult) {
              setError('Error recording attempt. Please try again.')
              setSelectedSequence([])
              return
            }
            
            // Get the actual failed attempts count from the server response
            const currentAttempts = lockoutResult.failedAttempts || 0
            const isLockedNow = lockoutResult.isLocked || false
            const remaining = MAX_ATTEMPTS - currentAttempts
            
            if (isLockedNow) {
              setError(`Too many failed attempts! Account locked for 1 hour.`)
              // Refresh lockout status to show countdown
              await checkLockoutStatus()
            } else {
              setError(`Incorrect password. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`)
            }
            setSelectedSequence([])
          }
        } catch (err) {
          console.error('Error during login:', err)
          setError('An error occurred. Please try again.')
          setSelectedSequence([])
        }
      }
    }
  }

  const handleRemoveLast = () => {
    if (isSettingPassword) {
      if (step === 'set') {
        setNewPassword(newPassword.slice(0, -1))
      } else {
        setConfirmPassword(confirmPassword.slice(0, -1))
      }
    } else {
      setSelectedSequence(selectedSequence.slice(0, -1))
    }
    setError('')
  }

  const handleReset = () => {
    setNewPassword([])
    setConfirmPassword([])
    setSelectedSequence([])
    setStep('set')
    setError('')
    setMessage('Set up your picture password again.')
  }

  const getCurrentSequence = () => {
    if (isSettingPassword) {
      return step === 'set' ? newPassword : confirmPassword
    }
    return selectedSequence
  }

  const getPasswordToCheck = () => {
    if (isSettingPassword && step === 'confirm') {
      return newPassword
    }
    return passwordSequence || []
  }

  // Show loading screen while checking lockout and password status
  if (lockoutLoading || passwordLoading) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <div className="loading">Checking security status...</div>
        </div>
      </div>
    )
  }

  // Show lockout screen
  if (isLocked) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h1>🔒 Account Locked</h1>
          <div className="lockout-message">
            <p>Too many failed login attempts.</p>
            <p>Your account has been locked for security.</p>
            <div className="countdown-timer">
              <div className="timer-label">Try again in:</div>
              <div className="timer-value">{formatTimeLeft(lockoutTimeLeft)}</div>
            </div>
            <p className="lockout-note">Lockout is enforced at the server level.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>🔐 Picture Password</h1>
        
        {failedAttempts > 0 && !isSettingPassword && (
          <div className="attempts-warning">
            Failed attempts: {failedAttempts} / {MAX_ATTEMPTS}
          </div>
        )}
        
        {isSettingPassword ? (
          <>
            {step === 'set' && (
              <>
                <p className="auth-instruction">
                  Select 3-5 images in order to create your password
                </p>
                <p className="auth-message">{message || `Selected: ${newPassword.length} images`}</p>
              </>
            )}
            {step === 'confirm' && (
              <>
                <p className="auth-instruction">
                  Confirm your password by selecting the same images again
                </p>
                <p className="auth-message">
                  Selected: {confirmPassword.length} / {newPassword.length}
                </p>
              </>
            )}
          </>
        ) : (
          <p className="auth-instruction">
            Select your picture password to continue
          </p>
        )}

        {error && <div className="auth-error">{error}</div>}
        {message && !error && <div className="auth-success">{message}</div>}

        <div className="password-display">
          {getCurrentSequence().map((id, index) => (
            <span key={index} className="password-dot">
              {PASSWORD_IMAGES.find(img => img.id === id)?.emoji}
            </span>
          ))}
          {getCurrentSequence().length < getPasswordToCheck().length && (
            <span className="password-placeholder">?</span>
          )}
        </div>

        <div className="image-grid">
          {PASSWORD_IMAGES.map((image) => {
            const isSelected = getCurrentSequence().includes(image.id)
            return (
              <button
                key={image.id}
                className={`image-button ${isSelected ? 'selected' : ''}`}
                onClick={() => handleImageClick(image.id)}
                disabled={isSelected && !isSettingPassword}
              >
                <span className="image-emoji">{image.emoji}</span>
              </button>
            )
          })}
        </div>

        <div className="auth-actions">
          {getCurrentSequence().length > 0 && (
            <button onClick={handleRemoveLast} className="btn-remove">
              Remove Last
            </button>
          )}
          {isSettingPassword && step === 'set' && newPassword.length >= 3 && (
            <button
              onClick={() => {
                setStep('confirm')
                setMessage('Now confirm your password')
              }}
              className="btn-confirm"
            >
              Continue to Confirm
            </button>
          )}
          {isSettingPassword && (
            <button onClick={handleReset} className="btn-reset">
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

