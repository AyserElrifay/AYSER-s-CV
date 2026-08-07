/* Everything the broker enters lives in their own browser. Nothing is
   seeded, nothing is invented — an empty account starts genuinely empty. */
const KEY = "twelve_broker_v1";

let db = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return { broker: d.broker || null, packages: d.packages || [], leads: d.leads || [] };
    }
  } catch (e) { /* corrupt or unavailable storage: fall through to a fresh account */ }
  return { broker: null, packages: [], leads: [] };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast("تعذّر الحفظ — مساحة التخزين ممتلئة"); }
}

/* The only statuses a broker working a call sheet actually needs. */
const STATUS = [
  { id: "new",       label: "جديد",       pill: "new"    },
  { id: "called",    label: "تم الاتصال", pill: "called" },
  { id: "interested",label: "مهتم",       pill: "hot"    },
  { id: "later",     label: "أعاود لاحقاً", pill: "later"  },
  { id: "closed",    label: "تم البيع",   pill: "done"   },
  { id: "no",        label: "غير مهتم",   pill: "no"     },
];
const statusOf = (id) => STATUS.find((s) => s.id === id) || STATUS[0];
const DONE = ["closed", "no"];           // finished either way
const WORKED = ["called", "interested", "later", "closed", "no"]; // touched at all

const pkgLeads = (pid) => db.leads.filter((l) => l.packageId === pid);
const pkgById = (pid) => db.packages.find((p) => p.id === pid);

function pkgStats(pid) {
  const rows = pkgLeads(pid);
  const worked = rows.filter((l) => WORKED.indexOf(l.status) > -1).length;
  return {
    total: rows.length,
    worked: worked,
    left: rows.length - worked,
    interested: rows.filter((l) => l.status === "interested").length,
    closed: rows.filter((l) => l.status === "closed").length,
    pct: rows.length ? Math.round((worked / rows.length) * 100) : 0,
  };
}
