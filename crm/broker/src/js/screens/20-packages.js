/* The broker's data subscriptions. Each one is a sheet they bought /
   were given; opening it is what starts the calling work. */
function renderPackages() {
  if (!db.packages.length) {
    return '<div class="screen"><div class="empty rise">' +
      '<div class="mark">' + compassMark("--bg") + "</div>" +
      "<h3>ابدأ باشتراك داتا</h3>" +
      "<p>اشترك في داتا، الصق الشيت اللي وصلك، وهيفتحلك جاهز تتصل منه.</p>" +
      '<button class="btn accent" data-act="new-pkg">' + I.plus + " اشتراك جديد</button>" +
      "</div></div>";
  }

  const cards = db.packages
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(function (p) {
      const s = pkgStats(p.id);
      return '<div class="card pk rise">' +
        '<div class="pk-top">' +
          "<div>" +
            '<div class="pk-name">' + esc(p.name) + "</div>" +
            '<div class="pk-meta">' + esc([p.area, p.source].filter(Boolean).join(" · ") || "بدون تفاصيل") +
              " · " + agoLabel(p.createdAt) + "</div>" +
          "</div>" +
          '<div class="pk-nums"><b class="tnum">' + fmtNum(s.total) + "</b><span>رقم</span></div>" +
        "</div>" +
        (s.total
          ? '<div class="pk-progress">' +
              '<div class="lbl"><span>تم التواصل ' + fmtNum(s.worked) + " من " + fmtNum(s.total) + "</span>" +
              '<span class="tnum">' + s.pct + "%</span></div>" +
              '<div class="bar"><i style="width:' + s.pct + '%"></i></div>' +
            "</div>"
          : '<div class="hint">لسه فاضي — الصق الشيت عشان تبدأ.</div>') +
        '<div style="display:flex;gap:9px">' +
          '<button class="btn sm accent" style="flex:1" data-act="open-pkg" data-id="' + p.id + '">' +
            (s.total ? "افتح الشيت" : "الصق الشيت") + "</button>" +
          '<button class="iconbtn" data-act="del-pkg" data-id="' + p.id + '" aria-label="حذف">' + I.trash + "</button>" +
        "</div>" +
      "</div>";
    })
    .join("");

  return '<div class="screen"><div class="stack">' + cards + "</div></div>" +
    '<div class="actionbar"><button class="btn accent" data-act="new-pkg">' + I.plus + " اشتراك جديد</button></div>";
}

function openNewPackage() {
  openDialog({
    title: "اشتراك داتا جديد",
    body:
      '<div class="field"><label for="pn">اسم الاشتراك</label>' +
      '<input class="input" id="pn" placeholder="مثال: التجمع الخامس — يناير" required></div>' +
      '<div class="field"><label for="pa">المنطقة</label>' +
      '<input class="input" id="pa" placeholder="اختياري — مثال: التجمع الخامس"></div>' +
      '<div class="field"><label for="ps">المصدر</label>' +
      '<input class="input" id="ps" placeholder="اختياري — مثال: حملة فيسبوك"></div>',
    confirm: "إنشاء",
    onConfirm: function (d) {
      const name = d.querySelector("#pn").value.trim();
      if (!name) { d.querySelector("#pn").focus(); return false; }
      const p = {
        id: uid(), name: name,
        area: d.querySelector("#pa").value.trim(),
        source: d.querySelector("#ps").value.trim(),
        createdAt: Date.now(),
      };
      db.packages.push(p);
      save();
      go("sheet", p.id);
      toast("تم إنشاء الاشتراك — الصق الشيت");
      return true;
    },
  });
}

function deletePackage(id) {
  const p = pkgById(id);
  if (!p) return;
  const n = pkgLeads(id).length;
  confirmDialog(
    "حذف «" + p.name + "»؟",
    n ? "هيتشال معاه " + fmtNum(n) + " رقم." : "مفيش أرقام فيه.",
    function () {
      db.packages = db.packages.filter((x) => x.id !== id);
      db.leads = db.leads.filter((l) => l.packageId !== id);
      save(); paint(); toast("تم الحذف");
    }
  );
}
