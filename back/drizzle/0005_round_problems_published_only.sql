-- Custom SQL migration file, put your code below! --
CREATE FUNCTION round_problems_check_published() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM problems WHERE id = NEW.problem_id AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'problem % is not published', NEW.problem_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER round_problems_published_only
BEFORE INSERT OR UPDATE ON round_problems
FOR EACH ROW EXECUTE FUNCTION round_problems_check_published();
