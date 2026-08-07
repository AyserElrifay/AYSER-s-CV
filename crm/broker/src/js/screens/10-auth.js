/* Sign-in. This app has exactly one kind of user: the broker.
   No roles, no admin console, no company portals. */
function renderAuth() {
  return '' +
  '<div class="auth rise">' +
    '<div class="auth-mark">' + compassMark("--bg") + '</div>' +
    '<div>' +
      '<div class="word">T W E L V E</div>' +
      '<h1>شيت الاتصال بتاعك،<br>في مكان واحد.</h1>' +
      '<p class="lede">سجّل دخولك، اشترك في داتا، وابدأ اتصل. من غير تعقيد.</p>' +
    '</div>' +
    '<form id="authForm">' +
      '<div class="field">' +
        '<label for="bn">اسمك</label>' +
        '<input class="input" id="bn" name="bn" autocomplete="name" placeholder="مثال: أحمد سمير" required>' +
      '</div>' +
      '<div class="field">' +
        '<label for="bp">رقم موبايلك</label>' +
        '<input class="input" id="bp" name="bp" type="tel" inputmode="tel" dir="ltr" autocomplete="tel" placeholder="01xxxxxxxxx" required>' +
      '</div>' +
      '<button class="btn accent full" type="submit">دخول</button>' +
    '</form>' +
    '<p class="legal">بياناتك تُحفظ على جهازك وحده. لا تُرسل لأي خادم.</p>' +
  '</div>';
}

function wireAuth() {
  const f = document.getElementById("authForm");
  if (!f) return;
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    const name = f.bn.value.trim();
    const phone = f.bp.value.trim();
    if (!name) return f.bn.focus();
    if (!phone) return f.bp.focus();
    db.broker = { name: name, phone: phone, since: Date.now() };
    save();
    go("packages");
    toast("أهلاً " + name.split(/\s+/)[0]);
  });
}
