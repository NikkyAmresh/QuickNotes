import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const MAX_ATTEMPTS = 3
const LOCKOUT_DURATION_MS = 60 * 60 * 1000 // 1 hour
const UNIVERSAL_LOCKOUT_ID = 1 // Single row ID for universal lockout

export function useLockout() {
  const [isLocked, setIsLocked] = useState(false)
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [loading, setLoading] = useState(true)

  // Throttle checkLockoutStatus to prevent rapid calls
  let lastCheckTime = 0
  const CHECK_THROTTLE_MS = 2000 // Minimum 2 seconds between checks

  // Check lockout status from server (universal lockout)
  const checkLockoutStatus = async (force = false) => {
    const now = Date.now()
    if (!force && (now - lastCheckTime) < CHECK_THROTTLE_MS) {
      return // Skip if called too soon
    }
    lastCheckTime = now

    try {
      const { data, error } = await supabase
        .from('universal_lockout')
        .select('*')
        .eq('id', UNIVERSAL_LOCKOUT_ID)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking lockout:', error)
        return
      }

      if (data) {
        const now = new Date()
        const lockoutUntil = data.lockout_until ? new Date(data.lockout_until) : null

        if (lockoutUntil && lockoutUntil > now) {
          // Still locked
          setIsLocked(true)
          setLockoutTimeLeft(lockoutUntil.getTime() - now.getTime())
          setFailedAttempts(data.failed_attempts || 0)
        } else if (lockoutUntil && lockoutUntil <= now) {
          // Lockout expired, reset it
          await resetLockout()
        } else {
          // Not locked
          setIsLocked(false)
          setFailedAttempts(data.failed_attempts || 0)
        }
      } else {
        // No record exists (shouldn't happen, but handle it)
        setIsLocked(false)
        setFailedAttempts(0)
      }
    } catch (err) {
      console.error('Error checking lockout status:', err)
    } finally {
      setLoading(false)
    }
  }

  // Record a failed login attempt (server-side function)
  const recordFailedAttempt = async () => {
    try {
      // Call server-side function to handle lockout logic
      const { data, error } = await supabase.rpc('record_failed_attempt')

      if (error) {
        console.error('Error calling record_failed_attempt:', error)
        throw error
      }

      if (!data || data.length === 0) {
        throw new Error('No data returned from server')
      }

      const result = data[0]
      const newAttempts = result.failed_attempts || 0
      const isLocked = result.is_locked || false
      const lockoutUntil = result.lockout_until

      // Update local state
      setFailedAttempts(newAttempts)
      
      if (isLocked && lockoutUntil) {
        setIsLocked(true)
        const lockoutTime = new Date(lockoutUntil)
        const now = new Date()
        setLockoutTimeLeft(Math.max(0, lockoutTime.getTime() - now.getTime()))
      } else {
        setIsLocked(false)
        setLockoutTimeLeft(0)
      }
      
      return { 
        failedAttempts: newAttempts, 
        isLocked: isLocked,
        lockoutUntil: lockoutUntil
      }
    } catch (err) {
      console.error('Error recording failed attempt:', err)
      // Return current state on error
      return { 
        failedAttempts: failedAttempts, 
        isLocked: isLocked,
        lockoutUntil: null
      }
    }
  }

  // Reset lockout on successful login (universal reset)
  const resetLockout = async () => {
    try {
      const { error } = await supabase
        .from('universal_lockout')
        .update({
          failed_attempts: 0,
          lockout_until: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', UNIVERSAL_LOCKOUT_ID)

      if (error) throw error

      setIsLocked(false)
      setFailedAttempts(0)
      setLockoutTimeLeft(0)
    } catch (err) {
      console.error('Error resetting lockout:', err)
    }
  }

  // Initialize and set up timer
  useEffect(() => {
    checkLockoutStatus()
  }, [])

  // Update countdown timer (slower frequency to reduce API calls)
  useEffect(() => {
    if (!isLocked) return

    // Calculate time left locally without API call
    const updateTimer = () => {
      setLockoutTimeLeft((prev) => {
        const newTime = prev - 1000
        if (newTime <= 0) {
          // Check server only when timer expires
          checkLockoutStatus()
          return 0
        }
        return newTime
      })
    }

    // Update every second locally
    const interval = setInterval(updateTimer, 1000)

    // Check server every 2 minutes to sync (reduced frequency)
    const syncInterval = setInterval(async () => {
      const { data } = await supabase
        .from('universal_lockout')
        .select('lockout_until')
        .eq('id', UNIVERSAL_LOCKOUT_ID)
        .single()

      if (data?.lockout_until) {
        const lockoutUntil = new Date(data.lockout_until)
        const now = new Date()
        const timeLeft = lockoutUntil.getTime() - now.getTime()

        if (timeLeft > 0) {
          setLockoutTimeLeft(timeLeft)
        } else {
          // Lockout expired
          await resetLockout()
        }
      }
    }, 120000) // Check server every 2 minutes instead of every second

    return () => {
      clearInterval(interval)
      clearInterval(syncInterval)
    }
  }, [isLocked])

  return {
    isLocked,
    lockoutTimeLeft,
    failedAttempts,
    loading,
    recordFailedAttempt,
    resetLockout,
    checkLockoutStatus
  }
}

