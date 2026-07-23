#!/usr/bin/env python3
"""
Bardi-3B · Step 2 — fine-tune with QLoRA (the DeepSeek small-model recipe).

Takes an open base model (Qwen2.5-3B-Instruct — strong Arabic) and trains a
small LoRA adapter on YOUR coaching data, then merges it into a standalone
model. Uses Unsloth: ~2x faster, fits a free/cheap GPU (Colab T4, or a
RunPod A10/RTX-4090 for ~$0.3–0.5/hr). Training takes minutes-to-an-hour,
not months.

Run on a GPU box:
  pip install -r bardi-model/requirements.txt
  python bardi-model/scripts/prepare_data.py
  python bardi-model/scripts/train_qlora.py

Output: bardi-model/out/bardi-3b-merged/   (a full HF model, your weights)
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
OUT  = os.path.join(HERE, "..", "out")
os.makedirs(OUT, exist_ok=True)

# ── knobs you might tweak ──────────────────────────────────────────────
BASE_MODEL   = "unsloth/Qwen2.5-3B-Instruct"   # open weights, great Arabic
MAX_SEQ_LEN  = 2048
LORA_RANK    = 16          # bigger = more capacity, more VRAM
EPOCHS       = 3           # 2–4 is usually right for a few-thousand examples
LR           = 2e-4
BATCH        = 2
GRAD_ACCUM   = 4           # effective batch = BATCH * GRAD_ACCUM
# ───────────────────────────────────────────────────────────────────────

def main():
    from unsloth import FastLanguageModel
    from unsloth.chat_templates import train_on_responses_only
    from datasets import load_dataset
    from trl import SFTTrainer, SFTConfig

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=BASE_MODEL,
        max_seq_length=MAX_SEQ_LEN,
        load_in_4bit=True,       # QLoRA = 4-bit base, tiny trainable adapter
    )
    model = FastLanguageModel.get_peft_model(
        model,
        r=LORA_RANK,
        lora_alpha=LORA_RANK,
        lora_dropout=0.0,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                        "gate_proj", "up_proj", "down_proj"],
        use_gradient_checkpointing="unsloth",
        random_state=42,
    )

    # apply Qwen's chat template so the model learns the real chat format
    def fmt(ex):
        return {"text": tokenizer.apply_chat_template(
            ex["messages"], tokenize=False, add_generation_prompt=False)}

    train_ds = load_dataset("json", data_files=os.path.join(DATA, "train.jsonl"), split="train").map(fmt)
    eval_path = os.path.join(DATA, "eval.jsonl")
    eval_ds = None
    if os.path.exists(eval_path) and os.path.getsize(eval_path) > 2:
        eval_ds = load_dataset("json", data_files=eval_path, split="train").map(fmt)

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        args=SFTConfig(
            output_dir=os.path.join(OUT, "checkpoints"),
            dataset_text_field="text",
            max_seq_length=MAX_SEQ_LEN,
            per_device_train_batch_size=BATCH,
            gradient_accumulation_steps=GRAD_ACCUM,
            num_train_epochs=EPOCHS,
            learning_rate=LR,
            warmup_ratio=0.05,
            logging_steps=5,
            save_strategy="epoch",
            lr_scheduler_type="cosine",
            optim="adamw_8bit",
            seed=42,
            report_to="none",
        ),
    )

    # only train on Bardi's REPLIES (mask the user turns) — sharper coaching
    try:
        trainer = train_on_responses_only(
            trainer,
            instruction_part="<|im_start|>user\n",
            response_part="<|im_start|>assistant\n",
        )
    except Exception as e:
        print("note: response-only masking skipped:", e)

    trainer.train()

    # merge the LoRA adapter into the base → a standalone model (your weights)
    merged = os.path.join(OUT, "bardi-3b-merged")
    model.save_pretrained_merged(merged, tokenizer, save_method="merged_16bit")
    print("\n✅ Done. Your Bardi model is at:", merged)
    print("Next: bash bardi-model/scripts/export_mlc.sh   (make it run in the app)")

if __name__ == "__main__":
    main()
