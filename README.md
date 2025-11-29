# Real-Time Notes App with Supabase

A secure, feature-rich real-time note-taking application built with React, Vite, Supabase, and deployed on Firebase Hosting.

## 🌟 Features

### Core Features
- ✨ **Create, Edit, and Delete Notes** - Full CRUD operations for your notes
- 🔄 **Real-Time Synchronization** - Notes sync instantly across all devices using Supabase real-time subscriptions
- 📄 **Pagination** - Efficiently browse through notes with 12 notes per page
- 🎨 **Modern, Responsive UI** - Beautiful design that works on all devices
- ⚡ **Fast and Lightweight** - Built with Vite for optimal performance

### Security Features
- 🔐 **Picture Password Authentication** - Unique image-based password system (3-5 images in sequence)
- 🛡️ **Server-Side Authentication** - All authentication validated on the server (cannot be bypassed)
- 🔒 **Session Management** - Secure server-side sessions with 24-hour expiration
- 🚫 **Universal Lockout System** - After 3 failed login attempts, account is locked for 1 hour
- 💾 **Server-Side Password Storage** - Passwords stored securely in Supabase database

### User Experience
- 📝 **Content Truncation** - Long notes are truncated with "Show more/less" functionality
- 🎯 **Smart Card Layout** - Consistent card heights with scrollable content areas
- 📊 **Notes Counter** - Display total notes count and current page information
- 🎨 **Custom Scrollbars** - Beautiful custom scrollbars for long content
- 📱 **Fully Responsive** - Optimized for desktop, tablet, and mobile devices
- ⏰ **Date Formatting** - Clean, readable date display

### Deployment
- 🚀 **Firebase Hosting** - Deployed and hosted on Firebase
- 🌐 **Live URL** - Accessible at [ue5-notes.web.app](https://ue5-notes.web.app)

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- A Supabase account
- A Firebase account (for deployment)

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to your project's SQL Editor and run the SQL from `supabase-setup.sql`
   - This creates all necessary tables: `notes`, `app_password`, `universal_lockout`, and `active_session`
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

## 📁 Project Structure

```
notes-app/
├── src/
│   ├── components/
│   │   ├── NoteCard.jsx           # Individual note card with edit/delete
│   │   ├── NoteForm.jsx            # Form for creating new notes
│   │   ├── Pagination.jsx          # Pagination component
│   │   └── PicturePasswordAuth.jsx # Picture password authentication
│   ├── hooks/
│   │   ├── useAuth.js              # Server-side authentication hook
│   │   ├── useLockout.js           # Universal lockout management
│   │   ├── useNotes.js             # Notes CRUD operations with real-time
│   │   └── usePassword.js          # Password management (server-side)
│   ├── lib/
│   │   └── supabase.js             # Supabase client configuration
│   ├── App.jsx                     # Main app component
│   ├── App.css                     # Application styles
│   └── main.jsx                    # Entry point
├── supabase-setup.sql              # Complete database setup script
├── firebase.json                   # Firebase hosting configuration
├── .firebaserc                     # Firebase project configuration
├── index.html
├── package.json
└── vite.config.js
```

## 🔐 Security Architecture

### Authentication Flow
1. **First Time Setup**: User creates a picture password by selecting 3-5 images in sequence
2. **Password Storage**: Password sequence stored in Supabase `app_password` table
3. **Login**: User enters the same image sequence to authenticate
4. **Session Creation**: On successful login, a secure session token is created and stored server-side
5. **Session Validation**: Every request validates the session against the server

### Lockout System
- **Failed Attempts Tracking**: Stored in `universal_lockout` table
- **Lockout Trigger**: After 3 failed attempts
- **Lockout Duration**: 1 hour (configurable)
- **Universal Lock**: Applies to all users (single lockout state)
- **Auto-Unlock**: Automatically unlocks after the lockout period expires

### Server-Side Validation
- All authentication checks happen on the server
- Client-side storage (localStorage) only stores session tokens
- Session tokens are validated against Supabase on every request
- Cannot be bypassed by manipulating client-side storage

## 🔄 Real-Time Features

The app uses Supabase's real-time subscriptions to listen for changes to the `notes` table. When any note is:
- **Created**: Appears instantly on all connected devices
- **Updated**: Changes sync immediately
- **Deleted**: Removed from all devices in real-time

No page refresh required!

## 📄 Pagination

- **Notes Per Page**: 12 notes displayed per page
- **Smart Navigation**: Shows page numbers with ellipsis for large page counts
- **Previous/Next**: Easy navigation between pages
- **Page Info**: Displays current page and total pages

## 🎨 User Interface

### Note Cards
- **Consistent Height**: All cards have uniform height with max-height constraints
- **Content Truncation**: Long notes truncated at 200 characters with expand/collapse
- **Scrollable Content**: Custom scrollbars for notes exceeding max height
- **Hover Effects**: Smooth animations on hover
- **Action Buttons**: Edit and Delete buttons with icons

### Responsive Design
- **Desktop**: Multi-column grid layout (3+ columns)
- **Tablet**: 2-column layout
- **Mobile**: Single column layout
- **Touch-Friendly**: Large tap targets for mobile devices

## 🚀 Deployment

### Firebase Hosting

The app is configured for Firebase Hosting with project ID: `matlab3728323` and site: `ue5-notes`

#### Build for Production

```bash
npm run build
```

#### Deploy to Firebase

```bash
npm run deploy
```

Or manually:
```bash
firebase deploy --only hosting:ue5-notes
```

#### Live URL
https://ue5-notes.web.app

See `FIREBASE_SETUP.md` for detailed Firebase setup instructions.

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run deploy` - Build and deploy to Firebase
- `npm run firebase:serve` - Test Firebase hosting locally

## 📊 Database Schema

### Tables

1. **notes** - Stores all notes
   - `id` (UUID, Primary Key)
   - `title` (TEXT)
   - `content` (TEXT)
   - `created_at` (TIMESTAMP)
   - `updated_at` (TIMESTAMP)

2. **app_password** - Stores picture password sequence
   - `id` (INTEGER, Primary Key, always 1)
   - `password_sequence` (INTEGER[])
   - `created_at` (TIMESTAMP)
   - `updated_at` (TIMESTAMP)

3. **universal_lockout** - Manages lockout state
   - `id` (INTEGER, Primary Key, always 1)
   - `failed_attempts` (INTEGER)
   - `lockout_until` (TIMESTAMP)
   - `last_attempt_at` (TIMESTAMP)

4. **active_session** - Manages active sessions
   - `id` (UUID, Primary Key)
   - `session_token` (TEXT, Unique)
   - `expires_at` (TIMESTAMP)
   - `created_at` (TIMESTAMP)

## 🔧 Configuration

### Environment Variables
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key

### Constants
- `NOTES_PER_PAGE` - Number of notes per page (default: 12)
- `MAX_ATTEMPTS` - Maximum failed login attempts (default: 3)
- `LOCKOUT_DURATION_MS` - Lockout duration in milliseconds (default: 1 hour)
- `SESSION_DURATION_MS` - Session expiration time (default: 24 hours)

## 🐛 Troubleshooting

### Notes Not Appearing
- Check browser console for errors
- Verify Supabase connection in `.env` file
- Ensure session is valid (check `active_session` table)

### Authentication Issues
- Clear browser localStorage and try again
- Check if account is locked (see `universal_lockout` table)
- Verify password exists in `app_password` table

### Real-Time Not Working
- Ensure real-time is enabled in Supabase
- Check Supabase dashboard for connection status
- Verify RLS policies allow operations

## 📝 License

MIT

## 🙏 Acknowledgments

- Built with [React](https://react.dev/)
- Powered by [Supabase](https://supabase.com/)
- Hosted on [Firebase](https://firebase.google.com/)
- Bundled with [Vite](https://vitejs.dev/)
