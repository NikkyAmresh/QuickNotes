import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Validate session before operations (with better error handling)
const validateSession = async () => {
  try {
    const token = localStorage.getItem('sessionToken')
    if (!token) {
      throw new Error('Not authenticated')
    }

    const { data, error } = await supabase
      .from('active_session')
      .select('expires_at')
      .eq('session_token', token)
      .single()

    if (error) {
      // PGRST116 = no rows returned
      if (error.code === 'PGRST116') {
        throw new Error('Invalid session')
      }
      throw new Error('Session validation error')
    }

    if (!data) {
      throw new Error('Invalid session')
    }

    const expiresAt = new Date(data.expires_at)
    if (expiresAt <= new Date()) {
      throw new Error('Session expired')
    }

    return true
  } catch (err) {
    // Re-throw with clear error message
    throw err
  }
}

export function useNotes(isAuthenticated = false) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch initial notes only if authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      setNotes([])
      setError(null)
      return
    }
    
    let channel = null
    let mounted = true
    
    const setupNotes = async () => {
      if (!mounted) return
      
      try {
        await fetchNotes()

        if (!mounted) return

        // Set up real-time subscription
        channel = supabase
          .channel('notes-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notes'
            },
            (payload) => {
              if (!mounted) return
              
              if (payload.eventType === 'INSERT') {
                setNotes((prev) => [...prev, payload.new])
              } else if (payload.eventType === 'UPDATE') {
                setNotes((prev) =>
                  prev.map((note) =>
                    note.id === payload.new.id ? payload.new : note
                  )
                )
              } else if (payload.eventType === 'DELETE') {
                setNotes((prev) =>
                  prev.filter((note) => note.id !== payload.old.id)
                )
              }
            }
          )
          .subscribe()
      } catch (err) {
        if (mounted) {
          console.error('Error setting up notes:', err)
        }
      }
    }
    
    setupNotes()

    return () => {
      mounted = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [isAuthenticated])

  const fetchNotes = async () => {
    try {
      // Validate session before fetching
      try {
        await validateSession()
      } catch (sessionErr) {
        // Session invalid - don't fetch notes, but don't show error repeatedly
        if (sessionErr.message.includes('authenticated') || sessionErr.message.includes('session')) {
          setNotes([])
          setLoading(false)
          // Don't set error - let App.jsx handle auth redirect
          return
        }
        throw sessionErr
      }
      
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase error fetching notes:', error)
        throw error
      }
      
      setNotes(data || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching notes:', err)
      // Only set error if it's not a session/auth error
      if (!err.message.includes('authenticated') && !err.message.includes('session') && !err.message.includes('Invalid')) {
        setError(err.message)
      }
      setNotes([])
    } finally {
      setLoading(false)
    }
  }

  const createNote = async (title, content) => {
    try {
      await validateSession() // Validate session before creating
      const { data, error } = await supabase
        .from('notes')
        .insert([{ title, content }])
        .select()
        .single()

      if (error) throw error
      
      // Real-time subscription will handle the update, but we can also add it immediately
      if (data) {
        setNotes((prev) => [data, ...prev])
      }
      
      return { data, error: null }
    } catch (err) {
      console.error('Error creating note:', err)
      return { data: null, error: err.message }
    }
  }

  const updateNote = async (id, title, content) => {
    try {
      await validateSession() // Validate session before updating
      const { data, error } = await supabase
        .from('notes')
        .update({ title, content, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('Error updating note:', err)
      return { data: null, error: err.message }
    }
  }

  const deleteNote = async (id) => {
    try {
      await validateSession() // Validate session before deleting
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { error: null }
    } catch (err) {
      console.error('Error deleting note:', err)
      return { error: err.message }
    }
  }

  return {
    notes,
    loading,
    error,
    createNote,
    updateNote,
    deleteNote
  }
}

