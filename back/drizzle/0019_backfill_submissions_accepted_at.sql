-- Custom SQL migration file, put your code below! --

-- #238: submissions.accepted_at was just added (0018) and every existing row
-- has to get one before it can be NOT NULL (0020). Unlike round_id's backfill
-- (0016), there's no ambiguous-match logic here: accepted_at only exists to
-- separate "when it was accepted" from "when the row was written," and for
-- rows written before this column existed those two moments were the same
-- thing as far as we can tell — created_at is the best available guess.
UPDATE submissions SET accepted_at = created_at WHERE accepted_at IS NULL;

-- Guard: 0020 sets NOT NULL. Failing here, with the count, beats failing
-- there with a bare constraint violation and no idea which rows are left.
DO $$
DECLARE
  orphans bigint;
BEGIN
  SELECT count(*) INTO orphans FROM submissions WHERE accepted_at IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'cannot backfill submissions.accepted_at: % submission(s) still null; resolve them by hand before migrating',
      orphans;
  END IF;
END $$;
