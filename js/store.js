/* ═══════════════════════════════════════════════════
   Bardi — Store (localStorage data layer)
   All data lives on the user's device. Nothing is sent
   anywhere except AI requests, which go directly from
   the browser to the chosen AI provider.
   ═══════════════════════════════════════════════════ */

const Store = (() => {
  const KEY = "ayser_ai_v1";

  const DEFAULTS = () => ({
    version: 1,
    profile: {
      onboarded: false,
      name: "",
      contact: "",
      goal: "",
      why: "",
      values: [],
      focus: [],
    },
    settings: {
      language: "ar",
      theme: "light",
      // "free" (a third-party keyless gateway) and "local" (on-device open
      // models) are both available but never the default — a user must
      // explicitly opt into either, since "free" means their messages go
      // to a service Bardi doesn't control, and "local" means a real
      // model download before it can answer.
      provider: "claude",
      keys: { claude: "", openai: "", gemini: "" },
      localModel: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
      notifications: false, // browser reminder notifications — off until the user opts in
      // When Bardi isn't sure about a factual question it can look it up on
      // Wikipedia. Only the short search query is sent — never the
      // conversation itself. Visible in the chat every time it happens,
      // and can be switched off in Settings.
      webSearch: true,
    },
    tasks: [],          // {id, title, done, date}
    habitLog: {},       // { "YYYY-MM-DD": { habitId: true } }
    focusLog: {},       // { "YYYY-MM-DD": completedFocusSessions }
    pages: [],          // {id, title, blocks:[{id,type,text,done}], updatedAt}
    projects: [],       // {id, name, cols:[{id, key, cards:[{id,title}]}], files:[{id,name,size,type}]}
    books: [],          // {id, title, size, chunks:[string], addedAt, status:"toread"|"reading"|"done"}
    videos: [],         // {id, title, url, notes, addedAt} — study/skill videos
    chats: [],          // [{id, title, messages:[{role,content}], updatedAt}]
    activeChatId: null,
    memory: [],         // strings the coach learned about the user
    feedback: { up: 0, down: 0, reasons: [] }, // 👍/👎 on replies + last dislike reasons — local style-learning signal
    moments: { lastMsgCount: 0 }, // marker for the periodic learn-from-chats distillation
    plans: [],          // {id, goal, deck:{title,subtitle,slides:[]}, createdAt}
    journal: [],         // {id, text, mood, createdAt}
    events: [],          // {id, title, date:"YYYY-MM-DD", time:"HH:MM"|"", note, remindMin, reminded, createdAt}
    scripts: [],          // {id, title, logline, scenes:[{id,text,prompt}], updatedAt} — Studio story/script drafts
  });

  let state = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      state = raw ? Object.assign(DEFAULTS(), JSON.parse(raw)) : DEFAULTS();
      // migrate old single-chat format → multi-chat
      if (Array.isArray(state.chat)) {
        if (state.chat.length) {
          state.chats.unshift({
            id: uid(),
            title: (state.chat.find(m => m.role === "user") || {}).content || "",
            messages: state.chat,
            updatedAt: Date.now(),
          });
        }
        delete state.chat;
      }
    } catch (e) {
      state = DEFAULTS();
    }
    return state;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Storage full or unavailable", e);
    }
  }

  function get() { return state || load(); }

  function reset() {
    localStorage.removeItem(KEY);
    state = DEFAULTS();
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bardi-backup-" + todayKey() + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importData(json) {
    const data = JSON.parse(json);
    if (!data || typeof data !== "object" || !data.profile || !data.settings) {
      throw new Error("bad file");
    }
    state = Object.assign(DEFAULTS(), data);
    save();
    return state;
  }

  /* ── Share a single project with a colleague (download → they import) ── */
  function exportProject(project) {
    const payload = { bardiProject: 1, project };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bardi-project-" + (project.name || "untitled").replace(/[^\w\-]+/g, "-").slice(0, 40) + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importProjectFile(json) {
    const data = JSON.parse(json);
    const src = data && data.bardiProject && data.project;
    if (!src || !src.name || !Array.isArray(src.cols)) throw new Error("bad project file");
    // Regenerate every ID so importing the same file twice (or on the same
    // device that exported it) never collides with existing projects.
    return {
      id: uid(),
      name: src.name,
      cols: src.cols.map(c => ({
        id: uid(),
        key: c.key,
        cards: (c.cards || []).map(k => ({ id: uid(), title: k.title })),
      })),
    };
  }

  /* ── Project file attachments (IndexedDB — localStorage is too small
     for real files). Blobs never leave the device and are NOT included
     in exports or project sharing. ── */
  const FDB = "bardi_files";
  let fdbPromise = null;
  function fdb() {
    if (fdbPromise) return fdbPromise;
    fdbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(FDB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore("files");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return fdbPromise;
  }
  async function putFile(id, blob) {
    const db = await fdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put(blob, id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  async function getFile(id) {
    const db = await fdb();
    return new Promise((resolve, reject) => {
      const req = db.transaction("files").objectStore("files").get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
  async function delFile(id) {
    const db = await fdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  return { load, save, get, reset, exportData, importData, exportProject, importProjectFile, putFile, getFile, delFile, uid, todayKey };
})();
