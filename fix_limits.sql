-- 1. Deduplicate user_limits (Keep most recent)
DELETE FROM user_limits
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC NULLS LAST) as row_num
        FROM user_limits
    ) t
    WHERE t.row_num > 1
);

-- 2. Add Unique Constraint (Safe to run even if already exists, ideally, but basic SQL will fail if exists)
-- We wrap in a block or just run it. 
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_limits_user_id_key') THEN
        ALTER TABLE user_limits ADD CONSTRAINT user_limits_user_id_key UNIQUE (user_id);
    END IF;
END
$$;
