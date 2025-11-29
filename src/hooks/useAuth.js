import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

// Generate a secure session token
const generateSessionToken = () => {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sessionToken, setSessionToken] = useState(null)

  // Check if session exists and is valid on server
  const checkAuthStatus = async (token) => {
    try {
      if (!token) {
        // Check localStorage for existing token
        const storedToken = localStorage.getItem('sessionToken')
        if (!storedToken) {
          setIsAuthenticated(false)
          setLoading(false)
          return false
        }
        token = storedToken
      }

      const { data, error } = await supabase
        .from('active_session')
        .select('expires_at')
        .eq('session_token', token)
        .single()

      if (error || !data) {
        // Session doesn't exist or expired
        localStorage.removeItem('sessionToken')
        setIsAuthenticated(false)
        setLoading(false)
        return false
      }

      const expiresAt = new Date(data.expires_at)
      const now = new Date()

      if (expiresAt > now) {
        // Valid session
        setIsAuthenticated(true)
        setSessionToken(token)
        setLoading(false)
        return true
      } else {
        // Session expired
        await invalidateSession(token)
        setIsAuthenticated(false)
        setLoading(false)
        return false
      }
    } catch (err) {
      console.error('Error checking auth status:', err)
      setIsAuthenticated(false)
      setLoading(false)
      return false
    }
  }

  // Create a new session on server after successful password validation
  const createSession = async () => {
    try {
      const token = generateSessionToken()
      const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

      const { error } = await supabase
        .from('active_session')
        .insert([{
          session_token: token,
          expires_at: expiresAt.toISOString()
        }])

      if (error) throw error

      // Clean up expired sessions
      await supabase.rpc('cleanup_expired_sessions')

      localStorage.setItem('sessionToken', token)
      setSessionToken(token)
      setIsAuthenticated(true)
      return { success: true, token, error: null }
    } catch (err) {
      console.error('Error creating session:', err)
      return { success: false, token: null, error: err.message }
    }
  }

  // Invalidate session on server
  const invalidateSession = async (token) => {
    try {
      if (!token) {
        token = localStorage.getItem('sessionToken')
      }

      if (token) {
        await supabase
          .from('active_session')
          .delete()
          .eq('session_token', token)

        localStorage.removeItem('sessionToken')
      }

      setIsAuthenticated(false)
      setSessionToken(null)
    } catch (err) {
      console.error('Error invalidating session:', err)
    }
  }

  // Initialize - check existing session
  useEffect(() => {
    let mounted = true
    const initAuth = async () => {
      const token = localStorage.getItem('sessionToken')
      if (token && mounted) {
        await checkAuthStatus(token)
      } else if (mounted) {
        setLoading(false)
      }
    }
    initAuth()
    return () => { mounted = false }
  }, [])

  // Periodically check session validity (only when authenticated) - reduced frequency
  useEffect(() => {
    if (!isAuthenticated || !sessionToken) return

    let intervalId = null
    let isChecking = false
    let lastCheckTime = Date.now()

    const checkSession = async () => {
      // Prevent too frequent checks (minimum 2 minutes between checks)
      const timeSinceLastCheck = Date.now() - lastCheckTime
      if (timeSinceLastCheck < 120000) return // 2 minutes
      
      if (isChecking) return
      isChecking = true
      lastCheckTime = Date.now()
      
      try {
        const token = localStorage.getItem('sessionToken')
        if (token) {
          await checkAuthStatus(token)
        }
      } catch (err) {
        console.error('Error in periodic session check:', err)
      } finally {
        isChecking = false
      }
    }

    intervalId = setInterval(checkSession, 300000) // Check every 5 minutes (reduced frequency)

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [isAuthenticated, sessionToken])

  return {
    isAuthenticated,
    loading,
    sessionToken,
    checkAuthStatus,
    createSession,
    invalidateSession
  }
}

