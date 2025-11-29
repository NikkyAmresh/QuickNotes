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
        // Validate session before setting up notes
        await validateSession()
        
        if (!mounted) return

        await fetchNotes()

        if (!mounted) return

        // Set up real-time subscription (only if authenticated)
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
              
              // Validate session before processing real-time updates
              validateSession().catch(() => {
                // Session invalid, stop processing updates
                if (channel) {
                  supabase.removeChannel(channel)
                }
                window.location.reload()
              })
              
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
          // If session invalid, reload
          if (err.message.includes('authenticated') || err.message.includes('session') || err.message.includes('Invalid') || err.message.includes('expired')) {
            window.location.reload()
          }
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
      const token = localStorage.getItem('sessionToken')
      if (!token) {
        throw new Error('Not authenticated')
      }
      
      setLoading(true)
      setError(null)
      
      // Use server-side function that enforces authentication
      const { data, error } = await supabase.rpc('get_notes', {
        session_token_param: token
      })

      if (error) {
        console.error('Supabase error fetching notes:', error)
        throw error
      }
      
      setNotes(data || [])
      setError(null)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching notes:', err)
      // Session/auth errors - clear notes and let App.jsx handle redirect
      if (err.message.includes('authenticated') || err.message.includes('session') || err.message.includes('Invalid') || err.message.includes('expired') || err.message.includes('Invalid or expired session')) {
        setNotes([])
        setError(null) // Don't show error, just redirect
        setLoading(false)
        // Trigger page reload to force auth check
        window.location.reload()
        return
      }
      setError(err.message)
      setNotes([])
      setLoading(false)
    }
  }

  const createNote = async (title, content) => {
    try {
      const token = localStorage.getItem('sessionToken')
      if (!token) {
        throw new Error('Not authenticated')
      }
      
      // Use server-side function that enforces authentication
      const { data, error } = await supabase.rpc('create_note', {
        session_token_param: token,
        note_title: title,
        note_content: content
      })

      if (error) throw error
      
      // Real-time subscription will handle the update, but we can also add it immediately
      if (data && data.length > 0) {
        setNotes((prev) => [data[0], ...prev])
        return { data: data[0], error: null }
      }
      
      return { data: null, error: 'No data returned' }
    } catch (err) {
      console.error('Error creating note:', err)
      // If session invalid, reload to force auth
      if (err.message.includes('authenticated') || err.message.includes('session') || err.message.includes('Invalid') || err.message.includes('expired') || err.message.includes('Invalid or expired session')) {
        window.location.reload()
      }
      return { data: null, error: err.message }
    }
  }

  const updateNote = async (id, title, content) => {
    try {
      const token = localStorage.getItem('sessionToken')
      if (!token) {
        throw new Error('Not authenticated')
      }
      
      // Use server-side function that enforces authentication
      const { data, error } = await supabase.rpc('update_note', {
        session_token_param: token,
        note_id: id,
        note_title: title,
        note_content: content
      })

      if (error) throw error
      
      if (data && data.length > 0) {
        return { data: data[0], error: null }
      }
      
      return { data: null, error: 'No data returned' }
    } catch (err) {
      console.error('Error updating note:', err)
      // If session invalid, reload to force auth
      if (err.message.includes('authenticated') || err.message.includes('session') || err.message.includes('Invalid') || err.message.includes('expired') || err.message.includes('Invalid or expired session')) {
        window.location.reload()
      }
      return { data: null, error: err.message }
    }
  }

  const deleteNote = async (id) => {
    try {
      const token = localStorage.getItem('sessionToken')
      if (!token) {
        throw new Error('Not authenticated')
      }
      
      // Use server-side function that enforces authentication
      const { data, error } = await supabase.rpc('delete_note', {
        session_token_param: token,
        note_id: id
      })

      if (error) throw error
      return { error: null }
    } catch (err) {
      console.error('Error deleting note:', err)
      // If session invalid, reload to force auth
      if (err.message.includes('authenticated') || err.message.includes('session') || err.message.includes('Invalid') || err.message.includes('expired') || err.message.includes('Invalid or expired session')) {
        window.location.reload()
      }
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

