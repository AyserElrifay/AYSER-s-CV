const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nf = new Intl.NumberFormat("en-US");
const fmtNum = (n) => nf.format(Math.round(Number(n) || 0));

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmtEGP(n) {
  n = Number(n) || 0;
  if (n >= 1e6) { const m = n / 1e6; return (m % 1 === 0 ? m : m.toFixed(1)) + " مليون"; }
  if (n >= 1000) return fmtNum(n / 1000) + " ألف";
  return n ? fmtNum(n) : "";
}

/* Contact links. Egyptian local numbers (010…) are given the country code;
   numbers that already carry one are left as they are. */
function telHref(p) {
  const v = String(p || "").replace(/[^\d+]/g, "");
  return v ? "tel:" + v : null;
}
function waHref(p) {
  let v = String(p || "").replace(/\D/g, "");
  if (!v) return null;
  if (v.startsWith("00")) v = v.slice(2);
  else if (v.startsWith("0")) v = "20" + v.slice(1);
  return "https://wa.me/" + v;
}

const DAY = 86400000;
const daysSince = (ts) => Math.max(0, Math.floor((Date.now() - ts) / DAY));
function agoLabel(ts) {
  if (!ts) return "";
  const d = daysSince(ts);
  if (d === 0) return "اليوم";
  if (d === 1) return "أمس";
  return "منذ " + d + " يوم";
}

/* Paste-parser for a subscription sheet copied out of Excel/Google Sheets.
   Splits on tabs or commas, drops a header row if present, then works out
   which column holds the phone and which holds the name by looking at the
   values themselves rather than trusting column order. */
function parseSheet(text) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], skipped: 0 };

  const split = (l) => (l.indexOf("\t") > -1 ? l.split("\t") : l.split(",")).map((c) => c.trim());
  let cells = lines.map(split);

  const looksLikePhone = (v) => (String(v).replace(/\D/g, "").length >= 8);
  const headerish = cells[0].some((c) => /اسم|هاتف|موبايل|تليفون|رقم|name|phone|mobile/i.test(c));
  if (headerish && cells.length > 1 && !cells[0].some(looksLikePhone)) cells = cells.slice(1);

  const width = Math.max.apply(null, cells.map((r) => r.length));
  const score = [];
  for (let c = 0; c < width; c++) {
    let phone = 0, words = 0;
    cells.forEach((r) => {
      const v = r[c] || "";
      if (looksLikePhone(v)) phone++;
      else if (/[A-Za-z؀-ۿ]{2,}/.test(v)) words++;
    });
    score.push({ c, phone, words });
  }
  const phoneCol = score.slice().sort((a, b) => b.phone - a.phone)[0];
  const nameCol = score.filter((s) => s.c !== (phoneCol && phoneCol.c))
    .sort((a, b) => b.words - a.words)[0];

  const rows = [];
  let skipped = 0;
  cells.forEach((r) => {
    const phone = phoneCol ? (r[phoneCol.c] || "").trim() : "";
    const name = nameCol ? (r[nameCol.c] || "").trim() : "";
    if (!phone && !name) { skipped++; return; }
    const rest = r.filter((_, i) => i !== (phoneCol && phoneCol.c) && i !== (nameCol && nameCol.c))
      .filter(Boolean).join(" · ");
    rows.push({ name: name || "بدون اسم", phone: phone, extra: rest });
  });
  return { rows: rows, skipped: skipped };
}
