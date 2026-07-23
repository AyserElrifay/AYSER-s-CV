#!/usr/bin/env python3
"""
Bardi-3B · (optional) — grow your dataset by DISTILLATION.

The exact trick DeepSeek used for their small models: let a big, strong
model write MANY more coaching examples in YOUR style, seeded by your own
examples. You review/keep the good ones; that becomes training data.

This uses Groq (free, fast) with a big Llama model. Set GROQ_API_KEY first.
It NEVER touches real user data — it only generates fresh, synthetic
coaching scenarios in Bardi's voice.

Run:
  export GROQ_API_KEY=gsk_...
  python bardi-model/scripts/expand_distill.py --n 200
Out:  bardi-model/data/synthetic_bardi.jsonl   (REVIEW before training!)
"""
import os, json, argparse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
OUT  = os.path.join(DATA, "synthetic_bardi.jsonl")

SYS = ("أنت بردي، لايف كوتش ومعالج نفسي لطيف بتتكلم بالعامية المصرية. بتسمع كويس، "
       "بتسأل قبل ما تنصح، بتسمّي الإحساس قبل ما تحاول تحلّه، ردودك قصيرة وإنسانية "
       "وصادقة، وبتسأل سؤال واحد في المرة.")

GEN_PROMPT = (
    "اكتبلي مثال تدريب واحد لكوتش اسمه بردي بالعامية المصرية على هيئة JSON بالظبط كده "
    '{"messages":[{"role":"system","content":"<system>"},{"role":"user","content":"<موقف حقيقي لشخص>"},'
    '{"role":"assistant","content":"<رد بردي: قصير، بيسمّي الإحساس، بيسأل سؤال واحد قبل النصيحة>"}] } '
    "خلي الموقف مختلف ومتنوع (شغل، دراسة، علاقات، قلق، حزن، دافع، عادات، قرارات). "
    "رجّعلي السطر JSON بس من غير أي كلام تاني."
)

def groq_chat(key, messages, model="llama-3.3-70b-versatile"):
    body = json.dumps({"model": model, "messages": messages,
                       "temperature": 0.9, "max_tokens": 700}).encode("utf-8")
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions", data=body,
        headers={"content-type": "application/json", "authorization": "Bearer " + key})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read())
    return data["choices"][0]["message"]["content"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=100, help="how many examples to generate")
    args = ap.parse_args()
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        raise SystemExit("Set GROQ_API_KEY first (free key at console.groq.com).")

    kept = 0
    with open(OUT, "a", encoding="utf-8") as out:
        for i in range(args.n):
            try:
                raw = groq_chat(key, [
                    {"role": "system", "content": "You output exactly one JSONL line, nothing else."},
                    {"role": "user", "content": GEN_PROMPT.replace("<system>", SYS)},
                ])
                raw = raw.strip().strip("`").strip()
                if raw.startswith("json"):
                    raw = raw[4:].strip()
                obj = json.loads(raw)
                assert obj["messages"][1]["role"] == "user"
                assert obj["messages"][2]["role"] == "assistant"
                obj["messages"][0]["content"] = SYS   # force the exact system line
                out.write(json.dumps(obj, ensure_ascii=False) + "\n")
                kept += 1
                if kept % 10 == 0:
                    print(f"  generated {kept}/{args.n}")
            except Exception as e:
                print("  skipped one:", e)

    print(f"\n✅ wrote {kept} examples to {OUT}")
    print("IMPORTANT: open it and delete anything weak or off-tone before training —")
    print("your taste is what makes Bardi *Bardi*. Then run prepare_data.py again.")

if __name__ == "__main__":
    main()
