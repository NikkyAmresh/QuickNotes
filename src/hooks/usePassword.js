import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PASSWORD_ID = 1 // Single row ID for password

export function usePassword() {
  const [passwordExists, setPasswordExists] = useState(false)
  const [loading, setLoading] = useState(true)
  const [passwordSequence, setPasswordSequence] = useState(null)

  // Check if password exists on server
  const checkPasswordExists = async () => {
    try {
      const { data, error } = await supabase
        .from('app_password')
        .select('password_sequence')
        .eq('id', PASSWORD_ID)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking password:', error)
        return false
      }

      if (data && data.password_sequence && data.password_sequence.length > 0) {
        setPasswordExists(true)
        setPasswordSequence(data.password_sequence)
        return true
      } else {
        setPasswordExists(false)
        setPasswordSequence(null)
        return false
      }
    } catch (err) {
      console.error('Error checking password existence:', err)
      return false
    } finally {
      setLoading(false)
    }
  }

  // Save password to server
  const savePassword = async (sequence) => {
    try {
      const { data: existing } = await supabase
        .from('app_password')
        .select('id')
        .eq('id', PASSWORD_ID)
        .single()

      if (existing) {
        // Update existing password
        const { error } = await supabase
          .from('app_password')
          .update({
            password_sequence: sequence,
            updated_at: new Date().toISOString()
          })
          .eq('id', PASSWORD_ID)

        if (error) throw error
      } else {
        // Insert new password
        const { error } = await supabase
          .from('app_password')
          .insert([{
            id: PASSWORD_ID,
            password_sequence: sequence
          }])

        if (error) throw error
      }

      setPasswordExists(true)
      setPasswordSequence(sequence)
      return { success: true, error: null }
    } catch (err) {
      console.error('Error saving password:', err)
      return { success: false, error: err.message }
    }
  }

  // Validate password against server
  const validatePassword = async (sequence) => {
    try {
      const { data, error } = await supabase
        .from('app_password')
        .select('password_sequence')
        .eq('id', PASSWORD_ID)
        .single()

      if (error) {
        return { valid: false, error: error.message }
      }

      if (!data || !data.password_sequence) {
        return { valid: false, error: 'Password not set' }
      }

      // Compare sequences
      const isValid = JSON.stringify(data.password_sequence) === JSON.stringify(sequence)
      return { valid: isValid, error: null }
    } catch (err) {
      console.error('Error validating password:', err)
      return { valid: false, error: err.message }
    }
  }

  // Initialize - check if password exists
  useEffect(() => {
    checkPasswordExists()
  }, [])

  return {
    passwordExists,
    passwordSequence,
    loading,
    checkPasswordExists,
    savePassword,
    validatePassword
  }
}

