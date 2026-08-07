/* The call sheet: the screen the broker actually lives in.
   One row per number, one tap to call or WhatsApp, one tap to set status. */
let sheetFilter = "all";
let sheetQuery = "";

function renderSheet(pid) {
  const p = pkgById(pid);
  if (!p) return '<div class="screen"><div class="empty"><h3>الاشتراك مش موجود</h3>' +
    '<button class="btn outline" data-act="go-packages">رجوع</button></div></div>';

  const all = pkgLeads(pid);
  if (!all.length) {
    return '<div class="screen"><div class="empty rise">' +
      '<div class="mark">' + compassMark("--bg") + "</div>" +
      "<h3>الصق الشيت</h3>" +
      "<p>انسخ الأعمدة من Excel أو Google Sheets والصقها هنا — هنقرأ الاسم والرقم تلقائياً.</p>" +
      '<button class="btn accent" data-act="import" data-id="' + pid + '">' + I.upload + " لصق البيانات</button>" +
      "</div></div>";
  }

  const s = pkgStats(pid);
  const q = sheetQuery.trim();
  let rows = all;
  if (sheetFilter === "todo") rows = rows.filter((l) => WORKED.indexOf(l.status) === -1);
  else if (sheetFilter !== "all") rows = rows.filter((l) => l.status === sheetFilter);
  if (q) rows = rows.filter((l) => (l.name + " " + l.phone + " " + (l.extra || "")).indexOf(q) > -1);

  const chips = [["all", "الكل"], ["todo", "لسه"]]
    .concat(STATUS.filter((st) => st.id !== "new").map((st) => [st.id, st.label]))
    .map(([v, l]) => '<button class="chip' + (sheetFilter === v ? " on" : "") +
      '" data-f="' + v + '">' + l + "</button>").join("");

  const list = rows.length
    ? rows.map(function (l) {
        const st = statusOf(l.status);
        const tel = telHref(l.phone), wa = waHref(l.phone);
        return '<div class="row' + (DONE.indexOf(l.status) > -1 ? " done" : "") + '">' +
          '<button class="row-main" data-act="open-lead" data-id="' + l.id + '">' +
            '<span class="row-name">' + esc(l.name) + "</span>" +
            '<span class="row-meta"><span class="pill ' + st.pill + '">' + st.label + "</span>" +
              (l.phone ? '<span dir="ltr" class="tnum">' + esc(l.phone) + "</span>" : "") +
            "</span>" +
          "</button>" +
          '<div class="row-acts">' +
            (tel ? '<a class="iconbtn call" href="' + tel + '" aria-label="اتصال">' + I.phone + "</a>" : "") +
            (wa ? '<a class="iconbtn wa" href="' + wa + '" target="_blank" rel="noopener" aria-label="واتساب">' + I.chat + "</a>" : "") +
          "</div>" +
        "</div>";
      }).join("")
    : '<div class="empty" style="padding:34px 18px"><p style="margin:0">مفيش نتائج للفلتر ده.</p></div>';

  return '<div class="screen">' +
    '<div class="sheet-head">' +
      '<div class="sheet-stats">' +
        '<div class="stat"><b class="tnum">' + fmtNum(s.left) + "</b><span>باقي</span></div>" +
        '<div class="stat"><b class="tnum">' + fmtNum(s.interested) + "</b><span>مهتم</span></div>" +
        '<div class="stat"><b class="tnum">' + fmtNum(s.closed) + "</b><span>بيع</span></div>" +
      "</div>" +
      '<div class="bar"><i style="width:' + s.pct + '%"></i></div>' +
      '<input class="input" id="q" placeholder="بحث بالاسم أو الرقم…" value="' + esc(sheetQuery) + '">' +
      '<div class="chiprow">' + chips + "</div>" +
    "</div>" +
    '<div class="rows">' + list + "</div>" +
  "</div>" +
  '<div class="actionbar">' +
    '<button class="btn outline" data-act="import" data-id="' + pid + '">' + I.upload + " لصق</button>" +
    '<button class="btn accent" data-act="next-call" data-id="' + pid + '">' + I.phone + " التالي</button>" +
  "</div>";
}

/* Open one lead: set status, keep a note, call or message. */
function openLead(id) {
  const l = db.leads.find((x) => x.id === id);
  if (!l) return;
  const tel = telHref(l.phone), wa = waHref(l.phone);

  openDialog({
    title: l.name,
    body:
      (l.phone ? '<div dir="ltr" class="tnum" style="font-size:19px;font-weight:650">' + esc(l.phone) + "</div>" : "") +
      (l.extra ? '<div class="hint">' + esc(l.extra) + "</div>" : "") +
      '<div style="display:flex;gap:10px">' +
        (tel ? '<a class="btn accent" style="flex:1" href="' + tel + '">' + I.phone + " اتصال</a>" : "") +
        (wa ? '<a class="btn outline" style="flex:1" href="' + wa + '" target="_blank" rel="noopener">' + I.chat + " واتساب</a>" : "") +
      "</div>" +
      '<div class="field"><label>الحالة</label><div class="statusgrid" id="sg">' +
        STATUS.map((st) => '<button type="button" data-s="' + st.id + '"' +
          (l.status === st.id ? ' class="on"' : "") + ">" + st.label + "</button>").join("") +
      "</div></div>" +
      '<div class="field"><label for="nt">ملاحظة</label>' +
        '<textarea class="input" id="nt" style="min-height:88px" placeholder="نتيجة المكالمة…">' + esc(l.note || "") + "</textarea></div>",
    confirm: "حفظ",
    onMount: function (d) {
      d.querySelectorAll("#sg button").forEach(function (b) {
        b.onclick = function () {
          d.querySelectorAll("#sg button").forEach((x) => x.classList.remove("on"));
          b.classList.add("on");
        };
      });
    },
    onConfirm: function (d) {
      const on = d.querySelector("#sg button.on");
      l.status = on ? on.dataset.s : l.status;
      l.note = d.querySelector("#nt").value.trim();
      l.updatedAt = Date.now();
      save(); paint(); toast("اتحفظ");
      return true;
    },
  });
}

/* Jump straight to the next untouched number — the whole point of a call sheet. */
function nextCall(pid) {
  const next = pkgLeads(pid).find((l) => WORKED.indexOf(l.status) === -1);
  if (!next) return toast("خلصت الشيت كله 🎉");
  openLead(next.id);
}

/* Work out exactly what an import would do, so the preview can promise the
   same number the confirm actually writes (duplicates included). */
function planImport(pid, text) {
  const r = parseSheet(text);
  const seen = {};
  pkgLeads(pid).forEach((l) => { if (l.phone) seen[l.phone.replace(/\D/g, "")] = 1; });
  const add = [];
  let dupes = 0;
  r.rows.forEach(function (x) {
    const key = (x.phone || "").replace(/\D/g, "");
    if (key && seen[key]) { dupes++; return; }
    if (key) seen[key] = 1;
    add.push(x);
  });
  return { add: add, dupes: dupes, skipped: r.skipped };
}

/* Paste-import. Shows what was understood before writing anything. */
function openImport(pid) {
  openDialog({
    title: "لصق الشيت",
    body:
      '<div class="note">' + I.info + "<span>انسخ الأعمدة من Excel والصقها هنا. هنحدد الاسم والرقم تلقائياً، وتقدر تراجع قبل الحفظ.</span></div>" +
      '<textarea class="input" id="paste" placeholder="أحمد سمير&#9;01012345678&#10;منى خالد&#9;01198765432"></textarea>' +
      '<div id="pv"></div>',
    confirm: "استيراد",
    onMount: function (d) {
      const ta = d.querySelector("#paste"), pv = d.querySelector("#pv");
      const refresh = function () {
        const plan = planImport(pid, ta.value);
        if (!plan.add.length && !plan.dupes) { pv.innerHTML = ""; return; }
        const sample = plan.add.slice(0, 4).map((x) =>
          "<tr><td>" + esc(x.name) + '</td><td dir="ltr">' + esc(x.phone) + "</td></tr>").join("");
        const notes = [];
        if (plan.dupes) notes.push(fmtNum(plan.dupes) + " مكرر");
        if (plan.skipped) notes.push(fmtNum(plan.skipped) + " سطر فاضي");
        pv.innerHTML = '<div class="hint" style="margin-bottom:7px">هيتسجّل <b>' + fmtNum(plan.add.length) +
          "</b> رقم" + (notes.length ? " · هيتشال " + notes.join(" و") : "") + "</div>" +
          (sample
            ? '<div class="preview"><div class="preview-wrap"><table><thead><tr><th>الاسم</th><th>الرقم</th></tr></thead>' +
              "<tbody>" + sample + "</tbody></table></div></div>"
            : "");
      };
      ta.addEventListener("input", refresh);
      setTimeout(() => ta.focus(), 60);
    },
    onConfirm: function (d) {
      const plan = planImport(pid, d.querySelector("#paste").value);
      if (!plan.add.length) {
        toast(plan.dupes ? "كل الأرقام دي موجودة بالفعل" : "مفيش بيانات صالحة");
        return false;
      }
      plan.add.forEach(function (x) {
        db.leads.push({
          id: uid(), packageId: pid, name: x.name, phone: x.phone,
          extra: x.extra, status: "new", note: "", createdAt: Date.now(),
        });
      });
      save(); paint();
      toast("اتضاف " + fmtNum(plan.add.length) + " رقم" +
        (plan.dupes ? " · " + fmtNum(plan.dupes) + " مكرر اتشال" : ""));
      return true;
    },
  });
}
