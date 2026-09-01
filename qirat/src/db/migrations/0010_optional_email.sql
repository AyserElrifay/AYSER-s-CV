-- An email address stops being a condition of existing.
--
-- The brief settled this early: notifications go over WhatsApp, because email is
-- where work goes to be ignored in this market. A schema that still refuses to
-- record a person without an address is arguing with that decision.
--
-- A username is now the way in and a phone number is now the way to reach
-- somebody, so the address is what it should always have been: useful when it
-- is there, not required. The existing unique (org_id, email) keeps holding —
-- Postgres does not consider two NULLs equal, so any number of people can have
-- no address while no two can share one.
alter table users alter column email drop not null;

/*
 * A person must be reachable somehow.
 *
 * Not "must have an email", but "must have a way in and a way to be found": a
 * username or an address. Without one of the two the row is an account nobody
 * can sign into and nobody can contact, which is not a person — it is a
 * mistake that will be discovered a month later by whoever is owed money.
 */
alter table users
  add constraint users_reachable check (username is not null or email is not null) not valid;
alter table users validate constraint users_reachable;
