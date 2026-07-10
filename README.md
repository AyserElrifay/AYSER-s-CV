# Bardi · بردي — Your Life, Beautifully Organized ✦

**بردي** هو مدرب حياتك الذكي — موقع بسيط جدًا (بفلسفة Steve Jobs في التصميم) بيتكلم **عربي، إنجليزي، فرنسي، ألماني، وإسباني**، وبينظم حياتك كلها في مكان واحد: الشغل، الدراسة، الصلاة، النوم، الأكل، والتمرين.

A chat-first, 5-language AI life-coach web app. Notion-simple, Apple-minimal, Swiss-designed.

---

## ✨ المميزات | Features

| | |
|---|---|
| 🧭 **الكوتش الذكي** | شات مع مدرب حياة/ثيرابست حقيقي الإحساس — بيسألك أسئلة كتير قبل ما ينصحك عشان يفهم موقفك صح، بيراعي مشاعرك الأول، وبيدّيك نصايح حياتية عامة وإنسانية (مش مرتبطة بدين معين) تناسب أي حد أيًا كان دينه أو لغته |
| 🖥️ **محطة العمل** | داشبورد واحد يجمع مهامك، مشروعك النشط، وآخر إضافات مكتبتك في شاشة واحدة |
| ☀️ **يومك** | مهام اليوم + عاداتك (الصلوات الخمس، تمرين، نوم، أكل، مذاكرة، شغل عميق) + دايرة إنجاز |
| 📄 **صفحات** | زي Notion بس بسيط: نصوص، عناوين، مهام، نقاط |
| 📊 **مشاريع** | لوحات كانبان بالسحب والإفلات — وتقدر **تشارك مشروع كامل مع زميلك** بملف واحد |
| 📚 **المكتبة** | كتب (.txt / .md) وفيديوهات تعلّم — الكوتش يستخدمها وهو بيرد عليك |
| 📓 **مذكراتي** | مساحة خاصة تكتب فيها مشاعرك وتحط تاج المزاج — وبزرار واحد تتكلم مع بردي عن أي مذكرة |
| 📅 **الكالندر** | ميعاد شغل، خطوبة، أي حاجة — بردي يقترحها من نص المحادثة (بموافقتك دايمًا) وينبهك قبلها لو فعّلت الإشعارات |
| 🎬 **استوديو القصص** | جوه صفحة المشاريع: اكتب فيلم أو قصة قصيرة، قسّمها مشاهد، وخلي بردي يكتبلك وصف بصري سينمائي لكل مشهد، وصدّر قائمة اللقطات لاستخدامها في أدوات فيديو زي Higgsfield أو Runway أو Pika أو Luma |
| ✦ **الخطة** | قول هدفك، ياخد منك خطة كاملة في شكل **برزنتيشن Swiss Design** أنيق + طباعة PDF |
| 🔒 **الخصوصية** | كل بياناتك على جهازك فقط (localStorage). كل مصدر AI متاح ومُفصح عنه بوضوح |
| 🌍 **٥ لغات** | عربي (RTL كامل) / English / Français / Deutsch / Español |
| 📱 **PWA** | يتفتح على الموبايل ويتثبت كأنه تطبيق |

## 🤖 مصادر الذكاء الاصطناعي | AI Providers

كل مصدر مُفصح عنه بوضوح في الإعدادات — **Claude هو الافتراضي دايمًا**، والباقي اختياري بالكامل:

| المصدر | الوصف |
|---|---|
| **Claude** (افتراضي، موصى به) | مفتاحك الخاص → مباشرة لـ Anthropic |
| **ChatGPT** | مفتاحك الخاص → مباشرة لـ OpenAI |
| **Gemini** | مفتاحك الخاص → مباشرة لـ Google |
| **Bardi Local** 💻 | موديلات **مفتوحة المصدر حقيقية** — Llama (Meta)، Qwen (Alibaba)، Gemma (Google)، Phi (Microsoft)، Mistral — بتشتغل **بالكامل جوه متصفحك** عن طريق [WebLLM](https://github.com/mlc-ai/web-llm) و WebGPU. بردي بيختارلك أنسب حجم موديل حسب إمكانيات جهازك تلقائيًا. مجاني، من غير مفتاح، ومحادثاتك متسيبش جهازك خالص بعد أول تنزيل. محتاج متصفح Chrome أو Edge |
| **Bardi Free** 🌐 | مجاني وبدون مفتاح، بس بيوجّه رسايلك لخدمة تالتة مفتوحة اسمها [Pollinations](https://pollinations.ai) — اختياري بالكامل ومُفصح عنه بوضوح |

## 🚀 التشغيل | Run it

مفيش build ولا تثبيت — ملفات ثابتة:

```bash
# أي سيرفر ملفات بسيط:
python3 -m http.server 8080
# ثم افتح  http://localhost:8080
```

أو انشره مجانًا على **GitHub Pages**: Settings → Pages → Deploy from branch (أو استخدم الـ workflow الجاهز في `.github/workflows/pages.yml`).

## 🔑 مفاتيح الذكاء الاصطناعي | AI Keys (BYOK)

الموقع بيكلم مزودي الـ AI مباشرة من متصفحك بمفتاحك أنت:

- **Claude** (موصى به): [platform.claude.com](https://platform.claude.com) → API Keys → Create Key
- **ChatGPT**: [platform.openai.com](https://platform.openai.com) → API Keys
- **Gemini**: [aistudio.google.com](https://aistudio.google.com) → Get API Key

حط المفتاح في **الإعدادات** داخل الموقع (فيه شرح خطوة بخطوة). المفتاح يتخزن محليًا فقط. ولو عايز تشتغل من غير أي مفتاح خالص، فعّل **Bardi Local** من نفس الصفحة.

## 🗺️ المرحلة القادمة | Phase 2 (roadmap)

- حسابات حقيقية (رقم تليفون / إيميل) ومزامنة سحابية (Supabase)
- تعاون لحظي (realtime) مع الزملاء أونلاين على نفس اللوحة
- قراءة ملفات PDF مباشرة

## 🧱 Structure

```
index.html      app shell
css/style.css   design system (Apple-minimal × Swiss, RTL, dark/light)
js/i18n.js      ar / en / fr / de / es strings
js/store.js     local data layer + export/import (+ per-project share)
js/ai.js        Claude / OpenAI / Gemini / Pollinations / WebLLM adapters
js/app.js       views & interactions (chat-first, Workstation, Library, Projects)
```

---

Built for **Ayser Elrifay** — life coach. البيانات ملكك، والرحلة بتبدأ بخطوة. 🌱
