-- Custom SQL migration file, put your code below! --

-- #185 (achados #10 e #11): team names reached the db exactly as typed, so
-- rows already stored may hold "Os Dragões " (a duplicate of "Os Dragões" that
-- teams_lower_name_idx never saw, because the index folds case but not
-- whitespace) or "   " (a team with no visible name at all). From this
-- migration on the service normalizes every write; this backfill cleans up
-- what the old code let through.
--
-- What it deliberately does NOT do, and why:
--
--   * it does not touch a row whose normalized name is already taken by
--     another active team. Those are the real duplicates, and resolving one
--     means choosing which team keeps the name and what the other is called —
--     a decision that belongs to the organizer, on the moderation screen, not
--     to a migration inventing a team name and storing the guess as a fact
--     (same reasoning as 0022).
--   * it does not name the blank teams either. No backfill can recover a name
--     that was never typed; the moderation screen labels them
--     "Time sem nome · <first 8 chars of the id>" so the organizer can still
--     tell two of them apart and rename them.
--   * it does not tighten teams_lower_name_idx onto the normalized
--     expression: that index would refuse to be created while any collision
--     above is unresolved, which is exactly the decision this migration is
--     declining to make on the organizer's behalf.
--
-- Removed teams (removed_at IS NOT NULL) are left alone: they are history, and
-- the partial index does not constrain them.
UPDATE teams AS t
SET
  name = btrim(regexp_replace(t.name, '\s+', ' ', 'g')),
  updated_at = now()
WHERE
  t.removed_at IS NULL
  AND t.name <> btrim(regexp_replace(t.name, '\s+', ' ', 'g'))
  AND btrim(regexp_replace(t.name, '\s+', ' ', 'g')) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM teams AS other
    WHERE
      other.id <> t.id
      AND other.removed_at IS NULL
      AND lower(other.name) = lower(btrim(regexp_replace(t.name, '\s+', ' ', 'g')))
  );

-- The two leftovers are expected outcomes, not failures — but they are the
-- rows an organizer has to fix by hand, so they have to be visible in the
-- migration log rather than silently left behind.
DO $$
DECLARE
  colliding bigint;
  nameless bigint;
BEGIN
  SELECT count(*) INTO colliding
  FROM teams AS t
  WHERE
    t.removed_at IS NULL
    AND t.name <> btrim(regexp_replace(t.name, '\s+', ' ', 'g'))
    AND btrim(regexp_replace(t.name, '\s+', ' ', 'g')) <> '';
  IF colliding > 0 THEN
    RAISE NOTICE
      'teams.name left un-normalized for % active team(s): the normalized name is already held by another active team, so an organizer has to rename one of them on the moderation screen',
      colliding;
  END IF;

  SELECT count(*) INTO nameless
  FROM teams AS t
  WHERE t.removed_at IS NULL AND btrim(regexp_replace(t.name, '\s+', ' ', 'g')) = '';
  IF nameless > 0 THEN
    RAISE NOTICE
      '% active team(s) have a blank name: no backfill can invent one, so the organizer moderation screen labels them by id until they are renamed',
      nameless;
  END IF;
END $$;
