import { useState } from 'react'

export function NoteForm({ onCreate }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() && !content.trim()) return

    const { error } = await onCreate(title.trim(), content.trim())
    if (!error) {
      setTitle('')
      setContent('')
      setIsExpanded(false)
    }
  }

  if (!isExpanded) {
    return (
      <div className="note-form-collapsed">
        <input
          type="text"
          placeholder="Take a note..."
          onClick={() => setIsExpanded(true)}
          className="note-form-trigger"
        />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="note-form">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="note-title-input"
        autoFocus
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Take a note..."
        className="note-content-input"
        rows="5"
      />
      <div className="note-form-actions">
        <button type="submit" className="btn btn-primary">
          Add Note
        </button>
        <button
          type="button"
          onClick={() => {
            setIsExpanded(false)
            setTitle('')
            setContent('')
          }}
          className="btn btn-secondary"
        >
          Close
        </button>
      </div>
    </form>
  )
}

