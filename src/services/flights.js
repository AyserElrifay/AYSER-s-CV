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

/* Each row carries a noteKey for the sheet to translate, and keeps the
   English note beside it. The English is not dead weight: t() answers
   from English while another language is still being fetched, and on
   the day the network is down these rows still say something true
   rather than showing a key name to somebody planning a journey. */

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
    noteKey: 'travel_note_google_flights',
    note: 'Compares most airlines · shows the cheapest dates around yours',
    url: 'https://www.google.com/travel/flights?q=' +
      q('Flights to ' + d + (o ? ' from ' + o : '') + ' on ' + dates.out + ' through ' + dates.back),
  });

  links.push({
    id: 'skyscanner',
    name: 'Skyscanner',
    emoji: '🛫',
    noteKey: 'travel_note_skyscanner',
    note: 'Whole month view · often finds the cheapest day',
    url: 'https://www.skyscanner.net/transport/flights/' +
      q(o || 'anywhere').toLowerCase() + '/' + q(d).toLowerCase() + '/' +
      dates.out.slice(2).replace(/-/g, '') + '/' + dates.back.slice(2).replace(/-/g, '') + '/',
  });

  links.push({
    id: 'aviasales',
    name: 'Aviasales',
    emoji: '💸',
    noteKey: 'travel_note_aviasales',
    note: 'Strong on routes into and out of the Middle East',
    url: 'https://www.aviasales.com/search?origin_name=' + q(o) + '&destination_name=' + q(d) +
      '&depart_date=' + dates.out + '&return_date=' + dates.back +
      (AFFILIATE.aviasales ? '&marker=' + q(AFFILIATE.aviasales) : ''),
  });

  return links;
}

/* Somewhere to sleep, same rule and the same reason: a real search on
   a real site, with the city and the dates already in it.

   ── HOSTEL OR HOTEL ───────────────────────────────────────────────
   Ayser asked for the choice, and it is the right thing to ask for. A
   nineteen-year-old going to Athens for four nights and a family going
   to Athens for four nights are not looking for the same thing, and
   one undifferentiated list of "places to sleep" serves neither of
   them. Hostels are also the reason a young traveller can afford
   Europe at all, so burying them under hotels is not neutral.

   The choice is not decoration — it changes the search that opens.
   Booking.com filters property type with nflt=ht_id: 203 is hostels,
   204 is hotels. If that parameter ever changes shape, the link still
   lands on the right city on the right dates and simply shows
   everything — an unfiltered search is a failure we can live with,
   which is why the filter rides on a link rather than on our own
   copy of a list of hotels. */
const BOOKING_TYPE = { hostels: 203, hotels: 204 };

export function staySearches({ city, out, back, kind = 'any' }) {
  const dates = out && back ? { out, back } : defaultDates();
  if (!city) return [];
  const type = BOOKING_TYPE[kind];

  const booking = {
    id: 'booking',
    name: 'Booking.com',
    emoji: kind === 'hostels' ? '🛏️' : '🏨',
    noteKey: kind === 'hostels' ? 'stay_note_booking_hostels'
      : kind === 'hotels' ? 'stay_note_booking_hotels' : 'stay_note_booking_any',
    note: kind === 'hostels' ? 'Hostels only · free cancellation on most'
      : kind === 'hotels' ? 'Hotels only · free cancellation on most'
      : 'Hotels, flats and hostels · free cancellation on most',
    url: 'https://www.booking.com/searchresults.html?ss=' + q(city) +
      '&checkin=' + dates.out + '&checkout=' + dates.back +
      (type ? '&nflt=' + q('ht_id=' + type) : '') +
      (AFFILIATE.booking ? '&aid=' + q(AFFILIATE.booking) : ''),
  };

  const hostelworld = {
    id: 'hostelworld',
    name: 'Hostelworld',
    emoji: '🎒',
    noteKey: 'stay_note_hostelworld',
    note: 'Hostels only · dorm beds and private rooms, and who else is staying',
    url: 'https://www.hostelworld.com/search?search_keywords=' + q(city) +
      '&date_from=' + dates.out + '&date_to=' + dates.back,
  };

  /* Google's plain search query is the stable way into its travel
     results — the same reason Google Flights above is a q= and not a
     hand-built scheme. */
  const googleHotels = {
    id: 'googlehotels',
    name: 'Google Hotels',
    emoji: '🔎',
    noteKey: 'stay_note_google_hotels',
    note: 'Compares the booking sites against each other',
    url: 'https://www.google.com/travel/search?q=' + q('hotels in ' + city),
  };

  if (kind === 'hostels') return [hostelworld, booking];
  if (kind === 'hotels') return [booking, googleHotels];
  return [booking, hostelworld];
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
      noteKey: 'travel_note_discovercars',
      note: 'Compares the local desks as well as the big names',
      url: 'https://www.discovercars.com/search?pickup=' + q(city) +
        '&date_from=' + dates.out + '&date_to=' + dates.back,
    },
  ];
}
