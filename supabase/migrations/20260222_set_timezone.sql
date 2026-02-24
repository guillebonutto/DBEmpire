-- Set the database timezone to Argentina (UTC-3)
-- This ensures that FUNCTIONS like NOW() and dashboard displays default to local time.
ALTER DATABASE postgres SET timezone TO 'America/Argentina/Buenos_Aires';
