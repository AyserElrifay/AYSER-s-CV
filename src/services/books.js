import { withAffiliate } from './broker';

/* ── BOOKS ──────────────────────────────────────────────────────────
   Two honest halves.

   READ NOW — books whose copyright has lapsed. Not samples, not
   previews: the whole book, free, because it belongs to everyone. The
   Internet Archive and Standard Ebooks host them; we link to the
   reader, we do not host or copy anything.

   BUY — everything else. We do not sell books and we never will
   pretend to. A buy button opens the real shop, and if an affiliate
   tag is configured for that shop we earn a commission on the sale.
   With no tag the link still works — it just earns nothing, which is
   the truthful state until Ayser signs up with each store.

   The catalogue itself is Open Library: a real, free, keyless API over
   millions of records with covers. No invented titles. */

const OL = 'https://openlibrary.org';
const COVER = 'https://covers.openlibrary.org/b/id/';

export const BOOK_SHELVES = [
  { id: 'free',      labelKey: 'books_free',    label: 'Free to read', emoji: '📖', q: 'subject:fiction', freeOnly: true },
  { id: 'arabic',    label: 'عربي',         emoji: '🇪🇬', q: 'language:ara' },
  { id: 'growth',    labelKey: 'books_grow',    label: 'Grow',         emoji: '🌱', q: 'subject:self-help' },
  { id: 'psych',     labelKey: 'books_minds',   label: 'Minds',        emoji: '🧠', q: 'subject:psychology' },
  { id: 'business',  labelKey: 'books_work',    label: 'Work',         emoji: '💼', q: 'subject:business' },
  { id: 'stories',   labelKey: 'books_stories', label: 'Stories',      emoji: '📚', q: 'subject:fiction' },
  { id: 'travel',    labelKey: 'books_travel',  label: 'Travel',       emoji: '🧭', q: 'subject:travel' },
  { id: 'history',   labelKey: 'books_history', label: 'History',      emoji: '🏺', q: 'subject:history' },
];

const shape = (d) => {
  const coverId = d.cover_i || (d.cover_edition_key ? null : null);
  return {
    id: d.key || (d.title + (d.first_publish_year || '')),
    title: (d.title || 'Untitled').slice(0, 120),
    author: (d.author_name && d.author_name[0]) || 'Unknown',
    year: d.first_publish_year || null,
    cover: coverId ? COVER + coverId + '-M.jpg' : null,
    /* "Free to read" here means the Archive says you can read the whole
       thing, not that a preview exists — the distinction is the whole
       point of the shelf. */
    free: d.ebook_access === 'public',
    olKey: d.key || null,
    iaId: (d.ia && d.ia[0]) || null,
    isbn: (d.isbn && d.isbn[0]) || null,
  };
};

export async function searchBooks(query, { limit = 24, freeOnly = false } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const url = `${OL}/search.json?q=${encodeURIComponent(q)}&limit=${limit}` +
    `&fields=key,title,author_name,first_publish_year,cover_i,ebook_access,ia,isbn` +
    (freeOnly ? '&ebook_access=public' : '');
  const r = await fetch(url);
  if (!r.ok) throw new Error('Could not reach the book catalogue');
  const j = await r.json();
  return ((j && j.docs) || []).map(shape).filter((b) => b.title);
}

export async function fetchShelf(shelf, { limit = 24 } = {}) {
  return searchBooks(shelf.q, { limit, freeOnly: !!shelf.freeOnly });
}

/* Where to actually read a free one. */
export function readUrl(book) {
  if (book.iaId) return 'https://archive.org/details/' + encodeURIComponent(book.iaId);
  if (book.olKey) return OL + book.olKey;
  return null;
}

/* Where to buy one that isn't free. Amazon is first because it is the
   only one of these with an open affiliate programme in most of the
   world; the Arabic shops are here because they carry what Amazon
   doesn't, and they earn nothing until a code is configured. */
export function buyOptions(book) {
  const term = encodeURIComponent(book.title + ' ' + (book.author || ''));
  const out = [
    {
      id: 'amazon', name: 'Amazon', emoji: '📦', partner: 'amazon',
      url: book.isbn
        ? 'https://www.amazon.com/s?k=' + encodeURIComponent(book.isbn)
        : 'https://www.amazon.com/s?k=' + term + '&i=stripbooks',
    },
    { id: 'jarir',  name: 'Jarir',  emoji: '🟢', partner: 'jarir',
      url: 'https://www.jarir.com/sa-en/catalogsearch/result/?q=' + term },
    { id: 'neelwafurat', name: 'النيل والفرات', emoji: '🇪🇬', partner: 'neelwafurat',
      url: 'https://www.neelwafurat.com/search.aspx?q=' + term },
  ];
  return out.map((o) => ({ ...o, url: withAffiliate(o.partner, o.url) }));
}
