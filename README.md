# Real-Time Notes App with Supabase

A simple, beautiful real-time note-taking application built with React, Vite, and Supabase.

## Features

- ✨ Create, edit, and delete notes
- 🔄 Real-time synchronization across all devices
- 🎨 Modern, responsive UI
- ⚡ Fast and lightweight

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to your project's SQL Editor and run this SQL to create the notes table:

```sql
-- Create notes table
CREATE TABLE notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security (optional, for public access)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (for demo purposes)
CREATE POLICY "Allow all operations" ON notes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable real-time for the notes table
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
```

3. Get your Supabase credentials:
   - Go to Project Settings > API
   - Copy your Project URL and anon/public key

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Project Structure

```
notes-app/
├── src/
│   ├── components/
│   │   ├── NoteCard.jsx      # Individual note card component
│   │   └── NoteForm.jsx      # Form for creating new notes
│   ├── hooks/
│   │   └── useNotes.js       # Custom hook for note operations
│   ├── lib/
│   │   └── supabase.js       # Supabase client configuration
│   ├── App.jsx               # Main app component
│   ├── App.css               # Styles
│   └── main.jsx              # Entry point
├── index.html
├── package.json
└── vite.config.js
```

## How Real-Time Works

The app uses Supabase's real-time subscriptions to listen for changes to the `notes` table. When any note is created, updated, or deleted, all connected clients automatically receive the update without needing to refresh the page.

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## License

MIT

