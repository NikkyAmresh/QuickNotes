import { useState, useMemo, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useNotes } from './hooks/useNotes'
import { NoteForm } from './components/NoteForm'
import { NoteCard } from './components/NoteCard'
import { Pagination } from './components/Pagination'
import { PicturePasswordAuth } from './components/PicturePasswordAuth'
import './App.css'

const NOTES_PER_PAGE = 12

function App() {
  // Server-side authentication check
  const { isAuthenticated, loading: authLoading } = useAuth()
  
  // Only load notes if authenticated
  const notesHook = useNotes(isAuthenticated)
  const { notes, loading, error, createNote, updateNote, deleteNote } = notesHook
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  
  // Calculate pagination
  const totalPages = Math.ceil(notes.length / NOTES_PER_PAGE)
  const paginatedNotes = useMemo(() => {
    const startIndex = (currentPage - 1) * NOTES_PER_PAGE
    const endIndex = startIndex + NOTES_PER_PAGE
    return notes.slice(startIndex, endIndex)
  }, [notes, currentPage])
  
  // Reset to page 1 when notes change significantly
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [notes.length, currentPage, totalPages])

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="app">
        <div className="container">
          <div className="loading">Verifying authentication...</div>
        </div>
      </div>
    )
  }

  // Show auth screen if not authenticated (server-validated)
  if (!isAuthenticated) {
    return <PicturePasswordAuth />
  }

  if (loading) {
    return (
      <div className="app">
        <div className="container">
          <div className="loading">Loading notes...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="container">
        <header className="app-header">
          <h1>📝 Real-Time Notes</h1>
          <p className="subtitle">Your notes sync in real-time across all devices</p>
        </header>

        {error && (
          <div className="error-message">
            Error: {error}
          </div>
        )}

        <NoteForm onCreate={createNote} />

        {notes.length > 0 && (
          <div className="notes-info">
            <span className="notes-count">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
              {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
            </span>
          </div>
        )}

        <div className="notes-grid">
          {notes.length === 0 ? (
            <div className="empty-state">
              <p>No notes yet. Create your first note above!</p>
            </div>
          ) : (
            paginatedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onUpdate={updateNote}
                onDelete={deleteNote}
              />
            ))
          )}
        </div>

        {notes.length > 0 && totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </div>
  )
}

export default App

