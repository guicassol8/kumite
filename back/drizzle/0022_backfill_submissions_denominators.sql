-- Custom SQL migration file, put your code below! --

-- #193: submissions.max_score / hidden_case_count were just added (0021).
-- Unlike accepted_at (0019) there is NO follow-up migration setting them NOT
-- NULL, and that is deliberate. The denominator a legacy score was prorated
-- over is recorded nowhere: not in submissions, not in problems (which keeps no
-- history of its test cases), not in any log. Writing the current numbers onto
-- every old row would store a guess as a fact — the very defect this issue
-- exists to remove. So this backfill stamps only the rows that still have a
-- witness, and leaves the rest NULL, meaning "judged before the stamp existed".
--
-- The witness is the length of case_results. toPersistedCaseResults writes one
-- entry per test case, visible and hidden alike (runJudge runs over the whole
-- list), so jsonb_array_length(case_results) is the number of test cases the
-- problem had at judging time — the only trace of that set left in the db.
--
--   * same length as the problem's current test_cases (and > 0)
--     => the set is the same size as it was; that is evidence, not proof, that
--        it did not change, and the problem's current points and hidden-case
--        count are then the best-supported values available. Same quality of
--        reasoning 0019 accepted for accepted_at.
--   * different length
--     => it is PROVEN that the problem was edited after that submission was
--        judged, and the true denominator is unrecoverable. Stays NULL.
--
-- Known limit, stated rather than hidden: flipping a case's `hidden` flag, or
-- swapping one case for another, without changing the length would pass for
-- "unchanged" here. What matters is that this never invents a value for a row
-- that is demonstrably affected — which is the case the issue reports.
UPDATE submissions AS s
SET
  max_score = p.points,
  hidden_case_count = (
    SELECT count(*)
    FROM jsonb_array_elements(p.test_cases) AS tc
    WHERE tc ->> 'hidden' = 'true'
  )
FROM problems AS p
WHERE
  p.id = s.problem_id
  AND s.max_score IS NULL
  AND s.hidden_case_count IS NULL
  AND jsonb_array_length(s.case_results) > 0
  AND jsonb_array_length(s.case_results) = jsonb_array_length(p.test_cases);

-- Where 0019 raised an exception on a leftover null, here a leftover null is
-- the expected outcome, not a failure. It still has to be visible in the
-- migration log: these are the rows whose score can no longer be placed on any
-- scale, and the ranking reports the round they belong to as `unknown` or
-- `inconsistent` rather than pretending otherwise.
DO $$
DECLARE
  unstamped bigint;
BEGIN
  SELECT count(*) INTO unstamped FROM submissions WHERE max_score IS NULL;
  IF unstamped > 0 THEN
    RAISE NOTICE
      'submissions.max_score/hidden_case_count left NULL for % submission(s): judged before the stamp existed and the denominator of that moment is not recoverable',
      unstamped;
  END IF;
END $$;
