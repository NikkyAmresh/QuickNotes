-- Real-Time Notes App - Supabase Setup SQL
-- Run this in your Supabase SQL Editor

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists, then create a policy that allows all operations (for demo purposes)
-- In production, you should implement proper authentication and authorization
DROP POLICY IF EXISTS "Allow all operations" ON notes;
CREATE POLICY "Allow all operations" ON notes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable real-time for the notes table
ALTER PUBLICATION supabase_realtime ADD TABLE notes;

-- Create an index on created_at for better query performance
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);

-- Create universal_lockout table for server-side lockout management
-- This is a single-row table that applies to all users universally
CREATE TABLE IF NOT EXISTS universal_lockout (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Only one row allowed
  failed_attempts INTEGER DEFAULT 0,
  lockout_until TIMESTAMP WITH TIME ZONE,
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE universal_lockout ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists, then create a policy that allows all operations (for demo purposes)
DROP POLICY IF EXISTS "Allow all operations on universal_lockout" ON universal_lockout;
CREATE POLICY "Allow all operations on universal_lockout" ON universal_lockout
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create an index on lockout_until for checking active lockouts
CREATE INDEX IF NOT EXISTS idx_universal_lockout_lockout ON universal_lockout(lockout_until) WHERE lockout_until IS NOT NULL;

-- Insert the single row if it doesn't exist
INSERT INTO universal_lockout (id, failed_attempts) 
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- Create app_password table for server-side password storage
CREATE TABLE IF NOT EXISTS app_password (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Only one row allowed
  password_sequence INTEGER[] NOT NULL, -- Array of image IDs representing the password
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE app_password ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists, then create a policy that allows all operations (for demo purposes)
DROP POLICY IF EXISTS "Allow all operations on app_password" ON app_password;
CREATE POLICY "Allow all operations on app_password" ON app_password
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create active_session table for server-side authentication
CREATE TABLE IF NOT EXISTS active_session (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE active_session ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists, then create a policy that allows all operations (for demo purposes)
DROP POLICY IF EXISTS "Allow all operations on active_session" ON active_session;
CREATE POLICY "Allow all operations on active_session" ON active_session
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create an index on session_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_active_session_token ON active_session(session_token);
CREATE INDEX IF NOT EXISTS idx_active_session_expires ON active_session(expires_at);

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM active_session WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

