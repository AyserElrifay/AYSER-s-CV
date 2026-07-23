#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Bardi-3B · Step 3 — make your trained model run INSIDE Moments.
#
# Converts your merged model to MLC (the format WebLLM runs in the
# browser), then uploads it to Hugging Face under your name. Because it's
# a Qwen2.5-3B fine-tune, WebLLM already has the compiled runtime for that
# architecture — so you only ship the WEIGHTS, no wasm compiling needed.
#
# Usage:
#   export HF_USER=your-huggingface-username
#   export HF_TOKEN=hf_...            # a write token from huggingface.co/settings/tokens
#   bash bardi-model/scripts/export_mlc.sh
# ─────────────────────────────────────────────────────────────────────
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
MERGED="$HERE/../out/bardi-3b-merged"
MLC_OUT="$HERE/../out/Bardi-3B-q4f16_1-MLC"
QUANT="q4f16_1"           # the same quantisation WebLLM uses for Qwen2.5-3B

: "${HF_USER:?set HF_USER to your huggingface username}"

echo "→ installing mlc-llm (one time)…"
pip install --quiet --pre -U mlc-llm-nightly-cpu mlc-ai-nightly-cpu -f https://mlc.ai/wheels || true
pip install --quiet -U "huggingface_hub[cli]"

echo "→ converting weights to MLC ($QUANT)…"
mlc_llm convert_weight "$MERGED" --quantization "$QUANT" -o "$MLC_OUT"

echo "→ generating chat config (Qwen2 template)…"
mlc_llm gen_config "$MERGED" --quantization "$QUANT" \
  --conv-template qwen2 --context-window-size 4096 -o "$MLC_OUT"

echo "→ uploading to Hugging Face: $HF_USER/Bardi-3B-$QUANT-MLC …"
huggingface-cli upload "$HF_USER/Bardi-3B-$QUANT-MLC" "$MLC_OUT" . --repo-type model

cat <<EOF

✅ Uploaded: https://huggingface.co/$HF_USER/Bardi-3B-$QUANT-MLC

LAST STEP — turn it on in the app. Edit src/services/bardiLocal.js and set:

  export const CUSTOM_BARDI_MODEL = {
    id: 'Bardi-3B-$QUANT-MLC',
    url: 'https://huggingface.co/$HF_USER/Bardi-3B-$QUANT-MLC/resolve/main/',
    // WebLLM already ships the runtime for Qwen2.5-3B — reuse that lib:
    libUrl: 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/Qwen2.5-3B-Instruct-$QUANT-ctx4k_cs1k-webgpu.wasm',
  };

Then "Bardi model on your device" runs YOUR Bardi-3B — your weights, your
voice, 100% private, no Claude and no Groq. (Grab the exact current libUrl
from WebLLM's prebuiltAppConfig if that filename ever changes.)
EOF
