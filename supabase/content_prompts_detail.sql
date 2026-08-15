-- ============================================================
-- Content prompts — the longer in-Studio elaboration
-- ============================================================
-- Additive and safe to re-run.
--
-- `brief` is the short line a member reads on a card, on the dashboard or in
-- the planner. `detail` is the fuller version they get once they are on the
-- canvas and actually making the thing.
--
-- It is the static equivalent of what `say` and `cover` already do for a Reel:
-- a Reel prompt has two jobs to explain, and a post or carousel has one that
-- deserves more than a single line. So `detail` is offered when `is_video` is
-- false, and `say`/`cover` when it is true — never both, or the panel turns
-- into a wall nobody reads.
-- ============================================================

alter table public.content_prompts
  add column if not exists detail text;
