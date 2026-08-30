-- Immutability: the two places where "you cannot change that" has to be a
-- property of the database rather than a habit of the code.

create or replace function unlost.reject_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log is append-only; % is not permitted', tg_op
    using errcode = 'insufficient_privilege',
          hint = 'Corrections are new entries, never edits to old ones.';
end $$;

-- Triggers, not just privileges. A privilege can be granted; a trigger fires for
-- the table owner too, so the log is immutable even to the role that built it.
drop trigger if exists audit_log_no_update on audit_log;
create trigger audit_log_no_update before update on audit_log
  for each row execute function unlost.reject_mutation();

drop trigger if exists audit_log_no_delete on audit_log;
create trigger audit_log_no_delete before delete on audit_log
  for each row execute function unlost.reject_mutation();

drop trigger if exists audit_log_no_truncate on audit_log;
create trigger audit_log_no_truncate before truncate on audit_log
  for each statement execute function unlost.reject_mutation();

-- --- freeze on close ---------------------------------------------------------

-- The single rule that separates a tool people trust with money from one they
-- abandon. When a deal closes, the terms it closed on stop moving. If the owner
-- changes the house rate in March, February's deals keep February's number,
-- because February's partners were already paid against it.
create or replace function unlost.protect_frozen_deal_terms() returns trigger
language plpgsql as $$
begin
  if old.status <> 'won' then
    return new;
  end if;

  if new.status <> 'won' then
    raise exception 'Deal % is closed and cannot be reopened', old.id
      using errcode = 'insufficient_privilege',
            hint = 'Renegotiation creates a new deal against the closed one.';
  end if;

  if new.currency              is distinct from old.currency
  or new.agreed_price_minor    is distinct from old.agreed_price_minor
  or new.closed_at             is distinct from old.closed_at
  or new.frozen_house_rate_bp  is distinct from old.frozen_house_rate_bp
  or new.frozen_fx_rate        is distinct from old.frozen_fx_rate
  or new.frozen_fx_captured_at is distinct from old.frozen_fx_captured_at
  or new.frozen_split_rules    is distinct from old.frozen_split_rules then
    raise exception 'Deal % closed on terms that are now frozen', old.id
      using errcode = 'insufficient_privilege',
            hint = 'Price, currency, FX rate and split rules are fixed at close. '
                   'Costs and delivery may still move.';
  end if;

  return new;
end $$;

drop trigger if exists deals_freeze_on_close on deals;
create trigger deals_freeze_on_close before update on deals
  for each row execute function unlost.protect_frozen_deal_terms();

-- --- updated_at --------------------------------------------------------------

create or replace function unlost.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists deals_touch on deals;
create trigger deals_touch before update on deals
  for each row execute function unlost.touch_updated_at();

drop trigger if exists brand_kits_touch on brand_kits;
create trigger brand_kits_touch before update on brand_kits
  for each row execute function unlost.touch_updated_at();
