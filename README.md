# Ayser AI — Your Life, Beautifully Organized ✦

**Ayser AI** هو مدرب حياتك الذكي — موقع بسيط جدًا (بفلسفة Steve Jobs في التصميم) بيتكلم **عربي، إنجليزي، وفرنسي**، وبينظم حياتك كلها في مكان واحد: الشغل، الدراسة، الصلاة، النوم، الأكل، والتمرين.

A trilingual (Arabic / English / French) AI life-coach web app. Notion-simple, Apple-minimal, Swiss-designed.

---

## ✨ المميزات | Features

| | |
|---|---|
| 🧭 **الكوتش الذكي** | شات مع مدرب حياة/ثيرابست حقيقي الإحساس — بيسألك أسئلة تبني هويتك وتوصلك لهدفك، وبيتعلم عنك مع الوقت |
| 🤖 **٣ عقول AI** | Claude (موصى به) + ChatGPT + Gemini — بتحط مفتاحك مرة واحدة وتبدّل بينهم بضغطة |
| ☀️ **يومك** | مهام اليوم + عاداتك (الصلوات الخمس، تمرين، نوم، أكل، مذاكرة، شغل عميق) + دايرة إنجاز |
| 📄 **صفحات** | زي Notion بس بسيط: نصوص، عناوين، مهام، نقاط |
| 📊 **مشاريع** | لوحات كانبان بالسحب والإفلات |
| 📚 **المكتبة** | ارفع كتب (.txt / .md) — الكوتش يقراها ويستخدمها وهو بيرد عليك |
| ✦ **الخطة** | قول هدفك، ياخد منك خطة كاملة في شكل **برزنتيشن Swiss Design** أنيق + طباعة PDF |
| 🔒 **الخصوصية** | كل بياناتك على جهازك فقط (localStorage). المفاتيح تروح مباشرة لمزود الـAI — لا سيرفر، لا تتبع |
| 🌍 **ثلاث لغات** | عربي (RTL كامل) / English / Français — بتتبدل من الإعدادات |
| 📱 **PWA** | يتفتح على الموبايل ويتثبت كأنه تطبيق |

## 🚀 التشغيل | Run it

مفيش build ولا تثبيت — ملفات ثابتة:

```bash
# أي سيرفر ملفات بسيط:
python3 -m http.server 8080
# ثم افتح  http://localhost:8080
```

أو انشره مجانًا على **GitHub Pages**: Settings → Pages → Deploy from branch.

## 🔑 مفاتيح الذكاء الاصطناعي | AI Keys (BYOK)

الموقع بيكلم مزودي الـ AI مباشرة من متصفحك بمفتاحك أنت:

- **Claude** (موصى به): [platform.claude.com](https://platform.claude.com) → API Keys → Create Key
- **ChatGPT**: [platform.openai.com](https://platform.openai.com) → API Keys
- **Gemini**: [aistudio.google.com](https://aistudio.google.com) → Get API Key

حط المفتاح في **الإعدادات** داخل الموقع (فيه شرح خطوة بخطوة). المفتاح يتخزن محليًا فقط.

## 🗺️ المرحلة القادمة | Phase 2 (roadmap)

- حسابات حقيقية (رقم تليفون / إيميل) ومزامنة سحابية (Supabase)
- تعاون لحظي مع الزملاء أونلاين
- قراءة ملفات PDF مباشرة، وأدوات إبداع (صور/ميديا)

## 🧱 Structure

```
index.html      app shell
css/style.css   design system (Apple-minimal × Swiss, RTL, dark/light)
js/i18n.js      ar / en / fr strings
js/store.js     local data layer + export/import
js/ai.js        Claude / OpenAI / Gemini adapters (streaming, coach persona, book retrieval)
js/app.js       views & interactions
```

---

Built for **Ayser Elrifay** — life coach. البيانات ملكك، والرحلة بتبدأ بخطوة. 🌱
