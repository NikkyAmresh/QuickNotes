-- Real-Time Notes App - Supabase Setup SQL
-- Migration: Initial database setup with security functions

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

-- Function to check if a session token is valid
CREATE OR REPLACE FUNCTION is_valid_session_token(token TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  session_record RECORD;
BEGIN
  SELECT * INTO session_record
  FROM active_session
  WHERE session_token = token
    AND expires_at > NOW();
  
  RETURN session_record IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get session token from request (via custom header or parameter)
-- This function tries to get the session token from various sources
CREATE OR REPLACE FUNCTION get_request_session_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
BEGIN
  -- Try to get from custom header (if Supabase supports it)
  -- Note: This may not work in all Supabase configurations
  BEGIN
    token := current_setting('request.headers', true)::json->>'x-session-token';
  EXCEPTION WHEN OTHERS THEN
    token := NULL;
  END;
  
  -- If not found in headers, return NULL (will be handled by application layer)
  RETURN token;
END;
$$ LANGUAGE plpgsql;

-- Drop old policy - we'll use function-based access instead
DROP POLICY IF EXISTS "Allow all operations" ON notes;
DROP POLICY IF EXISTS "Require valid session for notes" ON notes;

-- Deny all direct access to notes table (only allow via functions)
CREATE POLICY "Deny all direct access" ON notes
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Function to get notes (requires valid session token)
CREATE OR REPLACE FUNCTION get_notes(session_token_param TEXT)
RETURNS TABLE(
  id UUID,
  title TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- Validate session
  IF NOT EXISTS (
    SELECT 1 FROM active_session 
    WHERE session_token = session_token_param 
      AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;
  
  -- Return notes
  RETURN QUERY
  SELECT n.id, n.title, n.content, n.created_at, n.updated_at
  FROM notes n
  ORDER BY n.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create note (requires valid session token)
CREATE OR REPLACE FUNCTION create_note(
  session_token_param TEXT,
  note_title TEXT,
  note_content TEXT
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  new_note_id UUID;
BEGIN
  -- Validate session
  IF NOT EXISTS (
    SELECT 1 FROM active_session 
    WHERE session_token = session_token_param 
      AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;
  
  -- Insert note (bypass RLS using SECURITY DEFINER)
  INSERT INTO notes (title, content)
  VALUES (note_title, note_content)
  RETURNING notes.id INTO new_note_id;
  
  -- Return created note
  RETURN QUERY
  SELECT n.id, n.title, n.content, n.created_at, n.updated_at
  FROM notes n
  WHERE n.id = new_note_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update note (requires valid session token)
CREATE OR REPLACE FUNCTION update_note(
  session_token_param TEXT,
  note_id UUID,
  note_title TEXT,
  note_content TEXT
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- Validate session
  IF NOT EXISTS (
    SELECT 1 FROM active_session 
    WHERE session_token = session_token_param 
      AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;
  
  -- Update note (bypass RLS using SECURITY DEFINER)
  UPDATE notes
  SET 
    title = note_title,
    content = note_content,
    updated_at = NOW()
  WHERE id = note_id;
  
  -- Return updated note
  RETURN QUERY
  SELECT n.id, n.title, n.content, n.created_at, n.updated_at
  FROM notes n
  WHERE n.id = note_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete note (requires valid session token)
CREATE OR REPLACE FUNCTION delete_note(
  session_token_param TEXT,
  note_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Validate session
  IF NOT EXISTS (
    SELECT 1 FROM active_session 
    WHERE session_token = session_token_param 
      AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;
  
  -- Delete note (bypass RLS using SECURITY DEFINER)
  DELETE FROM notes WHERE id = note_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_notes(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_note(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_note(TEXT, UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_note(TEXT, UUID) TO anon, authenticated;

-- Enable real-time for the notes table (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notes;
  END IF;
END $$;

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

-- Server-side function to record failed login attempt and handle lockout
CREATE OR REPLACE FUNCTION record_failed_attempt()
RETURNS TABLE(
  failed_attempts INTEGER,
  is_locked BOOLEAN,
  lockout_until TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  current_record RECORD;
  new_attempts INTEGER;
  should_lock BOOLEAN;
  lockout_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get current lockout state
  SELECT * INTO current_record
  FROM universal_lockout
  WHERE id = 1;

  -- Check if already locked and lockout hasn't expired
  IF current_record.lockout_until IS NOT NULL AND current_record.lockout_until > NOW() THEN
    -- Already locked, return current state
    RETURN QUERY SELECT 
      current_record.failed_attempts,
      TRUE,
      current_record.lockout_until;
    RETURN;
  END IF;

  -- Calculate new attempt count
  new_attempts := COALESCE(current_record.failed_attempts, 0) + 1;
  should_lock := new_attempts >= 3; -- MAX_ATTEMPTS = 3
  
  -- Set lockout time if needed (1 hour from now)
  IF should_lock THEN
    lockout_time := NOW() + INTERVAL '1 hour';
  ELSE
    lockout_time := NULL;
  END IF;

  -- Update or insert lockout record
  IF current_record IS NULL THEN
    INSERT INTO universal_lockout (id, failed_attempts, lockout_until, last_attempt_at, updated_at)
    VALUES (1, new_attempts, lockout_time, NOW(), NOW());
  ELSE
    UPDATE universal_lockout
    SET 
      failed_attempts = new_attempts,
      lockout_until = lockout_time,
      last_attempt_at = NOW(),
      updated_at = NOW()
    WHERE id = 1;
  END IF;

  -- Return the result
  RETURN QUERY SELECT 
    new_attempts,
    should_lock,
    lockout_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION record_failed_attempt() TO anon, authenticated;

-- Server-side function to check if account is locked
CREATE OR REPLACE FUNCTION check_lockout_status()
RETURNS TABLE(
  is_locked BOOLEAN,
  lockout_until TIMESTAMP WITH TIME ZONE,
  failed_attempts INTEGER
) AS $$
DECLARE
  lockout_record RECORD;
BEGIN
  SELECT * INTO lockout_record
  FROM universal_lockout
  WHERE id = 1;

  IF lockout_record IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMP WITH TIME ZONE, 0;
    RETURN;
  END IF;

  -- Check if lockout has expired
  IF lockout_record.lockout_until IS NOT NULL AND lockout_record.lockout_until > NOW() THEN
    -- Still locked
    RETURN QUERY SELECT 
      TRUE,
      lockout_record.lockout_until,
      lockout_record.failed_attempts;
  ELSE
    -- Not locked or expired
    RETURN QUERY SELECT 
      FALSE,
      NULL::TIMESTAMP WITH TIME ZONE,
      COALESCE(lockout_record.failed_attempts, 0);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_lockout_status() TO anon, authenticated;

-- Server-side function to validate password with lockout check
CREATE OR REPLACE FUNCTION validate_password_with_lockout(sequence INTEGER[])
RETURNS TABLE(
  is_valid BOOLEAN,
  is_locked BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  lockout_record RECORD;
  password_record RECORD;
BEGIN
  -- First check lockout status
  SELECT * INTO lockout_record
  FROM universal_lockout
  WHERE id = 1;

  IF lockout_record IS NOT NULL AND lockout_record.lockout_until IS NOT NULL AND lockout_record.lockout_until > NOW() THEN
    -- Account is locked
    RETURN QUERY SELECT FALSE, TRUE, 'Account is locked. Please wait.'::TEXT;
    RETURN;
  END IF;

  -- Get password
  SELECT * INTO password_record
  FROM app_password
  WHERE id = 1;

  IF password_record IS NULL OR password_record.password_sequence IS NULL OR array_length(password_record.password_sequence, 1) IS NULL THEN
    RETURN QUERY SELECT FALSE, FALSE, 'Password not set'::TEXT;
    RETURN;
  END IF;

  -- Compare sequences
  IF password_record.password_sequence = sequence THEN
    RETURN QUERY SELECT TRUE, FALSE, NULL::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, FALSE, 'Invalid password'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION validate_password_with_lockout(INTEGER[]) TO anon, authenticated;

