/* ─── FLIGHTS · THE HONEST VERSION ───────────────────────────────────
   Ayser: "لو حد داس علي المطار يطلعلك ارخص أسعار تكت طيران ذي
   skyscanner كده، خلي باردي يدور علي جوجل و يقلنا الأرخص."

   The instinct is right and the mechanism has to be different, for a
   reason worth writing down rather than quietly working around.

   ── WHY BARDI MUST NOT DO THIS ────────────────────────────────────
   Bardi is a language model. It has no internet and no prices. Asked
   for the cheapest flight to Budapest it will not look anything up —
   it will produce a number that reads like a price, because that is
   what the question invites. It would be fluent, confident and made
   up, and somebody would plan a trip around it.

   That is the one thing this whole app is not allowed to do. A travel
   product that gets a price wrong once is a travel product nobody
   opens twice.

   ── SO: WE SEND THEM TO THE REAL SEARCH ───────────────────────────
   Not a screenshot of a search, not a cached price, not our guess —
   the actual live search on the actual site, with the route and the
   dates already filled in. One tap from the airport pin to a page of
   real prices, and the price the traveller sees is the price the
   airline will honour, because we were never in the middle of it.

   It is also, and this is not a coincidence, the version that costs
   nothing. Live fare APIs are paid and gated. A deep link is free,
   works in every country, and never goes stale.

   ── AND IT IS THE BUSINESS MODEL ──────────────────────────────────
   These same partners run affiliate programmes that are free to join
   and pay a commission on a booking. AFFILIATE below is the one place
   that ever needs editing: put the marker in, and every one of these
   links starts earning without a line of this file changing shape.
   Until then they are ordinary links that work perfectly.           */

/* Set this when the affiliate account exists. Empty means the links
   still work — they simply earn nothing yet. */
export const AFFILIATE = {
  aviasales: '',        // Travelpayouts marker
  booking: '',          // Booking.com affiliate id
};

const pad = (n) => (n < 10 ? '0' + n : String(n));
export const isoDate = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

/* A sensible pair of dates when the traveller has not said: the
   weekend after next, which is what somebody looking at an airport pin
   on a Tuesday evening is usually thinking about. */
export const defaultDates = (from = new Date()) => {
  const out = new Date(from.getTime());
  out.setDate(out.getDate() + 14);
  const back = new Date(out.getTime());
  back.setDate(back.getDate() + 3);
  return { out: isoDate(out), back: isoDate(back) };
};

const q = (s) => encodeURIComponent(String(s || '').trim());

/* ── WHERE A SEARCH ACTUALLY GOES ──────────────────────────────────
   Three, because no single site is cheapest twice in a row and a
   traveller who finds that out on their own trusts the next thing we
   say. Ranked by how often they are useful, not by what they pay. */
export function flightSearches({ fromCity, toCity, fromCode, toCode, out, back }) {
  const dates = out && back ? { out, back } : defaultDates();
  const o = (fromCode || fromCity || '').toString().trim();
  const d = (toCode || toCity || '').toString().trim();
  if (!d) return [];

  const links = [];

  /* Google Flights understands a plain sentence better than a URL
     scheme, and its own scheme changes. A search query is the stable
     way in and it lands on the real results. */
  links.push({
    id: 'google',
    name: 'Google Flights',
    emoji: '🔎',
    note: 'Compares most airlines · shows the cheapest dates around yours',
    url: 'https://www.google.com/travel/flights?q=' +
      q('Flights to ' + d + (o ? ' from ' + o : '') + ' on ' + dates.out + ' through ' + dates.back),
  });

  links.push({
    id: 'skyscanner',
    name: 'Skyscanner',
    emoji: '🛫',
    note: 'Whole month view · often finds the cheapest day',
    url: 'https://www.skyscanner.net/transport/flights/' +
      q(o || 'anywhere').toLowerCase() + '/' + q(d).toLowerCase() + '/' +
      dates.out.slice(2).replace(/-/g, '') + '/' + dates.back.slice(2).replace(/-/g, '') + '/',
  });

  links.push({
    id: 'aviasales',
    name: 'Aviasales',
    emoji: '💸',
    note: 'Strong on routes into and out of the Middle East',
    url: 'https://www.aviasales.com/search?origin_name=' + q(o) + '&destination_name=' + q(d) +
      '&depart_date=' + dates.out + '&return_date=' + dates.back +
      (AFFILIATE.aviasales ? '&marker=' + q(AFFILIATE.aviasales) : ''),
  });

  return links;
}

/* Somewhere to sleep, same rule and the same reason: a real search on
   a real site, with the city and the dates already in it. */
export function staySearches({ city, out, back }) {
  const dates = out && back ? { out, back } : defaultDates();
  if (!city) return [];
  return [
    {
      id: 'booking',
      name: 'Booking.com',
      emoji: '🏨',
      note: 'Hotels, flats and hostels · free cancellation on most',
      url: 'https://www.booking.com/searchresults.html?ss=' + q(city) +
        '&checkin=' + dates.out + '&checkout=' + dates.back +
        (AFFILIATE.booking ? '&aid=' + q(AFFILIATE.booking) : ''),
    },
    {
      id: 'hostelworld',
      name: 'Hostelworld',
      emoji: '🛏️',
      note: 'Where a group of travellers usually ends up',
      url: 'https://www.hostelworld.com/search?search_keywords=' + q(city) +
        '&date_from=' + dates.out + '&date_to=' + dates.back,
    },
  ];
}

/* And a car, for the same reason again. */
export function carSearches({ city, out, back }) {
  const dates = out && back ? { out, back } : defaultDates();
  if (!city) return [];
  return [
    {
      id: 'discover',
      name: 'Discover Cars',
      emoji: '🚗',
      note: 'Compares the local desks as well as the big names',
      url: 'https://www.discovercars.com/search?pickup=' + q(city) +
        '&date_from=' + dates.out + '&date_to=' + dates.back,
    },
  ];
}
