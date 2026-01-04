-- MIGRATION: ADD 'bill_number' column to 'tickets' table
-- This is technically redundant if we use 'id', but requested by user for explicit Bill Number tracking.

-- 1. Add the column
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS bill_number BIGINT;

-- 2. (Optional) If we want a separate sequence that resets or behaves differently than ID
-- CREATE SEQUENCE bill_seq;
-- ALTER TABLE tickets ALTER COLUMN bill_number SET DEFAULT nextval('bill_seq');
