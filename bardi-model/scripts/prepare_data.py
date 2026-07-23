#!/usr/bin/env python3
"""
Bardi-3B · Step 1 — prepare the training data.

Reads every *.jsonl file in bardi-model/data/ (your seed + anything you
add), validates each conversation, removes duplicates, shuffles, and
splits into train / eval sets ready for the QLoRA trainer.

Each line must be one JSON object:
  {"messages": [
     {"role":"system","content":"..."},
     {"role":"user","content":"..."},
     {"role":"assistant","content":"..."}, ...
  ]}

Run:  python bardi-model/scripts/prepare_data.py
Out:  bardi-model/data/train.jsonl  and  bardi-model/data/eval.jsonl
"""
import json, glob, os, random, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
EVAL_FRACTION = 0.08          # ~8% held out to measure quality
random.seed(42)

def valid(convo):
    msgs = convo.get("messages")
    if not msgs or not isinstance(msgs, list):
        return False
    roles = [m.get("role") for m in msgs]
    if "user" not in roles or "assistant" not in roles:
        return False
    for m in msgs:
        if not str(m.get("content", "")).strip():
            return False
    return True

def key(convo):
    # dedupe on the exact message content
    blob = "".join(m["role"] + ":" + m["content"] for m in convo["messages"])
    return hashlib.md5(blob.encode("utf-8")).hexdigest()

def main():
    files = [f for f in glob.glob(os.path.join(DATA, "*.jsonl"))
             if os.path.basename(f) not in ("train.jsonl", "eval.jsonl")]
    seen, rows, skipped = set(), [], 0
    for path in files:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    convo = json.loads(line)
                except json.JSONDecodeError:
                    skipped += 1; continue
                if not valid(convo):
                    skipped += 1; continue
                k = key(convo)
                if k in seen:
                    continue
                seen.add(k); rows.append(convo)

    random.shuffle(rows)
    n_eval = max(1, int(len(rows) * EVAL_FRACTION)) if len(rows) > 12 else 0
    eval_rows, train_rows = rows[:n_eval], rows[n_eval:]

    with open(os.path.join(DATA, "train.jsonl"), "w", encoding="utf-8") as fh:
        for r in train_rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    with open(os.path.join(DATA, "eval.jsonl"), "w", encoding="utf-8") as fh:
        for r in eval_rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"sources: {len(files)} file(s)")
    print(f"skipped (invalid/bad JSON): {skipped}")
    print(f"train: {len(train_rows)}   eval: {len(eval_rows)}")
    if len(train_rows) < 300:
        print("\nTip: 300–5000 good examples make a real difference. Add more of")
        print("your own to bardi-model/data/ (see data/TEMPLATE.md), or expand with")
        print("scripts/expand_distill.py, then run this again.")

if __name__ == "__main__":
    main()
