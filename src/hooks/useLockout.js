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

  // Check lockout status from server (universal lockout)
  const checkLockoutStatus = async () => {
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

  // Record a failed login attempt (universal lockout)
  const recordFailedAttempt = async () => {
    try {
      const { data: existing } = await supabase
        .from('universal_lockout')
        .select('*')
        .eq('id', UNIVERSAL_LOCKOUT_ID)
        .single()

      const newAttempts = (existing?.failed_attempts || 0) + 1
      const shouldLock = newAttempts >= MAX_ATTEMPTS
      const lockoutUntil = shouldLock
        ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
        : null

      // Update the universal lockout record
      const { data, error } = await supabase
        .from('universal_lockout')
        .update({
          failed_attempts: newAttempts,
          lockout_until: lockoutUntil,
          last_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', UNIVERSAL_LOCKOUT_ID)
        .select()
        .single()

      if (error) throw error

      if (shouldLock) {
        setIsLocked(true)
        setLockoutTimeLeft(LOCKOUT_DURATION_MS)
      }
      setFailedAttempts(newAttempts)
    } catch (err) {
      console.error('Error recording failed attempt:', err)
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

  // Update countdown timer every second when locked
  useEffect(() => {
    if (!isLocked) return

    const interval = setInterval(async () => {
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
    }, 1000)

    return () => clearInterval(interval)
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

