/* ═══════════════════════════════════════════════════
   Ayser AI — App (views, routing, interactions)
   ═══════════════════════════════════════════════════ */

(() => {
  const S = Store.load();
  setLang(S.settings.language);
  applyTheme();

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  const esc = (s) => String(s == null ? "" : s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 2600);
  }

  function applyTheme() {
    document.documentElement.dataset.theme = S.settings.theme;
  }

  /* ════════════ Icons ════════════ */
  const IC = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>',
    coach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a8 8 0 1 0-3.1 6.3L21 19l-.9-3.4A8 8 0 0 0 21 12z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" stroke-linecap="round" stroke-width="2.4"/></svg>',
    pages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5M9 13h6M9 17h6"/></svg>',
    projects: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/></svg>',
    library: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
    plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1z"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  };

  const HABITS = [
    { id: "fajr", ico: "🕌" }, { id: "dhuhr", ico: "🕌" }, { id: "asr", ico: "🕌" },
    { id: "maghrib", ico: "🕌" }, { id: "isha", ico: "🕌" },
    { id: "workout", ico: "💪" }, { id: "food", ico: "🥗" }, { id: "sleep", ico: "😴" },
    { id: "study", ico: "📖" }, { id: "work", ico: "🎯" },
  ];

  const VIEWS = ["coach", "today", "pages", "projects", "library", "plan", "settings"];

  /* ════════════ Onboarding ════════════ */

  /* Steve Jobs rule: remove everything that isn't essential.
     The coach asks the deeper questions naturally, inside the chat. */
  const OB_STEPS = ["welcome", "lang", "name", "goal", "done"];
  let obStep = 0;
  const obData = { values: [], focus: [] };

  function showOnboarding() {
    $("#onboarding").classList.remove("hidden");
    $("#app").classList.add("hidden");
    renderOb();
  }

  function renderOb() {
    const step = OB_STEPS[obStep];
    const wrap = $("#onboarding");
    const prog = OB_STEPS.slice(1, -1).map((_, i) =>
      `<i class="${i < obStep ? "on" : ""}"></i>`).join("");

    let inner = "";
    if (step === "welcome") {
      inner = `
        <div class="ob-step-label">بردي · Bardi</div>
        <h1 class="ob-title">${esc(t("ob_welcome_title"))}</h1>
        <p class="ob-sub">${esc(t("ob_welcome_sub"))}</p>
        <div class="ob-actions"><button class="btn" data-ob="next">${esc(t("ob_start"))}</button></div>`;
    } else if (step === "lang") {
      inner = `
        <div class="ob-progress">${prog}</div>
        <h1 class="ob-title">${esc(t("ob_lang_title"))}</h1>
        <div class="ob-lang-grid">
          <button class="ob-lang-btn" data-lang="ar">العربية <small>Arabic</small></button>
          <button class="ob-lang-btn" data-lang="en">English <small>English</small></button>
          <button class="ob-lang-btn" data-lang="fr">Français <small>French</small></button>
        </div>`;
    } else if (step === "name" || step === "contact" || step === "goal" || step === "why") {
      const key = step;
      const isArea = step === "goal" || step === "why";
      inner = `
        <div class="ob-progress">${prog}</div>
        <h1 class="ob-title">${esc(t("ob_" + key + "_title"))}</h1>
        <p class="ob-sub">${esc(t("ob_" + key + "_sub"))}</p>
        <div class="ob-field">
          ${isArea
            ? `<textarea id="obInput" class="input" rows="3" placeholder="${esc(t("ob_" + key + "_ph"))}">${esc(obData[key] || "")}</textarea>`
            : `<input id="obInput" class="input" placeholder="${esc(t("ob_" + key + "_ph"))}" value="${esc(obData[key] || "")}">`}
        </div>
        <div class="ob-actions">
          <button class="btn" data-ob="next">${esc(t("ob_next"))}</button>
          <button class="btn ghost" data-ob="back">${esc(t("ob_back"))}</button>
        </div>`;
    } else if (step === "values" || step === "focus") {
      const list = t(step === "values" ? "values_list" : "focus_list");
      const sel = obData[step];
      inner = `
        <div class="ob-progress">${prog}</div>
        <h1 class="ob-title">${esc(t("ob_" + step + "_title"))}</h1>
        ${step === "values" ? `<p class="ob-sub">${esc(t("ob_values_sub"))}</p>` : ""}
        <div class="ob-chips">
          ${list.map(v => `<button class="chip ${sel.includes(v) ? "active" : ""}" data-chip="${esc(v)}">${esc(v)}</button>`).join("")}
        </div>
        <div class="ob-actions">
          <button class="btn" data-ob="next">${esc(t("ob_next"))}</button>
          <button class="btn ghost" data-ob="back">${esc(t("ob_back"))}</button>
        </div>`;
    } else if (step === "done") {
      inner = `
        <div class="ob-step-label">بردي · Bardi</div>
        <h1 class="ob-title">${esc(t("ob_done_title", { name: obData.name || "" }))}</h1>
        <p class="ob-sub">${esc(t("ob_done_sub"))}</p>
        <div class="ob-actions"><button class="btn" data-ob="finish">${esc(t("ob_finish"))}</button></div>`;
    }

    wrap.innerHTML = `<div class="ob-card">${inner}</div>`;

    $$("[data-lang]", wrap).forEach(b => b.addEventListener("click", () => {
      S.settings.language = b.dataset.lang;
      setLang(b.dataset.lang);
      Store.save();
      obStep++;
      renderOb();
    }));

    $$("[data-chip]", wrap).forEach(b => b.addEventListener("click", () => {
      const v = b.dataset.chip;
      const arr = obData[OB_STEPS[obStep]];
      const i = arr.indexOf(v);
      if (i >= 0) arr.splice(i, 1);
      else {
        if (OB_STEPS[obStep] === "values" && arr.length >= 3) arr.shift();
        arr.push(v);
      }
      b.classList.toggle("active");
      renderOb();
    }));

    $$("[data-ob]", wrap).forEach(b => b.addEventListener("click", () => {
      const act = b.dataset.ob;
      if (act === "back") { obStep = Math.max(0, obStep - 1); renderOb(); return; }
      const input = $("#obInput", wrap);
      if (input) obData[OB_STEPS[obStep]] = input.value.trim();
      if (act === "finish") { finishOb(); return; }
      obStep++;
      renderOb();
    }));

    const input = $("#obInput", wrap);
    if (input) {
      input.focus();
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && input.tagName === "INPUT") {
          e.preventDefault();
          $('[data-ob="next"]', wrap).click();
        }
      });
    }
  }

  function finishOb() {
    Object.assign(S.profile, {
      onboarded: true,
      name: obData.name || "",
      contact: obData.contact || "",
      goal: obData.goal || "",
      why: obData.why || "",
      values: obData.values,
      focus: obData.focus,
    });
    Store.save();
    $("#onboarding").classList.add("hidden");
    startApp();
  }

  /* ════════════ Shell / routing ════════════ */

  let view = "coach";
  let openPageId = null;

  function startApp() {
    $("#app").classList.remove("hidden");
    renderNav();
    go(location.hash.replace("#/", "") || "coach");
  }

  function go(v) {
    view = VIEWS.includes(v) ? v : "coach";
    openPageId = null;
    location.hash = "/" + view;
    renderNav();
    render();
  }

  window.addEventListener("hashchange", () => {
    const v = location.hash.replace("#/", "");
    if (v !== view && VIEWS.includes(v)) { view = v; openPageId = null; renderNav(); render(); }
  });

  function renderNav() {
    const tools = ["today", "pages", "projects", "library", "plan", "settings"];

    const chatList = S.chats.slice(0, 20).map(c => `
      <div class="chat-item ${view === "coach" && c.id === S.activeChatId ? "active" : ""}" data-chat="${c.id}">
        <span class="c-title">${esc(c.title || t("untitled_chat"))}</span>
        <button class="c-del" data-cdel="${c.id}" title="${esc(t("delete_chat"))}">✕</button>
      </div>`).join("");

    $("#nav").innerHTML = `
      <button class="new-chat-btn" id="navNewChat">＋ ${esc(t("new_chat"))}</button>
      ${S.chats.length ? `<div class="nav-label">${esc(t("chats_label"))}</div><div class="chat-list">${chatList}</div>` : ""}
      <div class="nav-label">${esc(t("tools_label"))}</div>
      ${tools.map(v => `<button class="nav-item ${v === view ? "active" : ""}" data-go="${v}">${IC[v]}<span>${esc(t("nav_" + v))}</span></button>`).join("")}`;

    $("#tabbar").innerHTML = ["coach", "today", "pages", "projects", "settings"].map(v =>
      `<button class="tab-item ${v === view ? "active" : ""}" data-go="${v}">${IC[v]}<span>${esc(t("nav_" + v))}</span></button>`).join("");

    $("#sidebarFooter").innerHTML = `🔒 ${esc(t("made_with"))}`;

    $$("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
    $("#navNewChat").addEventListener("click", () => { newChat(); go("coach"); });
    $$("[data-chat]").forEach(el => el.addEventListener("click", () => {
      S.activeChatId = el.dataset.chat; Store.save(); go("coach");
    }));
    $$("[data-cdel]").forEach(b => b.addEventListener("click", (e) => {
      e.stopPropagation();
      S.chats = S.chats.filter(c => c.id !== b.dataset.cdel);
      if (S.activeChatId === b.dataset.cdel) S.activeChatId = null;
      Store.save(); renderNav(); if (view === "coach") render();
    }));
  }

  /* ── chat helpers ── */
  function activeChat() {
    return S.chats.find(c => c.id === S.activeChatId) || null;
  }
  function newChat() {
    S.activeChatId = null;
    Store.save();
  }
  function ensureChat() {
    let c = activeChat();
    if (!c) {
      c = { id: Store.uid(), title: "", messages: [], updatedAt: Date.now() };
      S.chats.unshift(c);
      S.activeChatId = c.id;
    }
    return c;
  }

  function render() {
    const main = $("#main");
    if (view === "today") return renderToday(main);
    if (view === "coach") return renderCoach(main);
    if (view === "pages") return openPageId ? renderEditor(main) : renderPages(main);
    if (view === "projects") return renderProjects(main);
    if (view === "library") return renderLibrary(main);
    if (view === "plan") return renderPlan(main);
    if (view === "settings") return renderSettings(main);
  }

  /* ════════════ Today ════════════ */

  function renderToday(main) {
    const today = Store.todayKey();
    const tasks = S.tasks.filter(x => x.date === today);
    const log = S.habitLog[today] || {};
    const doneHabits = HABITS.filter(h => log[h.id]).length;
    const doneTasks = tasks.filter(x => x.done).length;
    const total = HABITS.length + tasks.length;
    const done = doneHabits + doneTasks;
    const pct = total ? Math.round(done / total * 100) : 0;
    const R = 34, C = 2 * Math.PI * R;

    const dateStr = new Date().toLocaleDateString(localeOf(), { weekday: "long", day: "numeric", month: "long" });

    main.innerHTML = `
      <div class="view-head">
        <h1 class="view-title">${esc(t("today_title"))}</h1>
        <p class="view-sub">${esc(dateStr)}</p>
      </div>

      <div class="coach-line">
        <div class="avatar">A</div>
        <p><b>${esc(t("coach_says"))}</b>${esc(t("daily_quote", { name: S.profile.name || "✦", goal: S.profile.goal || "…" }))}</p>
      </div>

      <div class="today-grid">
        <div>
          <div class="card">
            <div class="section-label" style="margin-top:0">${esc(t("tasks_label"))}</div>
            <div id="taskList">
              ${tasks.length ? tasks.map(x => `
                <div class="task-row ${x.done ? "done" : ""}" data-task="${x.id}">
                  <button class="check ${x.done ? "on" : ""}" data-toggle="${x.id}">✓</button>
                  <span class="task-title">${esc(x.title)}</span>
                  <button class="task-del" data-del="${x.id}">✕</button>
                </div>`).join("")
                : `<p style="color:var(--text-3);padding:10px 4px">${esc(t("no_tasks"))}</p>`}
            </div>
            <div class="add-row">
              <input id="newTask" class="input" placeholder="${esc(t("add_task_ph"))}">
              <button id="addTask" class="btn small">${esc(t("add"))}</button>
            </div>
          </div>
        </div>

        <div>
          <div class="card" style="margin-bottom:20px">
            <div class="progress-ring-wrap">
              <svg class="progress-ring" width="84" height="84">
                <circle class="track" cx="42" cy="42" r="${R}" fill="none" stroke-width="8"/>
                <circle class="fill" cx="42" cy="42" r="${R}" fill="none" stroke-width="8"
                  stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}"/>
              </svg>
              <div>
                <div class="ring-num">${pct}%</div>
                <div class="ring-label">${esc(t("day_progress"))}</div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="section-label" style="margin-top:0">${esc(t("habits_label"))}</div>
            ${HABITS.map(h => `
              <div class="habit-row">
                <span class="h-ico">${h.ico}</span>
                <span class="h-name">${esc(t("habit_" + h.id))}</span>
                <button class="check ${log[h.id] ? "on" : ""}" data-habit="${h.id}">✓</button>
              </div>`).join("")}
          </div>
        </div>
      </div>`;

    const addTask = () => {
      const inp = $("#newTask");
      const v = inp.value.trim();
      if (!v) return;
      S.tasks.push({ id: Store.uid(), title: v, done: false, date: today });
      Store.save(); render();
    };
    $("#addTask").addEventListener("click", addTask);
    $("#newTask").addEventListener("keydown", e => { if (e.key === "Enter") addTask(); });

    $$("[data-toggle]").forEach(b => b.addEventListener("click", () => {
      const x = S.tasks.find(x => x.id === b.dataset.toggle);
      x.done = !x.done; Store.save(); render();
    }));
    $$("[data-del]").forEach(b => b.addEventListener("click", () => {
      S.tasks = S.tasks.filter(x => x.id !== b.dataset.del);
      Store.save(); render();
    }));
    $$("[data-habit]").forEach(b => b.addEventListener("click", () => {
      const log2 = S.habitLog[today] || (S.habitLog[today] = {});
      log2[b.dataset.habit] = !log2[b.dataset.habit];
      Store.save(); render();
    }));
  }

  /* ════════════ Coach ════════════ */

  let sending = false;

  function renderCoach(main) {
    const c = activeChat();
    const msgs = c ? c.messages : [];

    main.innerHTML = `
      <div class="chat-wrap chat-first">
        <div class="chat-scroll" id="chatScroll">
          <div class="chat-col">
            ${msgs.length ? msgs.map(m => msgHTML(m)).join("") : `
              <div class="chat-empty">
                <div class="hero-mark">ب</div>
                <h2 class="hero-title">${esc(t("coach_empty_hi", { name: S.profile.name || "" }))}</h2>
                <p class="hero-sub">${esc(t("coach_empty_sub"))}</p>
                <div class="chat-suggestions">
                  ${["sug1","sug2","sug3","sug4"].map(k => `<button class="chip" data-sug>${esc(t(k))}</button>`).join("")}
                </div>
              </div>`}
          </div>
        </div>
        <div class="chat-input-area">
          <div class="chat-input-bar">
            <textarea id="chatInput" rows="1" placeholder="${esc(t("chat_ph"))}"></textarea>
            <button class="send-btn" id="sendBtn">➤</button>
          </div>
          <div class="provider-row center">
            ${["claude", "openai", "gemini"].map(p => `
              <button class="chip tiny ${p === S.settings.provider ? "active" : ""}" data-provider="${p}">${AI.PROVIDER_NAMES[p]}</button>`).join("")}
          </div>
        </div>
      </div>`;

    const scroll = $("#chatScroll");
    scroll.scrollTop = scroll.scrollHeight;

    $$("[data-provider]").forEach(b => b.addEventListener("click", () => {
      S.settings.provider = b.dataset.provider; Store.save(); render();
    }));
    $$("[data-sug]").forEach(b => b.addEventListener("click", () => sendMsg(b.textContent.trim())));

    const input = $("#chatInput");
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 130) + "px";
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(input.value); }
    });
    $("#sendBtn").addEventListener("click", () => sendMsg(input.value));
    input.focus();
  }

  function msgHTML(m) {
    if (m.role === "user") return `<div class="msg user">${esc(m.content)}</div>`;
    return `
      <div class="msg-row">
        <div class="avatar">ب</div>
        <div class="msg assistant">${esc(m.content)}</div>
      </div>`;
  }

  async function sendMsg(text) {
    text = (text || "").trim();
    if (!text || sending) return;

    const scroll = $("#chatScroll");
    const col = $(".chat-col", scroll);

    const key = (S.settings.keys[S.settings.provider] || "").trim();
    if (!key) {
      col.insertAdjacentHTML("beforeend",
        `<div class="msg-row"><div class="avatar">ب</div><div class="msg assistant">${esc(t("no_key_msg"))}</div></div>
         <div style="margin-top:8px"><button class="btn small" data-go="settings">${esc(t("go_settings"))}</button></div>`);
      $$("[data-go]", col).forEach(b => b.addEventListener("click", () => go("settings")));
      scroll.scrollTop = scroll.scrollHeight;
      return;
    }

    sending = true;
    const chat = ensureChat();
    chat.messages.push({ role: "user", content: text });
    if (!chat.title) chat.title = text.slice(0, 42);
    chat.updatedAt = Date.now();
    Store.save();
    renderNav(); // refresh chat list titles

    const empty = $(".chat-empty", col);
    if (empty) empty.remove();
    col.insertAdjacentHTML("beforeend", msgHTML({ role: "user", content: text }));
    col.insertAdjacentHTML("beforeend",
      `<div class="msg-row"><div class="avatar">ب</div><div class="msg assistant thinking" id="live"><i></i><i></i><i></i></div></div>`);
    scroll.scrollTop = scroll.scrollHeight;
    const inp = $("#chatInput");
    if (inp) { inp.value = ""; inp.style.height = "auto"; }

    const live = $("#live");
    try {
      const full = await AI.chat(S, chat.messages.slice(-24), (sofar) => {
        live.classList.remove("thinking");
        live.textContent = sofar;
        scroll.scrollTop = scroll.scrollHeight;
      });

      const { clean, memory } = AI.extractMemory(full);
      live.classList.remove("thinking");
      live.textContent = clean;
      live.removeAttribute("id");
      chat.messages.push({ role: "assistant", content: clean });
      chat.updatedAt = Date.now();
      if (memory) {
        S.memory.push(memory);
        toast(t("learned"));
      }
      Store.save();
    } catch (err) {
      const msg = err.message === "NO_KEY" ? t("no_key_msg") : t("ai_error", { err: err.message });
      live.classList.remove("thinking");
      live.textContent = msg;
      live.removeAttribute("id");
      // don't persist the failed turn's assistant message; keep user msg
    } finally {
      sending = false;
      scroll.scrollTop = scroll.scrollHeight;
    }
  }

  /* ════════════ Pages ════════════ */

  function renderPages(main) {
    main.innerHTML = `
      <div class="view-head">
        <h1 class="view-title">${esc(t("pages_title"))}</h1>
        <p class="view-sub">${esc(t("pages_sub"))}</p>
      </div>
      <button class="btn" id="newPage">＋ ${esc(t("new_page"))}</button>
      <div class="section-label"></div>
      ${S.pages.length ? `
        <div class="pages-grid">
          ${S.pages.map(p => `
            <div class="page-card" data-open="${p.id}">
              <h3>${esc(p.title || t("untitled"))}</h3>
              <div class="meta">${esc(t("edited"))} · ${new Date(p.updatedAt).toLocaleDateString(localeOf())}</div>
            </div>`).join("")}
        </div>` : `<p style="color:var(--text-3)">${esc(t("no_pages"))}</p>`}`;

    $("#newPage").addEventListener("click", () => {
      const p = { id: Store.uid(), title: "", blocks: [{ id: Store.uid(), type: "p", text: "", done: false }], updatedAt: Date.now() };
      S.pages.unshift(p); Store.save();
      openPageId = p.id; render();
    });
    $$("[data-open]").forEach(c => c.addEventListener("click", () => { openPageId = c.dataset.open; render(); }));
  }

  function renderEditor(main) {
    const p = S.pages.find(x => x.id === openPageId);
    if (!p) { openPageId = null; return render(); }

    main.innerHTML = `
      <button class="back-link" id="backPages">← ${esc(t("back"))}</button>
      <input class="editor-title" id="pTitle" placeholder="${esc(t("page_title_ph"))}" value="${esc(p.title)}">
      <div id="blocks">
        ${p.blocks.map(b => blockHTML(b)).join("")}
      </div>
      <div class="editor-toolbar">
        <button class="chip" data-add="p">＋ ${esc(t("add_text"))}</button>
        <button class="chip" data-add="h">＋ ${esc(t("add_heading"))}</button>
        <button class="chip" data-add="todo">＋ ${esc(t("add_todo"))}</button>
        <button class="chip" data-add="bullet">＋ ${esc(t("add_bullet"))}</button>
        <span style="flex:1"></span>
        <button class="chip" id="delPage" style="color:var(--accent)">🗑 ${esc(t("delete_page"))}</button>
      </div>`;

    const saveNow = () => { p.updatedAt = Date.now(); Store.save(); };

    $("#backPages").addEventListener("click", () => { openPageId = null; render(); });
    $("#pTitle").addEventListener("input", (e) => { p.title = e.target.value; saveNow(); });
    $("#delPage").addEventListener("click", () => {
      if (!confirm(t("delete_confirm"))) return;
      S.pages = S.pages.filter(x => x.id !== p.id);
      Store.save(); openPageId = null; render();
    });

    $$("[data-add]").forEach(b => b.addEventListener("click", () => {
      p.blocks.push({ id: Store.uid(), type: b.dataset.add, text: "", done: false });
      saveNow(); render();
      const els = $$(".b-content"); els[els.length - 1] && els[els.length - 1].focus();
    }));

    bindBlocks(p, saveNow);
  }

  function blockHTML(b) {
    const cls = b.type === "h" ? "h" : b.type === "bullet" ? "bullet" : b.type === "todo" ? "todo" + (b.done ? " done" : "") : "";
    const check = b.type === "todo" ? `<button class="check ${b.done ? "on" : ""}" data-bcheck="${b.id}">✓</button>` : "";
    return `
      <div class="block ${cls}" data-block="${b.id}">
        <button class="b-handle" data-bdel="${b.id}" title="✕">✕</button>
        ${check}
        <div class="b-content" contenteditable="true" data-ph="${esc(t("block_ph"))}" data-bid="${b.id}">${esc(b.text)}</div>
      </div>`;
  }

  function bindBlocks(p, saveNow) {
    $$(".b-content").forEach(el => {
      el.addEventListener("input", () => {
        const b = p.blocks.find(x => x.id === el.dataset.bid);
        if (b) { b.text = el.textContent; saveNow(); }
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const b = p.blocks.find(x => x.id === el.dataset.bid);
          const i = p.blocks.indexOf(b);
          p.blocks.splice(i + 1, 0, { id: Store.uid(), type: b.type === "h" ? "p" : b.type, text: "", done: false });
          saveNow(); render();
          const next = $(`[data-bid="${p.blocks[i + 1].id}"]`);
          next && next.focus();
        }
        if (e.key === "Backspace" && el.textContent === "" && p.blocks.length > 1) {
          e.preventDefault();
          const b = p.blocks.find(x => x.id === el.dataset.bid);
          const i = p.blocks.indexOf(b);
          p.blocks.splice(i, 1);
          saveNow(); render();
          const prev = $$(".b-content")[Math.max(0, i - 1)];
          prev && prev.focus();
        }
      });
    });
    $$("[data-bcheck]").forEach(btn => btn.addEventListener("click", () => {
      const b = p.blocks.find(x => x.id === btn.dataset.bcheck);
      b.done = !b.done; saveNow(); render();
    }));
    $$("[data-bdel]").forEach(btn => btn.addEventListener("click", () => {
      p.blocks = p.blocks.filter(x => x.id !== btn.dataset.bdel);
      if (!p.blocks.length) p.blocks.push({ id: Store.uid(), type: "p", text: "", done: false });
      saveNow(); render();
    }));
  }

  /* ════════════ Projects (kanban) ════════════ */

  let activeProject = null;

  function renderProjects(main) {
    if (S.projects.length && !S.projects.find(x => x.id === activeProject)) activeProject = S.projects[0].id;
    const proj = S.projects.find(x => x.id === activeProject);

    main.innerHTML = `
      <div class="view-head">
        <h1 class="view-title">${esc(t("projects_title"))}</h1>
        <p class="view-sub">${esc(t("projects_sub"))}</p>
      </div>
      <div class="project-tabs">
        ${S.projects.map(pr => `<button class="chip ${pr.id === activeProject ? "active" : ""}" data-proj="${pr.id}">${esc(pr.name)}</button>`).join("")}
        <button class="chip" id="newProj">＋ ${esc(t("new_project"))}</button>
      </div>
      ${proj ? boardHTML(proj) : `<p style="color:var(--text-3)">${esc(t("no_projects"))}</p>`}`;

    $("#newProj").addEventListener("click", () => {
      const name = prompt(t("project_name_ph"));
      if (!name || !name.trim()) return;
      const pr = {
        id: Store.uid(), name: name.trim(),
        cols: [
          { id: Store.uid(), key: "col_todo", cards: [] },
          { id: Store.uid(), key: "col_doing", cards: [] },
          { id: Store.uid(), key: "col_done", cards: [] },
        ],
      };
      S.projects.push(pr); activeProject = pr.id;
      Store.save(); render();
    });
    $$("[data-proj]").forEach(b => b.addEventListener("click", () => { activeProject = b.dataset.proj; render(); }));

    if (!proj) return;

    $("#delProj") && $("#delProj").addEventListener("click", () => {
      if (!confirm(t("delete_confirm"))) return;
      S.projects = S.projects.filter(x => x.id !== proj.id);
      activeProject = null; Store.save(); render();
    });

    $$("[data-addcard]").forEach(b => b.addEventListener("click", () => {
      const txt = prompt(t("card_ph"));
      if (!txt || !txt.trim()) return;
      proj.cols.find(c => c.id === b.dataset.addcard).cards.push({ id: Store.uid(), title: txt.trim() });
      Store.save(); render();
    }));
    $$("[data-kdel]").forEach(b => b.addEventListener("click", (e) => {
      e.stopPropagation();
      for (const c of proj.cols) c.cards = c.cards.filter(k => k.id !== b.dataset.kdel);
      Store.save(); render();
    }));

    // Drag & drop
    $$(".kcard").forEach(card => {
      card.addEventListener("dragstart", (e) => {
        card.classList.add("dragging");
        e.dataTransfer.setData("text/plain", card.dataset.card);
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
    });
    $$(".kcards").forEach(zone => {
      zone.addEventListener("dragover", (e) => e.preventDefault());
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        let moved = null;
        for (const c of proj.cols) {
          const i = c.cards.findIndex(k => k.id === id);
          if (i >= 0) moved = c.cards.splice(i, 1)[0];
        }
        if (moved) proj.cols.find(c => c.id === zone.dataset.zone).cards.push(moved);
        Store.save(); render();
      });
    });
  }

  function boardHTML(proj) {
    return `
      <div class="board">
        ${proj.cols.map(c => `
          <div class="kcol">
            <div class="kcol-head"><h4>${esc(t(c.key))}</h4><span class="count">${c.cards.length}</span></div>
            <div class="kcards" data-zone="${c.id}">
              ${c.cards.map(k => `
                <div class="kcard" draggable="true" data-card="${k.id}">
                  <button class="k-del" data-kdel="${k.id}">✕</button>${esc(k.title)}
                </div>`).join("")}
            </div>
            <button class="add-card" data-addcard="${c.id}">${esc(t("add_card"))}</button>
          </div>`).join("")}
      </div>
      <button class="chip" id="delProj" style="color:var(--accent)">🗑 ${esc(t("delete_project"))}</button>`;
  }

  /* ════════════ Library ════════════ */

  function renderLibrary(main) {
    main.innerHTML = `
      <div class="view-head">
        <h1 class="view-title">${esc(t("library_title"))}</h1>
        <p class="view-sub">${esc(t("library_sub"))}</p>
      </div>

      <div class="drop-zone" id="drop">
        <span class="big">📚</span>
        <div style="font-weight:600;font-size:16px">${esc(t("drop_hint"))}</div>
        <div style="font-size:13px;margin-top:6px">${esc(t("drop_types"))} · ${esc(t("pdf_note"))}</div>
        <input type="file" id="fileInput" accept=".txt,.md,text/plain,text/markdown" multiple hidden>
      </div>

      <div class="section-label">${esc(t("books_label", { n: S.books.length }))}</div>
      <div class="card" style="padding:8px 20px">
        ${S.books.length ? S.books.map(b => `
          <div class="book-row">
            <div class="book-ico">📖</div>
            <div class="b-info">
              <div class="b-title">${esc(b.title)}</div>
              <div class="b-meta">${b.chunks.length} ${esc(t("chunks"))} · ${(b.size / 1024).toFixed(0)} KB</div>
            </div>
            <button class="task-del" style="opacity:1" data-bookdel="${b.id}">✕</button>
          </div>`).join("") : `<p style="color:var(--text-3);padding:14px 0">${esc(t("no_books"))}</p>`}
      </div>`;

    const drop = $("#drop");
    const fi = $("#fileInput");
    drop.addEventListener("click", () => fi.click());
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault(); drop.classList.remove("over");
      handleFiles(e.dataTransfer.files);
    });
    fi.addEventListener("change", () => handleFiles(fi.files));

    $$("[data-bookdel]").forEach(b => b.addEventListener("click", () => {
      S.books = S.books.filter(x => x.id !== b.dataset.bookdel);
      Store.save(); render();
    }));
  }

  async function handleFiles(files) {
    for (const f of files) {
      if (!/\.(txt|md)$/i.test(f.name) && !f.type.startsWith("text/")) continue;
      const text = await f.text();
      const chunks = chunkText(text);
      const title = f.name.replace(/\.(txt|md)$/i, "");
      S.books.push({ id: Store.uid(), title, size: f.size, chunks, addedAt: Date.now() });
      Store.save();
      toast(t("book_added", { t: title }));
    }
    render();
  }

  function chunkText(text, size = 900) {
    const paras = text.split(/\n\s*\n/);
    const chunks = [];
    let cur = "";
    for (const p of paras) {
      if ((cur + "\n\n" + p).length > size && cur) { chunks.push(cur.trim()); cur = p; }
      else cur = cur ? cur + "\n\n" + p : p;
    }
    if (cur.trim()) chunks.push(cur.trim());
    return chunks.filter(c => c.length > 40).slice(0, 800);
  }

  /* ════════════ Plan ════════════ */

  function renderPlan(main) {
    main.innerHTML = `
      <div class="view-head">
        <h1 class="view-title">${esc(t("plan_title"))}</h1>
        <p class="view-sub">${esc(t("plan_sub"))}</p>
      </div>

      <div class="card plan-goal-card">
        <textarea id="planGoal" class="input" placeholder="${esc(t("plan_goal_ph"))}"></textarea>
        <div style="margin-top:14px;display:flex;gap:10px;align-items:center">
          <button class="btn" id="genPlan">${esc(t("generate_plan"))}</button>
          <span id="planStatus" style="color:var(--text-2);font-size:14px"></span>
        </div>
      </div>

      <div class="section-label">${esc(t("my_plans"))}</div>
      <div class="card" style="padding:8px 20px">
        ${S.plans.length ? S.plans.map(pl => `
          <div class="plan-row" data-deck="${pl.id}">
            <div class="book-ico">✦</div>
            <div class="b-info">
              <div class="b-title p-title">${esc(pl.deck.title || pl.goal)}</div>
              <div class="b-meta">${esc(t("slides_n", { n: pl.deck.slides.length + 2 }))} · ${new Date(pl.createdAt).toLocaleDateString(localeOf())}</div>
            </div>
            <button class="chip">${esc(t("open_deck"))}</button>
          </div>`).join("") : `<p style="color:var(--text-3);padding:14px 0">${esc(t("no_plans"))}</p>`}
      </div>`;

    $("#genPlan").addEventListener("click", async () => {
      const goal = $("#planGoal").value.trim() || S.profile.goal;
      if (!goal) return;
      const key = (S.settings.keys[S.settings.provider] || "").trim();
      if (!key) { toast(t("no_key_msg")); go("settings"); return; }

      const btn = $("#genPlan"), st = $("#planStatus");
      btn.disabled = true;
      st.textContent = t("generating");
      try {
        const deck = await AI.generatePlan(S, goal);
        const pl = { id: Store.uid(), goal, deck, createdAt: Date.now() };
        S.plans.unshift(pl);
        Store.save();
        render();
        openDeck(pl);
      } catch (err) {
        st.textContent = t("plan_error", { err: err.message === "NO_KEY" ? "no key" : err.message });
        btn.disabled = false;
      }
    });

    $$("[data-deck]").forEach(r => r.addEventListener("click", () => {
      const pl = S.plans.find(x => x.id === r.dataset.deck);
      pl && openDeck(pl);
    }));
  }

  /* ════════════ Deck (Swiss presentation) ════════════ */

  let deckState = null;

  function openDeck(plan) {
    const d = plan.deck;
    // slide list: cover + content slides + closing quote
    const slides = [
      { kind: "cover", title: d.title, sub: d.subtitle },
      ...d.slides.map(s => ({ kind: "content", ...s })),
      ...(d.quote ? [{ kind: "quote", quote: d.quote }] : []),
    ];
    deckState = { slides, i: 0 };
    $("#deck").classList.remove("hidden");
    renderDeck();
    document.addEventListener("keydown", deckKeys);
  }

  function closeDeck() {
    $("#deck").classList.add("hidden");
    deckState = null;
    document.removeEventListener("keydown", deckKeys);
  }

  function deckKeys(e) {
    if (!deckState) return;
    if (e.key === "Escape") closeDeck();
    if (e.key === "ArrowRight" || e.key === " ") deckNav(1);
    if (e.key === "ArrowLeft") deckNav(-1);
  }

  function deckNav(d) {
    deckState.i = Math.max(0, Math.min(deckState.slides.length - 1, deckState.i + d));
    renderDeck();
  }

  function renderDeck() {
    const { slides, i } = deckState;
    const s = slides[i];
    let body = "";
    if (s.kind === "cover") {
      body = `<div class="slide-rule"></div>
        <div class="slide-kicker">بردي · Bardi</div>
        <h1>${esc(s.title)}</h1>
        ${s.sub ? `<p class="sub">${esc(s.sub)}</p>` : ""}`;
    } else if (s.kind === "quote") {
      body = `<div class="slide-rule"></div>
        <p class="quote">“${esc(s.quote)}”</p>`;
    } else {
      body = `<div class="slide-rule"></div>
        ${s.kicker ? `<div class="slide-kicker">${esc(s.kicker)}</div>` : ""}
        <h2>${esc(s.title)}</h2>
        <ul>${(s.points || []).map(p => `<li>${esc(p)}</li>`).join("")}</ul>`;
    }

    $("#deck").innerHTML = `
      <div class="slide" dir="${I18N[LANG].dir}">${body}</div>
      <div class="deck-bar">
        <span class="pageno">${String(i + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}</span>
        <div class="deck-btns">
          <button id="dPrev">${esc(t("deck_prev"))}</button>
          <button id="dNext">${esc(t("deck_next"))}</button>
          <button id="dPrint">${esc(t("deck_print"))}</button>
          <button class="primary" id="dClose">${esc(t("deck_close"))}</button>
        </div>
      </div>`;

    $("#dPrev").addEventListener("click", () => deckNav(-1));
    $("#dNext").addEventListener("click", () => deckNav(1));
    $("#dClose").addEventListener("click", closeDeck);
    $("#dPrint").addEventListener("click", () => printDeck());
  }

  function printDeck() {
    // Render ALL slides for print, then restore
    const { slides, i } = deckState;
    const deckEl = $("#deck");
    deckEl.innerHTML = slides.map(s => {
      let body = "";
      if (s.kind === "cover") body = `<div class="slide-rule"></div><div class="slide-kicker">بردي · Bardi</div><h1>${esc(s.title)}</h1>${s.sub ? `<p class="sub">${esc(s.sub)}</p>` : ""}`;
      else if (s.kind === "quote") body = `<div class="slide-rule"></div><p class="quote">“${esc(s.quote)}”</p>`;
      else body = `<div class="slide-rule"></div>${s.kicker ? `<div class="slide-kicker">${esc(s.kicker)}</div>` : ""}<h2>${esc(s.title)}</h2><ul>${(s.points || []).map(p => `<li>${esc(p)}</li>`).join("")}</ul>`;
      return `<div class="slide" dir="${I18N[LANG].dir}">${body}</div>`;
    }).join("");
    window.print();
    deckState.i = i;
    renderDeck();
  }

  /* ════════════ Settings ════════════ */

  function renderSettings(main) {
    const st = S.settings;
    main.innerHTML = `
      <div class="view-head">
        <h1 class="view-title">${esc(t("settings_title"))}</h1>
        <p class="view-sub">${esc(t("settings_sub"))}</p>
      </div>

      <div class="card">
        <div class="settings-row">
          <div class="s-info"><div class="s-title">${esc(t("s_lang"))}</div><div class="s-sub">${esc(t("s_lang_sub"))}</div></div>
          <div class="seg">
            ${["ar","en","fr"].map(l => `<button data-setlang="${l}" class="${st.language === l ? "on" : ""}">${I18N[l].lang_name}</button>`).join("")}
          </div>
        </div>
        <div class="settings-row">
          <div class="s-info"><div class="s-title">${esc(t("s_theme"))}</div><div class="s-sub">${esc(t("s_theme_sub"))}</div></div>
          <div class="seg">
            <button data-settheme="light" class="${st.theme === "light" ? "on" : ""}">☀️ ${esc(t("theme_light"))}</button>
            <button data-settheme="dark" class="${st.theme === "dark" ? "on" : ""}">🌙 ${esc(t("theme_dark"))}</button>
          </div>
        </div>
      </div>

      <div class="section-label">${esc(t("s_profile"))}</div>
      <div class="card">
        <div class="ob-field"><label class="s-sub">${esc(t("s_name"))}</label><input id="sName" class="input" value="${esc(S.profile.name)}"></div>
        <div class="ob-field"><label class="s-sub">${esc(t("s_contact"))}</label><input id="sContact" class="input" value="${esc(S.profile.contact)}"></div>
        <div class="ob-field"><label class="s-sub">${esc(t("s_goal"))}</label><input id="sGoal" class="input" value="${esc(S.profile.goal)}"></div>
        <button class="btn small" id="saveProfile">${esc(t("save"))}</button>
      </div>

      <div class="section-label">${esc(t("s_ai"))}</div>
      <div class="card">
        <p class="s-sub" style="margin-bottom:14px">🔒 ${esc(t("s_ai_sub"))}</p>

        <div class="settings-row">
          <div class="s-info"><div class="s-title">Claude</div><div class="s-sub">${esc(t("key_claude_sub"))}</div>
            <details class="help-details"><summary>${esc(t("how_get_key"))}</summary><div class="help-body">${esc(t("key_help_claude")).replaceAll("\n", "<br>")}</div></details>
          </div>
          <input class="input key-input" id="keyClaude" type="password" placeholder="sk-ant-…" value="${esc(st.keys.claude)}">
        </div>

        <div class="settings-row">
          <div class="s-info"><div class="s-title">ChatGPT</div><div class="s-sub">${esc(t("key_openai_sub"))}</div>
            <details class="help-details"><summary>${esc(t("how_get_key"))}</summary><div class="help-body">${esc(t("key_help_openai")).replaceAll("\n", "<br>")}</div></details>
          </div>
          <input class="input key-input" id="keyOpenai" type="password" placeholder="sk-…" value="${esc(st.keys.openai)}">
        </div>

        <div class="settings-row">
          <div class="s-info"><div class="s-title">Gemini</div><div class="s-sub">${esc(t("key_gemini_sub"))}</div>
            <details class="help-details"><summary>${esc(t("how_get_key"))}</summary><div class="help-body">${esc(t("key_help_gemini")).replaceAll("\n", "<br>")}</div></details>
          </div>
          <input class="input key-input" id="keyGemini" type="password" placeholder="AIza…" value="${esc(st.keys.gemini)}">
        </div>

        <div class="settings-row">
          <div class="s-info"><div class="s-title">${esc(t("s_provider"))}</div><div class="s-sub">${esc(t("s_provider_sub"))}</div></div>
          <div class="seg">
            ${["claude","openai","gemini"].map(p => `<button data-setprov="${p}" class="${st.provider === p ? "on" : ""}">${AI.PROVIDER_NAMES[p]}</button>`).join("")}
          </div>
        </div>

        <div style="margin-top:10px"><button class="btn small" id="saveKeys">${esc(t("save"))}</button></div>
      </div>

      <div class="section-label">${esc(t("s_data"))}</div>
      <div class="card">
        <div class="settings-row">
          <div class="s-info"><div class="s-title">${esc(t("s_data"))}</div><div class="s-sub">${esc(t("s_data_sub"))}</div></div>
          <div style="display:flex;gap:10px">
            <button class="btn small secondary" id="exportBtn">⬇ ${esc(t("export_btn"))}</button>
            <button class="btn small secondary" id="importBtn">⬆ ${esc(t("import_btn"))}</button>
            <input type="file" id="importFile" accept="application/json" hidden>
          </div>
        </div>
        <div class="settings-row">
          <div class="s-info"><div class="s-title">${esc(t("s_memory"))}</div><div class="s-sub">${esc(t("s_memory_sub", { n: S.memory.length }))}</div></div>
          <button class="btn small secondary" id="clearMem">${esc(t("clear_memory"))}</button>
        </div>
        <div class="settings-row">
          <div class="s-info"><div class="s-title">${esc(t("s_reset"))}</div><div class="s-sub">${esc(t("s_reset_sub"))}</div></div>
          <button class="btn small" style="background:#c0281a" id="resetBtn">${esc(t("reset_btn"))}</button>
        </div>
      </div>`;

    $$("[data-setlang]").forEach(b => b.addEventListener("click", () => {
      st.language = b.dataset.setlang; setLang(st.language); Store.save();
      renderNav(); render();
    }));
    $$("[data-settheme]").forEach(b => b.addEventListener("click", () => {
      st.theme = b.dataset.settheme; applyTheme(); Store.save(); render();
    }));
    $$("[data-setprov]").forEach(b => b.addEventListener("click", () => {
      st.provider = b.dataset.setprov; Store.save(); render();
    }));

    $("#saveProfile").addEventListener("click", () => {
      S.profile.name = $("#sName").value.trim();
      S.profile.contact = $("#sContact").value.trim();
      S.profile.goal = $("#sGoal").value.trim();
      Store.save(); toast(t("saved"));
    });

    $("#saveKeys").addEventListener("click", () => {
      st.keys.claude = $("#keyClaude").value.trim();
      st.keys.openai = $("#keyOpenai").value.trim();
      st.keys.gemini = $("#keyGemini").value.trim();
      Store.save(); toast(t("saved"));
    });

    $("#exportBtn").addEventListener("click", () => Store.exportData());
    $("#importBtn").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const json = await f.text();
        Object.assign(S, Store.importData(json));
        setLang(S.settings.language); applyTheme();
        toast(t("imported"));
        renderNav(); render();
      } catch (_) { toast(t("import_bad")); }
    });

    $("#clearMem").addEventListener("click", () => { S.memory = []; Store.save(); render(); });
    $("#resetBtn").addEventListener("click", () => {
      if (!confirm(t("reset_confirm"))) return;
      Store.reset(); location.reload();
    });
  }

  /* ════════════ Boot ════════════ */

  if (!S.profile.onboarded) showOnboarding();
  else startApp();
})();
