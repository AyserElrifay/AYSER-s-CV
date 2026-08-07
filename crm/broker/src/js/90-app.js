/* ---------- dialog (bottom sheet on phones, centred on desktop) ---------- */
const scrim = document.getElementById("scrim");
const dlg = document.getElementById("dlg");
let onConfirmFn = null;

function openDialog(cfg) {
  onConfirmFn = cfg.onConfirm || null;
  dlg.innerHTML =
    '<div class="grab"></div>' +
    '<header><h2>' + esc(cfg.title || "") + "</h2>" +
    '<button class="iconbtn plain" data-act="close" aria-label="إغلاق">' + I.x + "</button></header>" +
    '<div class="body">' + (cfg.body || "") + "</div>" +
    (cfg.confirm
      ? '<div class="foot"><button class="btn accent" style="flex:1" id="dlgOk">' + esc(cfg.confirm) + "</button></div>"
      : "");
  scrim.classList.add("open");
  dlg.classList.add("open");
  document.body.style.overflow = "hidden";
  if (cfg.onMount) cfg.onMount(dlg);
  const ok = dlg.querySelector("#dlgOk");
  if (ok) ok.onclick = function () { if (!onConfirmFn || onConfirmFn(dlg) !== false) closeDialog(); };
}
function closeDialog() {
  scrim.classList.remove("open");
  dlg.classList.remove("open");
  document.body.style.overflow = "";
  onConfirmFn = null;
}
function confirmDialog(title, body, yes) {
  openDialog({
    title: title,
    body: '<p style="margin:0;color:var(--muted)">' + esc(body) + "</p>",
    confirm: "نعم، احذف",
    onConfirm: function () { yes(); return true; },
  });
}
scrim.addEventListener("click", closeDialog);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDialog(); });

/* ---------- toast ---------- */
let toastT;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), 2400);
}

/* ---------- theme ---------- */
function isDark() {
  const a = document.documentElement.getAttribute("data-theme");
  return a ? a === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}
function toggleTheme() {
  const next = isDark() ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("twelve_theme", next); } catch (e) {}
  paint();
}
(function () {
  try {
    const t = localStorage.getItem("twelve_theme");
    if (t) document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
})();

/* ---------- router ---------- */
let view = "packages";
let viewArg = null;

function go(v, arg) {
  view = v; viewArg = arg || null;
  closeDialog();
  paint();
  window.scrollTo(0, 0);
}

function paint() {
  const root = document.getElementById("root");

  if (!db.broker) {                    // one gate: no broker, no app
    document.getElementById("bar").innerHTML = "";
    root.innerHTML = renderAuth();
    hydrateIcons(root);
    wireAuth();
    return;
  }

  const onSheet = view === "sheet";
  const p = onSheet ? pkgById(viewArg) : null;

  document.getElementById("bar").innerHTML =
    (onSheet ? '<button class="iconbtn plain" data-act="go-packages" aria-label="رجوع">' + I.back + "</button>" : "") +
    '<div class="who"><h1>' + esc(onSheet && p ? p.name : "اشتراكاتي") + "</h1>" +
    '<div class="sub">' + esc(onSheet && p
      ? [p.area, p.source].filter(Boolean).join(" · ") || "شيت اتصال"
      : db.broker.name) + "</div></div>" +
    '<button class="iconbtn plain" data-act="theme" aria-label="المظهر">' + (isDark() ? I.sun : I.moon) + "</button>" +
    '<button class="iconbtn plain" data-act="signout" aria-label="خروج">' + I.out + "</button>";

  root.innerHTML = onSheet ? renderSheet(viewArg) : renderPackages();
  hydrateIcons(document);

  const q = document.getElementById("q");
  if (q) {
    q.addEventListener("input", function () {
      sheetQuery = q.value;
      const rows = document.querySelector(".rows");
      if (!rows) return;
      const tmp = document.createElement("div");
      tmp.innerHTML = renderSheet(viewArg);
      rows.replaceWith(tmp.querySelector(".rows"));   // keep focus in the box
      hydrateIcons(document);
    });
  }
  document.querySelectorAll("[data-f]").forEach(function (b) {
    b.onclick = function () { sheetFilter = b.dataset.f; paint(); };
  });
}

/* ---------- one delegated click handler for the whole app ---------- */
document.addEventListener("click", function (e) {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act, id = el.dataset.id;
  if (a === "close") return closeDialog();
  if (a === "theme") return toggleTheme();
  if (a === "signout") return confirmDialog("تسجيل الخروج؟", "بياناتك هتفضل محفوظة على الجهاز.", function () {
    db.broker = null; save(); go("packages");
  });
  if (a === "new-pkg") return openNewPackage();
  if (a === "del-pkg") return deletePackage(id);
  if (a === "open-pkg") { sheetFilter = "all"; sheetQuery = ""; return go("sheet", id); }
  if (a === "go-packages") return go("packages");
  if (a === "import") return openImport(id);
  if (a === "open-lead") return openLead(id);
  if (a === "next-call") return nextCall(id);
});

paint();
