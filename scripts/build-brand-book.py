"""Builds the Moments brand book as one self-contained HTML file.

Everything in here is taken from the product as it actually is: the
palette is src/constants/theme.js, the logo files are the ones the app
renders, the motion timings are the ones measured in a browser, and the
voice rules are drawn from copy already shipping. Nothing is invented to
fill a page.
"""
import base64, pathlib

B = pathlib.Path('/home/user/AYSER-s-CV/src/assets/brand')
def b64(n): return base64.b64encode((B / (n + '.png')).read_bytes()).decode()
MARK, WORD, WORDW = b64('mark'), b64('wordmark'), b64('wordmark-white')

PURPLE, GOLD, CORAL, GREEN, BLUE = '#7C3AED', '#F5B301', '#F43F5E', '#10B981', '#3B82F6'
INK, CANVAS = '#111827', '#F4F5F7'
NIGHT, NIGHT2, NIGHT_PURPLE = '#0B0B0E', '#18181C', '#7C5CFF'

def swatch(hexv, name, use, on_dark=False):
    ink = '#FFF' if on_dark else INK
    return f'''<div class="sw">
      <div class="chip" style="background:{hexv}"></div>
      <div class="swname">{name}</div>
      <div class="swhex">{hexv}</div>
      <div class="swuse">{use}</div>
    </div>'''

PAGES = []

# ── 1 · cover ────────────────────────────────────────────────────────
PAGES.append(f'''
<section class="page cover">
  <div class="coverglow"></div>
  <img class="covermark" src="data:image/png;base64,{MARK}">
  <img class="coverword" src="data:image/png;base64,{WORDW}">
  <div class="covertag">Don't scroll it. Live it.</div>
  <div class="coverfoot">
    <div>Brand Book</div>
    <div class="cb-dim">Corporate identity &amp; usage · v1</div>
  </div>
</section>''')

# ── 2 · the idea ─────────────────────────────────────────────────────
PAGES.append(f'''
<section class="page">
  <div class="kicker">01 — The idea</div>
  <h1>Every piece of content is<br>an invitation to move.</h1>
  <p class="lede">Moments is built against the thing every other social app is
  built for. The feed is not the product; the day you actually have is the
  product. Everything in the app either gets you somewhere, gets you to
  someone, or gets out of the way.</p>

  <div class="rule"></div>

  <div class="two">
    <div>
      <h3>What we are</h3>
      <p>A map of people who are actually around. A camera that opens in one tap.
      Conversations that don't pile up forever. Games you play with someone
      rather than at them.</p>
    </div>
    <div>
      <h3>What we are not</h3>
      <p>An infinite feed. A metrics dashboard for your friendships. A place
      that measures how long it kept you.</p>
    </div>
  </div>

  <div class="rule"></div>

  <h3>The line</h3>
  <div class="bigline">Don't scroll it. Live it.</div>
  <p class="fine">The tagline is a sentence, with a full stop, always. It is never
  set in all caps, never turned into a hashtag, and never translated
  loosely — each locale has its own approved wording.</p>
</section>''')

# ── 3 · logo ─────────────────────────────────────────────────────────
PAGES.append(f'''
<section class="page">
  <div class="kicker">02 — The logo</div>
  <h1>One mark, one wordmark.</h1>
  <p class="lede">The app mark is a purple tile carrying a lowercase <b>m</b> and a
  gold dot. The wordmark is <b>moments</b>, lowercase, with the gold spark above
  it. They are the same family: the dot and the spark are the same idea — the
  small bright thing that makes an ordinary moment worth keeping.</p>

  <div class="logogrid">
    <div class="lb">
      <img src="data:image/png;base64,{MARK}" style="width:132px">
      <div class="lbl">App mark</div>
      <div class="fine">Home screen, avatars, favicons, anywhere square.</div>
    </div>
    <div class="lb">
      <img src="data:image/png;base64,{WORD}" style="width:250px">
      <div class="lbl">Wordmark · light backgrounds</div>
      <div class="fine">Headers, print, light UI.</div>
    </div>
    <div class="lb dark">
      <img src="data:image/png;base64,{WORDW}" style="width:250px">
      <div class="lbl" style="color:#fff">Wordmark · dark backgrounds</div>
      <div class="fine" style="color:rgba(255,255,255,.55)">Night mode, photography, video.</div>
    </div>
  </div>

  <h3>Clear space &amp; minimum size</h3>
  <div class="two">
    <div>
      <div class="clearbox">
        <div class="clearinner"><img src="data:image/png;base64,{MARK}" style="width:74px"></div>
      </div>
      <p class="fine">Keep clear space equal to the height of the <b>m</b> on every
      side. Nothing sits inside it — no text, no rules, no other logos.</p>
    </div>
    <div>
      <h4>Minimum sizes</h4>
      <table class="t">
        <tr><td>App mark, screen</td><td>24&nbsp;px</td></tr>
        <tr><td>App mark, print</td><td>8&nbsp;mm</td></tr>
        <tr><td>Wordmark, screen</td><td>96&nbsp;px wide</td></tr>
        <tr><td>Wordmark, print</td><td>25&nbsp;mm wide</td></tr>
      </table>
      <p class="fine">Below these the gold dot and the spark stop reading, and the
      mark loses the thing that makes it ours.</p>
    </div>
  </div>
</section>''')

# ── 4 · logo misuse ──────────────────────────────────────────────────
def dont(inner, caption):
    return f'''<div class="dont">
      <div class="dontbox">{inner}</div>
      <div class="dontcap"><span class="x">✕</span> {caption}</div>
    </div>'''

PAGES.append(f'''
<section class="page">
  <div class="kicker">02 — The logo</div>
  <h1>What not to do.</h1>
  <p class="lede">The mark exists as artwork. It is never redrawn, re-coloured or
  set in a typeface — including by us. An earlier build of the app invented its
  own version with a capital M; this page exists so that doesn't happen twice.</p>

  <div class="dontgrid">
    {dont(f'<div style="width:86px;height:86px;border-radius:26px;background:{PURPLE};display:flex;align-items:center;justify-content:center"><span style="color:#fff;font:900 42px system-ui">M</span></div>', 'Never redraw it in a font')}
    {dont(f'<img src="data:image/png;base64,{MARK}" style="width:86px;filter:grayscale(1)">', 'Never remove the colour')}
    {dont(f'<img src="data:image/png;base64,{MARK}" style="width:86px;transform:rotate(-14deg)">', 'Never rotate or tilt it')}
    {dont(f'<img src="data:image/png;base64,{MARK}" style="width:120px;height:70px">', 'Never stretch it')}
    {dont(f'<div style="background:linear-gradient(120deg,#f0abfc,#22d3ee);padding:12px;border-radius:18px"><img src="data:image/png;base64,{MARK}" style="width:70px"></div>', 'Never place it on a busy colour')}
    {dont(f'<div style="width:86px;height:86px;border-radius:26px;background:{GOLD};display:flex;align-items:center;justify-content:center"><span style="color:#fff;font:900 40px system-ui">m.</span></div>', 'Never recolour the tile')}
  </div>
</section>''')

# ── 5 · colour ───────────────────────────────────────────────────────
PAGES.append(f'''
<section class="page">
  <div class="kicker">03 — Colour</div>
  <h1>One violet does the work.</h1>
  <p class="lede">Violet is the brand. Gold, coral, green and blue are not
  decoration — each one means something, and using them for anything else takes
  the meaning away. If a colour on screen isn't saying one of these things, it
  should be ink, dim or a hairline.</p>

  <h3>Core</h3>
  <div class="swatches">
    {swatch(PURPLE, 'Violet', 'The brand. Primary buttons, active state, the mark.')}
    {swatch(GOLD, 'Gold', 'The star reaction, and the spark. Delight only.')}
    {swatch(INK, 'Ink', 'Text. Near-black, never pure black.')}
    {swatch(CANVAS, 'Canvas', 'The light background. Cloud-grey, never white.')}
  </div>

  <h3>Meaning colours</h3>
  <div class="swatches">
    {swatch(CORAL, 'Coral', 'Live, urgent, SOS, leaving. Never a default button.')}
    {swatch(GREEN, 'Green', 'Confirmed, online, safe, accepted.')}
    {swatch(BLUE, 'Blue', 'Groups and squads. Translation.')}
  </div>

  <h3>Night</h3>
  <p class="fine">Dark mode is not the light palette inverted. The canvas goes
  near-black, cards sit barely lifted off it, outlines become hairlines, and the
  accents brighten so they still carry on a dark ground.</p>
  <div class="swatches">
    {swatch(NIGHT, 'Night canvas', 'The dark background.')}
    {swatch(NIGHT2, 'Night card', 'Barely lifted off the canvas.')}
    {swatch(NIGHT_PURPLE, 'Night violet', 'Brightened so it still reads.')}
    {swatch('#F5B301', 'Gold', 'Unchanged — it carries on both.')}
  </div>

  <div class="note">
    <b>Contrast.</b> Body text holds at least 4.5:1 against its background in both
    themes; anything smaller than 14&nbsp;px holds 7:1. A colour that fails this
    is not used for text, whatever it looks like.
  </div>
</section>''')

# ── 6 · type ─────────────────────────────────────────────────────────
PAGES.append('''
<section class="page">
  <div class="kicker">04 — Typeface</div>
  <h1>The system typeface, used with conviction.</h1>
  <p class="lede">Moments sets everything in the platform's own interface font —
  San&nbsp;Francisco on Apple devices, Roboto on Android, Segoe on Windows. It is
  a deliberate choice, not a shortcut: it renders faster than anything we could
  ship, it is the face people already read all day, and it carries Arabic,
  Cyrillic, Chinese, Japanese and Korean without a second file. Thirteen
  languages ship today.</p>

  <div class="typespec">
    <div class="tsrow"><div class="tsdemo" style="font-size:34px;font-weight:900;letter-spacing:-.5px">Screen title</div><div class="tsmeta">900 · 26–34px · tight</div></div>
    <div class="tsrow"><div class="tsdemo" style="font-size:19px;font-weight:900">Section heading</div><div class="tsmeta">900 · 17–19px</div></div>
    <div class="tsrow"><div class="tsdemo" style="font-size:15px;font-weight:800">Row label · a name, a place</div><div class="tsmeta">800 · 14–15px</div></div>
    <div class="tsrow"><div class="tsdemo" style="font-size:14px;line-height:1.45">Body. What something is, said plainly, in as few words as it takes.</div><div class="tsmeta">400–600 · 13–14px · 1.45</div></div>
    <div class="tsrow"><div class="tsdemo" style="font-size:11.5px;opacity:.55">Quiet detail — a timestamp, a hint, a count</div><div class="tsmeta">700 · 11–12px · dimmed</div></div>
    <div class="tsrow"><div class="tsdemo" style="font-size:10px;font-weight:900;letter-spacing:1.6px;text-transform:uppercase">Kicker above a title</div><div class="tsmeta">900 · 10px · 1.6 tracking</div></div>
  </div>

  <h3>Rules</h3>
  <ul class="rules">
    <li>Weight carries hierarchy, not size. Two sizes and two weights beat four sizes.</li>
    <li>All caps is only ever the kicker. Never a sentence, never a button.</li>
    <li>Numbers that change — counts, timers — are tabular so they don't jitter.</li>
    <li>Arabic is never italicised and never letter-spaced.</li>
  </ul>
</section>''')

# ── 7 · voice ────────────────────────────────────────────────────────
PAGES.append('''
<section class="page">
  <div class="kicker">05 — Voice</div>
  <h1>Say the true thing, in the fewest words.</h1>
  <p class="lede">Moments talks like a straight friend, not a brand. It admits
  when something failed, it never pretends something worked, and it never
  performs enthusiasm it doesn't have. Emoji are punctuation, not personality.</p>

  <div class="vgrid">
    <div class="vcol good"><div class="vhead">We say</div>
      <div class="vline">"That did not send — you are NOT showing as needing help."</div>
      <div class="vline">"The upload stopped moving at 76%. Your connection dropped out."</div>
      <div class="vline">"Nobody in here yet. Find someone on the map, or start one from here."</div>
      <div class="vline">"Keep it clothed."</div>
      <div class="vline">"Nothing was lost. Close it and have another go."</div>
    </div>
    <div class="vcol bad"><div class="vhead">We don't</div>
      <div class="vline">"Oops! Something went wrong 😅"</div>
      <div class="vline">"Upload failed. Please try again later."</div>
      <div class="vline">"No conversations yet!"</div>
      <div class="vline">"Please adhere to our community guidelines."</div>
      <div class="vline">"We're working hard to fix this!"</div>
    </div>
  </div>

  <h3>Four rules</h3>
  <ul class="rules">
    <li><b>Name the thing.</b> "48MB, the limit is 48" — not "file too large".</li>
    <li><b>Say what to do next.</b> Every error ends with an action, or it isn't finished.</li>
    <li><b>Never take credit for a failure.</b> No "we're on it", no "we apologise for the inconvenience".</li>
    <li><b>Don't lecture.</b> A rule is stated once, plainly, before it's broken — not moralised after.</li>
  </ul>

  <div class="note">
    <b>Arabic.</b> Egyptian colloquial, not Modern Standard — the app is spoken, not
    announced. It is written for someone reading on a phone at midnight, not for
    a press release.
  </div>
</section>''')

# ── 8 · motion ───────────────────────────────────────────────────────
PAGES.append('''
<section class="page">
  <div class="kicker">06 — Motion</div>
  <h1>A door, not a performance.</h1>
  <p class="lede">Animation exists to explain where something came from and where
  it went. The second time someone sees an animation they only want it to be
  over, so every duration here is the shortest one that still reads.</p>

  <table class="t wide">
    <tr><th>Moment</th><th>In</th><th>Out</th><th>Curve</th></tr>
    <tr><td>App opening</td><td>440ms</td><td>220ms</td><td>out-cubic / in-cubic</td></tr>
    <tr><td>Sheet up from the bottom</td><td>280ms</td><td>200ms</td><td>out-cubic</td></tr>
    <tr><td>Tap feedback</td><td>90ms</td><td>120ms</td><td>out-quad</td></tr>
    <tr><td>Screen to screen</td><td>300ms</td><td>240ms</td><td>platform default</td></tr>
    <tr><td>Live pulse (SOS, recording)</td><td colspan="2">700ms loop</td><td>in-out-quad</td></tr>
    <tr><td>Ambient float (map pins)</td><td colspan="2">3.2s loop</td><td>in-out</td></tr>
  </table>

  <ul class="rules">
    <li>Nothing bounces. Overshoot reads as a toy.</li>
    <li>Anything that loops is slow enough to ignore — a loop you notice twice is too fast.</li>
    <li>An animation is never allowed to delay an action. It plays over the result, not before it.</li>
    <li>An opening that gets cut off mid-way is worse than none: it either finishes or it never started.</li>
  </ul>
</section>''')

# ── 9 · UI ───────────────────────────────────────────────────────────
PAGES.append(f'''
<section class="page">
  <div class="kicker">07 — Interface</div>
  <h1>Round, quiet, one accent.</h1>

  <div class="two">
    <div>
      <h3>The house radius</h3>
      <div class="uidemo">
        <div class="card">20px — cards, sheets, panels</div>
        <div class="card" style="border-radius:16px">16px — inner controls</div>
        <div class="pill">999px — chips &amp; primary buttons</div>
      </div>
      <p class="fine">Three radii, and no others. A fourth is how an interface starts
      looking assembled rather than made.</p>
    </div>
    <div>
      <h3>Buttons</h3>
      <div class="uidemo">
        <div class="btn primary">Primary — one per screen</div>
        <div class="btn ghost">Ghost — the way out</div>
        <div class="btn danger">Destructive — says what it destroys</div>
      </div>
      <p class="fine">One primary button per screen. If two things look equally
      important, neither is.</p>
    </div>
  </div>

  <h3>Spacing</h3>
  <p class="fine">A 4px base. Real spacing is 8 / 12 / 16 / 22 / 34. Touch targets are
  never under 44&nbsp;px, including the ones that look small.</p>

  <h3>Depth</h3>
  <p class="fine">Light mode lifts things with soft shadow on a grey canvas. Night
  mode does not — it separates with hairlines, because shadow on near-black is
  mud. The same screen is built twice, not tinted once.</p>
</section>''')

# ── 10 · principles ──────────────────────────────────────────────────
PAGES.append(f'''
<section class="page last">
  <div class="kicker">08 — The rules under everything</div>
  <h1>Five things we don't trade away.</h1>

  <ol class="principles">
    <li><b>Nothing fake.</b> No placeholder people, no invented counts, no scripted
    activity. An empty app looks empty, and says so warmly.</li>
    <li><b>Never leave a blank screen.</b> A blank rectangle is indistinguishable
    from a broken app. Something always says what is happening and how to get out.</li>
    <li><b>Failure is told, not swallowed.</b> If it didn't send, the person hears
    the real reason in their own words, not ours.</li>
    <li><b>Nothing borrowed.</b> Every character, every sticker, every piece of art
    in the app is drawn by us. No copyrighted clothing, no other app's avatars.</li>
    <li><b>Structure over policing.</b> Safety comes from what the app makes
    impossible, not from what it scolds you for afterwards.</li>
  </ol>

  <div class="rule"></div>
  <div class="closing">
    <img src="data:image/png;base64,{MARK}" style="width:56px">
    <div>
      <div class="closeline">Don't scroll it. Live it.</div>
      <div class="fine">If a decision doesn't serve that sentence, it isn't a Moments decision.</div>
    </div>
  </div>
</section>''')

CSS = f'''
@page {{ size: A4; margin: 0; }}
* {{ box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
body {{ margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
       color: {INK}; background: #fff; }}
.page {{ width: 210mm; height: 297mm; padding: 20mm 18mm; position: relative;
        page-break-after: always; overflow: hidden; background: #fff; }}
.page.last {{ page-break-after: auto; }}
.kicker {{ font-size: 9.5px; font-weight: 900; letter-spacing: 1.8px; text-transform: uppercase;
          color: {PURPLE}; margin-bottom: 10px; }}
h1 {{ font-size: 30px; font-weight: 900; letter-spacing: -.7px; line-height: 1.16; margin: 0 0 14px; }}
h3 {{ font-size: 13px; font-weight: 900; letter-spacing: .2px; margin: 22px 0 8px; }}
h4 {{ font-size: 12px; font-weight: 900; margin: 0 0 8px; }}
p {{ font-size: 11.5px; line-height: 1.62; margin: 0 0 10px; color: rgba(17,24,39,.80); }}
.lede {{ font-size: 12.5px; line-height: 1.62; color: rgba(17,24,39,.72); max-width: 155mm; }}
.fine {{ font-size: 10px; line-height: 1.55; color: rgba(17,24,39,.52); }}
.rule {{ height: 1px; background: rgba(17,24,39,.10); margin: 20px 0; }}
.two {{ display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }}
.bigline {{ font-size: 27px; font-weight: 900; letter-spacing: -.6px; color: {PURPLE}; margin: 4px 0 10px; }}

/* cover */
.cover {{ background: linear-gradient(158deg, #14082e 0%, #0B0B0E 62%); color: #fff;
         display: flex; flex-direction: column; justify-content: center; align-items: flex-start; }}
.coverglow {{ position: absolute; width: 300mm; height: 300mm; left: -110mm; top: -120mm; border-radius: 50%;
             background: radial-gradient(circle, rgba(124,92,255,.36) 0%, transparent 62%); }}
.covermark {{ width: 92px; position: relative; margin-bottom: 26px; }}
.coverword {{ width: 300px; position: relative; margin-left: -8px; }}
.covertag {{ position: relative; font-size: 15px; color: rgba(255,255,255,.62); margin-top: 6px; letter-spacing: .2px; }}
.coverfoot {{ position: absolute; left: 18mm; bottom: 20mm; font-size: 12px; font-weight: 900; color: #fff; }}
.cb-dim {{ font-weight: 400; color: rgba(255,255,255,.45); font-size: 10.5px; margin-top: 3px; }}

/* logos */
.logogrid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 16px 0 4px; }}
.lb {{ border: 1px solid rgba(17,24,39,.10); border-radius: 16px; padding: 20px; background: {CANVAS};
      display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 150px; }}
.lb.dark {{ background: {NIGHT}; border-color: rgba(255,255,255,.10); }}
.lbl {{ font-size: 10.5px; font-weight: 900; margin-top: 14px; }}
.clearbox {{ border: 1px dashed {PURPLE}; border-radius: 14px; padding: 37px; display: inline-block;
            background: rgba(124,58,237,.05); margin-bottom: 8px; }}
.clearinner {{ outline: 1px solid rgba(124,58,237,.35); }}

/* don'ts */
.dontgrid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 18px; }}
.dont {{ text-align: center; }}
.dontbox {{ border: 1px solid rgba(17,24,39,.10); border-radius: 14px; height: 118px; background: {CANVAS};
           display: flex; align-items: center; justify-content: center; }}
.dontcap {{ font-size: 9.5px; color: rgba(17,24,39,.60); margin-top: 8px; line-height: 1.4; }}
.x {{ color: {CORAL}; font-weight: 900; }}

/* colour */
.swatches {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 8px 0 4px; }}
.sw {{ }}
.chip {{ height: 54px; border-radius: 12px; border: 1px solid rgba(17,24,39,.08); }}
.swname {{ font-size: 11px; font-weight: 900; margin-top: 7px; }}
.swhex {{ font-size: 9.5px; color: rgba(17,24,39,.45); font-variant-numeric: tabular-nums; letter-spacing: .3px; }}
.swuse {{ font-size: 9px; color: rgba(17,24,39,.55); line-height: 1.45; margin-top: 3px; }}
.note {{ background: rgba(124,58,237,.06); border-left: 3px solid {PURPLE}; border-radius: 0 10px 10px 0;
        padding: 12px 14px; font-size: 10.5px; line-height: 1.6; margin-top: 16px; color: rgba(17,24,39,.78); }}

/* type */
.typespec {{ margin: 14px 0; }}
.tsrow {{ display: flex; align-items: baseline; justify-content: space-between; gap: 20px;
         padding: 11px 0; border-bottom: 1px solid rgba(17,24,39,.07); }}
.tsdemo {{ flex: 1; }}
.tsmeta {{ font-size: 9.5px; color: rgba(17,24,39,.42); white-space: nowrap; font-variant-numeric: tabular-nums; }}
ul.rules, ol.principles {{ margin: 8px 0 0; padding-left: 17px; }}
ul.rules li, ol.principles li {{ font-size: 11px; line-height: 1.62; margin-bottom: 8px; color: rgba(17,24,39,.80); }}

/* voice */
.vgrid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 16px 0 4px; }}
.vcol {{ border-radius: 14px; padding: 16px; }}
.vcol.good {{ background: rgba(16,185,129,.07); border: 1px solid rgba(16,185,129,.25); }}
.vcol.bad {{ background: rgba(244,63,94,.06); border: 1px solid rgba(244,63,94,.22); }}
.vhead {{ font-size: 10px; font-weight: 900; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 10px; }}
.vcol.good .vhead {{ color: {GREEN}; }}
.vcol.bad .vhead {{ color: {CORAL}; }}
.vline {{ font-size: 10.5px; line-height: 1.5; padding: 7px 0; border-top: 1px solid rgba(17,24,39,.07); }}
.vline:first-of-type {{ border-top: 0; }}

/* tables */
table.t {{ width: 100%; border-collapse: collapse; margin: 4px 0 10px; }}
table.t td, table.t th {{ font-size: 10.5px; padding: 8px 6px; border-bottom: 1px solid rgba(17,24,39,.08);
                         text-align: left; }}
table.t th {{ font-weight: 900; font-size: 9.5px; text-transform: uppercase; letter-spacing: 1px;
             color: rgba(17,24,39,.45); }}
table.t td:first-child {{ font-weight: 700; }}
table.t.wide td {{ font-variant-numeric: tabular-nums; }}

/* ui */
.uidemo {{ display: flex; flex-direction: column; gap: 9px; margin: 10px 0; }}
.card {{ background: #fff; border: 1px solid rgba(17,24,39,.09); border-radius: 20px; padding: 13px 15px;
        font-size: 10.5px; font-weight: 700; box-shadow: 0 4px 14px rgba(17,24,39,.05); }}
.pill {{ background: {PURPLE}; color: #fff; border-radius: 999px; padding: 11px 18px; font-size: 10.5px;
        font-weight: 900; text-align: center; }}
.btn {{ border-radius: 999px; padding: 11px 16px; font-size: 10.5px; font-weight: 900; text-align: center; }}
.btn.primary {{ background: {PURPLE}; color: #fff; }}
.btn.ghost {{ background: transparent; border: 1px solid rgba(17,24,39,.14); color: {INK}; }}
.btn.danger {{ background: rgba(244,63,94,.10); color: {CORAL}; border: 1px solid rgba(244,63,94,.3); }}

.closing {{ display: flex; align-items: center; gap: 16px; margin-top: 6px; }}
.closeline {{ font-size: 17px; font-weight: 900; color: {PURPLE}; letter-spacing: -.3px; }}
'''

html = ('<meta charset="utf-8"><title>Moments — Brand Book</title><style>'
        + CSS + '</style>' + ''.join(PAGES))
pathlib.Path('/tmp/brand/book.html').write_text(html, encoding='utf-8')
print('wrote', len(html), 'chars ·', len(PAGES), 'pages')
