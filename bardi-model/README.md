# موديل بردي — Bardi-3B 🌾
### موديلك انت، بأوزانك، مستقل عن Claude و Grok — خطوة بخطوة

ده الـ pipeline الكامل اللي يحوّل بردي من "شخصية فوق موديل تاني" لـ **موديل حقيقي
باسمك**، متخصص في حاجة مفيش موديل في العالم متخصص فيها: **الكوتشينج بالعامية
المصرية**. نفس طريقة DeepSeek في موديلاتهم الصغيرة (موديل مفتوح + تدريب على بياناتك).

> التكلفة الحقيقية: **٠ لـ ٥٠٠ دولار** (GPU مستأجر بالساعة)، والوقت **ساعات مش شهور**.

---

## الصورة الكبيرة (٤ خطوات)

```
  بياناتك  ──▶  تدريب QLoRA  ──▶  تحويل MLC  ──▶  ربطه بالتطبيق
 (data/)       (train_qlora)     (export_mlc)    (bardiLocal.js)
```

النتيجة: زرار **"موديل باردي على جهازك"** جوه Moments بيشغّل **موديلك انت** —
شغّال في المتصفح، خاص ١٠٠٪، من غير أي شركة تانية.

---

## اللي هتحتاجه
- حساب **Hugging Face** مجاني (عشان ترفع الموديل) — huggingface.co
- **GPU** لتشغيل التدريب. أرخص وأسهل الطرق:
  - **Google Colab** (فيه GPU مجاني T4) — تفتح نوتبوك وتلزق الأوامر.
  - **RunPod / Vast.ai** — تأجّر GPU بـ ~٠.٣–٠.٥ دولار للساعة.
- (اختياري) مفتاح **Groq** مجاني عشان تكبّر البيانات تلقائيًا.

> الكمبيوتر العادي بيقدر يعمل تجهيز البيانات، لكن **التدريب محتاج GPU**.

---

## الخطوات بالتفصيل

### 0) نزّل الفولدر ده على جهاز فيه GPU
كله موجود في الريبو تحت `bardi-model/`. على Colab/RunPod:
```bash
git clone https://github.com/AyserElrifay/AYSER-s-CV.git
cd AYSER-s-CV
pip install -r bardi-model/requirements.txt
```

### 1) حطّ أمثلتك (أهم خطوة — دي ميزتك انت) ✍️
- في `bardi-model/data/` فيه بالفعل **٢٣ مثال جاهز** (`seed_bardi.jsonl`) بصوت بردي.
- اقرأ `data/TEMPLATE.md` واضيف أمثلتك انت في ملف جديد (مثلاً `my_examples.jsonl`).
- **٣٠–٥٠ مثال حقيقي منك** = نواة ذهبية. الجودة أهم من العدد.

### 2) (اختياري) كبّر البيانات بالتقطير
موديل كبير بيكتب أمثلة كتير على نمط أمثلتك، وانت بتراجعها:
```bash
export GROQ_API_KEY=gsk_...      # مفتاح مجاني من console.groq.com
python bardi-model/scripts/expand_distill.py --n 300
# افتح data/synthetic_bardi.jsonl واحذف أي رد ضعيف قبل التدريب
```

### 3) جهّز الداتا
```bash
python bardi-model/scripts/prepare_data.py
# بيطلع train.jsonl و eval.jsonl
```

### 4) درّب الموديل (على الـ GPU)
```bash
python bardi-model/scripts/train_qlora.py
# بياخد من دقايق لساعة. الناتج: out/bardi-3b-merged/  ← ده موديلك بأوزانه
```

### 5) حوّله وارفعه عشان يشتغل في التطبيق
```bash
export HF_USER=اسمك_في_هاجينج_فيس
export HF_TOKEN=hf_...            # write token من huggingface.co/settings/tokens
bash bardi-model/scripts/export_mlc.sh
```

### 6) شغّله في Moments 🎉
السكربت هيطبعلك بالظبط اللي تحطه في `src/services/bardiLocal.js`:
```js
export const CUSTOM_BARDI_MODEL = {
  id: 'Bardi-3B-q4f16_1-MLC',
  url: 'https://huggingface.co/<HF_USER>/Bardi-3B-q4f16_1-MLC/resolve/main/',
  libUrl: 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/Qwen2.5-3B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm',
};
```
كده زرار "موديل باردي على جهازك" بيشغّل **Bardi-3B بتاعك** بدل الموديل المفتوح.

---

## التحسين المستمر (بردي بيتعلم ويكبر)
كل ما تجمع أمثلة أحسن (من جلساتك، أو من الكونتنت اللي بتحطه في بورتال Moments
Studio) → ضيفها في `data/` → اعمل `prepare_data.py` و `train_qlora.py` تاني →
ارفع نسخة جديدة. ده "التعلّم الذاتي" بشكله الحقيقي القابل للتنفيذ.

---

## ليه ده "استقلال" حقيقي؟
- **الأوزان ملكك** على Hugging Face باسمك.
- **بيشتغل على جهاز المستخدم** (WebGPU) — مفيش داتا بتطلع لأي شركة.
- **مفيش Claude ولا Groq** في المسار ده خالص.
- متخصص في نطاق (الكوتشينج المصري) ممكن يتفوّق فيه على موديلات أكبر منه ٥٠ مرة.

> ملاحظة صريحة: WebGPU لسه مش مفعّل افتراضيًا على آيفون Safari — الموديل المحلي
> بيشتغل على كمبيوتر أو أندرويد حديث. للآيفون دلوقتي، النسخة السحابية (Groq)
> هي الجسر لحد ما WebGPU يتعمّم. الاتنين بيستخدموا نفس شخصية بردي.

أي خطوة تعلّق فيها، ابعتلي رسالة الخطأ وأنا أمشّيك خطوة خطوة. 🌱
