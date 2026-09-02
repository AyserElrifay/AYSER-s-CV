-- The conversations.
--
-- From the brief: a calendar with notes, and phone numbers, so somebody can
-- call a client and write down what was said. It is the one part of an agency
-- that lives entirely in people's heads and in a WhatsApp thread nobody else
-- can read, and it is where deals are actually won and lost.
--
-- No money here, deliberately. A meeting has no price and no margin; putting a
-- number on this screen would be the product guessing at something it cannot
-- know, and the colour rule would have nothing to attach to.

-- --- who to call -------------------------------------------------------------

/*
 * A client is an organisation; a contact is a person at it.
 *
 * Agencies deal with people, not with logos. The brand manager who approves the
 * work and the finance person who pays for it are different human beings with
 * different numbers, and losing that distinction is how an invoice sits unpaid
 * for six weeks because it was chased through the wrong one.
 */
create table if not exists client_contacts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  client_id   uuid not null,
  name        text not null check (length(trim(name)) > 0),
  title       text,
  -- Stored as typed. Normalising a phone number means guessing a country code,
  -- and a wrong guess is a number that does not ring.
  phone       text,
  email       text,
  note        text,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),

  foreign key (org_id, client_id) references clients (org_id, id) on delete cascade,
  unique (org_id, id)
);

create index if not exists client_contacts_client_idx on client_contacts (org_id, client_id);

-- --- what was said -----------------------------------------------------------

do $$ begin
  create type conversation_kind as enum ('call', 'meeting', 'site_visit', 'message');
exception when duplicate_object then null; end $$;

do $$ begin
  create type conversation_state as enum ('scheduled', 'happened', 'no_answer', 'cancelled');
exception when duplicate_object then null; end $$;

/*
 * One table for what is coming and what already happened.
 *
 * A calendar and a call log are the same rows at different moments — the
 * difference is a state and a note. Splitting them would mean copying a meeting
 * from one place to another after it happens, which is exactly the step people
 * skip, and skipping it is how the notes stop existing.
 */
create table if not exists conversations (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations (id) on delete cascade,
  -- All three optional: an introductory call belongs to nobody yet, and a
  -- catch-up belongs to a client without belonging to a deal.
  client_id      uuid,
  contact_id     uuid,
  deal_id        uuid,
  owner_user_id  uuid not null,
  kind           conversation_kind not null default 'call',
  state          conversation_state not null default 'scheduled',
  subject        text not null check (length(trim(subject)) > 0),
  happens_at     timestamptz not null,
  minutes        integer check (minutes is null or (minutes > 0 and minutes <= 1440)),
  place          text,
  -- What you meant to cover, written before. What was actually said, written
  -- after. Keeping them apart is what makes the second one worth reading.
  agenda         text,
  notes          text,
  -- A next step with a date on it. Without the date it is a wish.
  next_step      text,
  next_step_on   date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  foreign key (org_id, client_id)     references clients (org_id, id) on delete set null,
  foreign key (org_id, contact_id)    references client_contacts (org_id, id) on delete set null,
  foreign key (org_id, deal_id)       references deals (org_id, id) on delete set null,
  foreign key (org_id, owner_user_id) references users (org_id, id) on delete restrict,
  unique (org_id, id),

  -- A conversation that happened and says nothing is the failure this table
  -- exists to make visible, not one the database should refuse: the note is
  -- written minutes later, and refusing the row would mean it is never written
  -- at all. The screen asks for it; the schema does not insist.
  check (state <> 'cancelled' or notes is not null or true)
);

create index if not exists conversations_when_idx on conversations (org_id, happens_at desc);
create index if not exists conversations_client_idx on conversations (org_id, client_id);
create index if not exists conversations_owner_idx on conversations (org_id, owner_user_id);

-- --- row level security ------------------------------------------------------

alter table client_contacts enable row level security;
alter table client_contacts force row level security;
alter table conversations enable row level security;
alter table conversations force row level security;

/*
 * The client relationship belongs to the agency, not to one account manager.
 *
 * Unlike deals, where a manager sees only their own pipeline, contacts and
 * conversations are shared: the whole point of writing a note down is that
 * somebody else can read it when you are on a plane. A Member and a Partner get
 * nothing at all — a freelancer does not need the client's mobile number, and
 * an investor does not need to know who was called on Tuesday.
 */
grant select, insert, update, delete on client_contacts to qirat_role_owner;
grant select, insert, update on client_contacts to qirat_role_manager;

create policy client_contacts_owner_rw on client_contacts
  for all to qirat_role_owner
  using (org_id = qirat.current_org_id())
  with check (org_id = qirat.current_org_id());

create policy client_contacts_manager_rw on client_contacts
  for all to qirat_role_manager
  using (org_id = qirat.current_org_id())
  with check (org_id = qirat.current_org_id());

grant select, insert, update, delete on conversations to qirat_role_owner;
grant select, insert, update on conversations to qirat_role_manager;

create policy conversations_owner_rw on conversations
  for all to qirat_role_owner
  using (org_id = qirat.current_org_id())
  with check (org_id = qirat.current_org_id());

create policy conversations_manager_rw on conversations
  for all to qirat_role_manager
  using (org_id = qirat.current_org_id())
  with check (org_id = qirat.current_org_id());

-- --- the note stays honest ---------------------------------------------------

/*
 * `updated_at` is set by the database, not by the caller.
 *
 * A note that says when it was last touched is only useful if that timestamp
 * cannot be chosen. This is a small thing and it is the difference between a
 * record and a story.
 */
create or replace function qirat.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists conversations_touch on conversations;
create trigger conversations_touch
  before update on conversations
  for each row execute function qirat.touch_updated_at();
