-- Recover domains created before per-user scoping (user_id was NULL)
-- Safe to run in Supabase SQL Editor

-- 1) See orphaned domains (still in DB, just not linked to any account)
SELECT id, domain, display_name, page_count, created_at
FROM domains
WHERE user_id IS NULL
ORDER BY created_at;

-- 2) Assign ALL orphaned domains to one account (replace email)
UPDATE domains d
SET user_id = u.id
FROM auth.users u
WHERE d.user_id IS NULL
  AND u.email = 'sandeep.5112004@gmail.com';

-- 3) Verify
SELECT d.id, d.domain, d.display_name, u.email AS owner
FROM domains d
LEFT JOIN auth.users u ON u.id = d.user_id
ORDER BY d.created_at;
