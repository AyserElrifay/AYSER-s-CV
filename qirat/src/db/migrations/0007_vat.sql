-- Value added tax, and the currencies of the market this is being sold into.
--
-- A margin computed on gross amounts is wrong, and it is wrong in whichever
-- direction the agency's VAT position happens to run. Modelling the treatment
-- is what lets `margin` mean the same thing in Berlin as it does in Cairo.

-- New values cannot be used in the same transaction that adds them, and nothing
-- here does. European currencies first, then the ones the MENA market needs.
alter type currency_code add value if not exists 'CHF';
alter type currency_code add value if not exists 'SEK';
alter type currency_code add value if not exists 'NOK';
alter type currency_code add value if not exists 'DKK';
alter type currency_code add value if not exists 'PLN';
alter type currency_code add value if not exists 'CZK';
alter type currency_code add value if not exists 'HUF';
alter type currency_code add value if not exists 'RON';
alter type currency_code add value if not exists 'TRY';
alter type currency_code add value if not exists 'MAD';

do $$ begin
  create type tax_treatment as enum (
    'standard',
    'reverse_charge',
    'zero_rated',
    'exempt',
    'not_registered'
  );
exception when duplicate_object then null; end $$;

-- --- the agency's own position -----------------------------------------------

alter table organizations
  add column if not exists country char(2),
  -- Whether input VAT can be reclaimed. This single boolean decides whether a
  -- supplier's tax is a cost or a loan, and therefore what every margin says.
  add column if not exists vat_registered boolean not null default false,
  add column if not exists vat_rate_bp integer not null default 0
    check (vat_rate_bp between 0 and 10000),
  add column if not exists default_tax_treatment tax_treatment not null default 'not_registered';

-- --- per deal, frozen at close -----------------------------------------------

alter table deals
  add column if not exists tax_treatment tax_treatment not null default 'not_registered',
  add column if not exists vat_rate_bp integer not null default 0
    check (vat_rate_bp between 0 and 10000);

/*
 * The rate is frozen with the rest of the terms.
 *
 * VAT rates change by legislation, sometimes at a few weeks' notice. A deal
 * invoiced at 19% must keep saying 19% after the rate moves, or every historical
 * invoice in the system silently disagrees with the paper one the client has.
 */
alter table deals
  add column if not exists frozen_vat_rate_bp integer
    check (frozen_vat_rate_bp between 0 and 10000),
  add column if not exists frozen_tax_treatment tax_treatment;

-- --- per cost ------------------------------------------------------------------

/*
 * `amount_minor` is what the cost actually cost, and `vat_minor` is what comes
 * back from the tax authority.
 *
 * For a VAT-registered agency the tax is reclaimed, so the net is the cost and
 * the tax is recorded beside it. For an agency that cannot reclaim, the tax is
 * real money it will never see again, so the whole invoice is the cost and this
 * column stays zero.
 *
 * The decision is made once, when the cost is entered, and stored — never
 * re-derived from the organisation's row at read time. An agency that
 * deregisters next year must not retroactively change what last year's deals
 * cost, for the same reason a closed deal keeps the house rate it closed on.
 */
alter table costs
  add column if not exists vat_minor bigint not null default 0 check (vat_minor >= 0);

-- --- grants --------------------------------------------------------------------

-- The manager needs the treatment to read a deal's economics. A Member and a
-- Partner get neither, for the same reason they get no other financial column:
-- the organisation's tax position is the organisation's business.
grant select (country, vat_registered, vat_rate_bp, default_tax_treatment)
  on organizations to qirat_role_manager;

-- Members hold a column-listed grant on deals, so the new columns are excluded
-- automatically. Stated here so the exclusion reads as a decision.
