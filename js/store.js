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
      localModel: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    },
    tasks: [],          // {id, title, done, date}
    habitLog: {},       // { "YYYY-MM-DD": { habitId: true } }
    pages: [],          // {id, title, blocks:[{id,type,text,done}], updatedAt}
    projects: [],       // {id, name, cols:[{id, key, cards:[{id,title}]}]}
    books: [],          // {id, title, size, chunks:[string], addedAt}
    videos: [],         // {id, title, url, notes, addedAt} — study/skill videos
    chats: [],          // [{id, title, messages:[{role,content}], updatedAt}]
    activeChatId: null,
    memory: [],         // strings the coach learned about the user
    plans: [],          // {id, goal, deck:{title,subtitle,slides:[]}, createdAt}
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

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  return { load, save, get, reset, exportData, importData, exportProject, importProjectFile, uid, todayKey };
})();
