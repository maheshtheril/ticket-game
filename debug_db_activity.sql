-- RUN THIS IN SUPABASE SQL EDITOR TO SEE WHAT IS HAPPENING LIVE

-- 1. View Currently executing queries (Live "What is running now?")
SELECT 
    pid, 
    usename, 
    client_addr, 
    state, 
    query, 
    now() - query_start as duration 
FROM pg_stat_activity 
WHERE state != 'idle' 
AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;

-- 2. View Table Sizes (Did data actually get inserted?)
SELECT 
    schemaname as schema, 
    relname as table, 
    n_live_tup as row_count 
FROM pg_stat_user_tables 
ORDER BY n_live_tup DESC;

-- 3. Check for specific recent locks (Is something stuck?)
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
