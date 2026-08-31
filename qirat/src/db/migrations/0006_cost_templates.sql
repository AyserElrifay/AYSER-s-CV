-- What a service actually costs to deliver.
--
-- Until now `default_cost_min_minor` and `default_cost_max_minor` gave a range
-- and no reasoning, so the estimate on a deal card was a number somebody
-- remembered rather than a number somebody could defend. A template is the
-- build-up: the videographer, the kit, the editor, the catering.
--
-- This matters more than it looks. An estimate nobody can take apart is an
-- estimate nobody argues with, and an estimate nobody argues with is how a
-- margin quietly becomes fiction three deals before anyone notices.
alter table services
  add column if not exists cost_template jsonb not null default '[]'::jsonb;

-- Deliberately NOT added to the Member column grant. `task_template` is theirs;
-- what the work costs is not. New columns are excluded by default because the
-- Member grant names its columns explicitly — this comment exists so the next
-- person knows that was a decision rather than an oversight.
