-- Custom SQL migration file, put your code below! --

-- #176: submissions.round_id was just added (0015) and every existing row has
-- to get one before it can be NOT NULL (0017). Until now the round was derived
-- from time (created_at inside [opened_at, closed_at]) — so the backfill first
-- reproduces that very rule, then rescues the rows the rule itself lost.

-- 1. Primary match: the rule as it stood. A round that contains the problem
--    and whose window covers the submission's created_at. rounds_single_open_idx
--    guarantees windows never overlap, so this matches at most one round.
UPDATE submissions AS s
SET round_id = r.id
FROM rounds AS r
JOIN round_problems AS rp ON rp.round_id = r.id
WHERE rp.problem_id = s.problem_id
  AND r.status <> 'draft'
  AND r.opened_at IS NOT NULL
  AND s.created_at >= r.opened_at
  AND s.created_at <= COALESCE(r.closed_at, now())
  AND s.round_id IS NULL;

-- 2. Fallback: the victims of the bug this migration exists for — accepted
--    inside a round, but written after it closed, so their created_at falls
--    past closed_at and step 1 left them unmatched. They belong to the most
--    recently opened round that contains the problem and had already opened
--    by then.
--    (A correlated subquery in SET, not a LATERAL join: an UPDATE ... FROM
--    cannot reference its own target table from the FROM clause.)
UPDATE submissions AS s
SET round_id = (
  SELECT r.id
  FROM rounds AS r
  JOIN round_problems AS rp ON rp.round_id = r.id
  WHERE rp.problem_id = s.problem_id
    AND r.status <> 'draft'
    AND r.opened_at IS NOT NULL
    AND r.opened_at <= s.created_at
  ORDER BY r.opened_at DESC
  LIMIT 1
)
WHERE s.round_id IS NULL;

-- 3. Guard: 0017 sets NOT NULL. Failing here, with the count, beats failing
--    there with a bare constraint violation and no idea which rows are left.
DO $$
DECLARE
  orphans bigint;
BEGIN
  SELECT count(*) INTO orphans FROM submissions WHERE round_id IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'cannot backfill submissions.round_id: % submission(s) match no round; resolve them by hand before migrating',
      orphans;
  END IF;
END $$;
