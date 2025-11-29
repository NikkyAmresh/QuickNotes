import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Validate session before operations
const validateSession = async () => {
  const token = localStorage.getItem('sessionToken')
  if (!token) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('active_session')
    .select('expires_at')
    .eq('session_token', token)
    .single()

  if (error || !data) {
    throw new Error('Invalid session')
  }

  const expiresAt = new Date(data.expires_at)
  if (expiresAt <= new Date()) {
    throw new Error('Session expired')
  }

  return true
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
      return
    }
    
    let channel = null
    
    const setupNotes = async () => {
      await fetchNotes()

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
            console.log('Real-time update:', payload)
            
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
    }
    
    setupNotes()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [isAuthenticated])

  const fetchNotes = async () => {
    try {
      await validateSession() // Validate session before fetching
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
      
      console.log('Fetched notes:', data)
      setNotes(data || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching notes:', err)
      setError(err.message)
      // If session validation failed, clear notes
      if (err.message.includes('authenticated') || err.message.includes('session') || err.message.includes('Invalid')) {
        setNotes([])
      }
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

