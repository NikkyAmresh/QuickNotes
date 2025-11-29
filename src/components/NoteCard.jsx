import { useState } from 'react'

export function NoteCard({ note, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)

  const handleSave = async () => {
    const { error } = await onUpdate(note.id, title, content)
    if (!error) {
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setTitle(note.title)
    setContent(note.content)
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      await onDelete(note.id)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  if (isEditing) {
    return (
      <div className="note-card editing">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title"
          className="note-title-input"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Note content"
          className="note-content-input"
          rows="5"
        />
        <div className="note-actions">
          <button onClick={handleSave} className="btn btn-primary">
            Save
          </button>
          <button onClick={handleCancel} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const truncateContent = (text, maxLength = 200) => {
    if (!text) return 'No content'
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  const [isExpanded, setIsExpanded] = useState(false)
  const shouldTruncate = note.content && note.content.length > 200
  const displayContent = isExpanded || !shouldTruncate 
    ? (note.content || 'No content')
    : truncateContent(note.content)

  return (
    <div className="note-card">
      <div className="note-header">
        <h3 className="note-title" title={note.title || 'Untitled'}>
          {note.title || 'Untitled'}
        </h3>
        <div className="note-meta">
          <span className="note-date" title={formatDate(note.created_at)}>
            {new Date(note.created_at).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            })}
          </span>
        </div>
      </div>
      <div className="note-content-wrapper">
        <p className="note-content">{displayContent}</p>
        {shouldTruncate && (
          <button 
            className="expand-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
      <div className="note-actions">
        <button 
          onClick={() => setIsEditing(true)} 
          className="btn btn-secondary"
          aria-label="Edit note"
        >
          ✏️ Edit
        </button>
        <button 
          onClick={handleDelete} 
          className="btn btn-danger"
          aria-label="Delete note"
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  )
}


