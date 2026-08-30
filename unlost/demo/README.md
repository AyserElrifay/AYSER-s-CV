# The deal card, standalone

`deal-card.html` is the price instrument as a single self-contained page: no
build, no server, no database. Open it in a browser, or publish it anywhere
static.

It exists because the signature moment of this product is a physical one — the
weight of the handle as it crosses the floor — and that cannot be conveyed in a
screenshot or a paragraph. Someone has to drag it, preferably on a phone, where
the haptics land.

**It is not a mock.** The money arithmetic is ported from `src/money/`
faithfully: integer minor units held as BigInt, one rounding function with ties
to even, `niceStepFor` picking a quotable increment, the same 0.45 resistance
factor and 0.014 detent grab as the React component. The margin it shows is the
margin the server would store.

What it does not have is everything that needs a backend: sign-in, the four
roles, row-level isolation, the audit log, persistence. Those are the rest of
the repository.

Published at the URL in the project notes; republish with the Artifact tool
against the same file to keep the link.
