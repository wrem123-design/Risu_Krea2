# PocketRisu Krea2 illustration integration

This installation is isolated from `D:\ComfyUI-Easy-Install` except for model
directory junctions. Normal generation reads those shared model files; the
existing ComfyUI installation and original module remain unchanged.

## Runtime endpoints

- Krea2 ComfyUI: `http://127.0.0.1:8190`
- Hooking Manager / PocketRisu image endpoint: `http://127.0.0.1:8189`

Run `start_krea2_stack.ps1` to start both services. The script is idempotent and
does not start a second process when a port is already listening.
The ComfyUI process uses the same `--use-flash-attention` and isolated Python
launch mode as `D:\ComfyUI-Easy-Install\Start ComfyUI FlashAttention.bat`.

## PocketRisu setup

1. Open Settings → Modules and import
   `E:\Chatbot\Download\모듈\🔦라이트보드 🌠 삽화 Krea2 4.2.module.charx`.
   Do not use the main character drag-and-drop importer. Remove or unbind an
   earlier Krea2 copy, then bind the newly imported module to the bot/chat.
2. In Settings → Other bots → Image generation, select ComfyUI.
3. Set the request URL to `http://127.0.0.1:8189`.
4. Paste the contents of `artifacts\Krea2_turbo_chatbot_api.json` into Workflow.
5. Add or replace the per-bot lorebook named exactly `lb-xnai.lb.extra` using
   `templates\lb-xnai.lb.extra-krea2.txt`. Replace the placeholders with each
   bot's fixed English appearance profiles. Character-specific profile data is
   intentionally not stored in this public repository.

The module creates four to six image descriptions per response. Each description
is assembled into five English natural-language paragraphs: appearance, outfit,
background, composition, and details. The negative prompt is empty.
Each descriptor targets 280–420 English words, and the module rejects missing
or underspecified paragraphs before requesting an image.
Version 4.2 also sends the descriptor's canonical English character name as an
internal routing marker. Hooking Manager removes that marker before CLIP
encoding and applies at most one exactly matched character LoRA. Empty or
unmatched names bypass the dynamic LoRA node completely.
Only `프리셋 1` is included, and its complete content is
`[Positive]` followed by `{prompt}`. The Lua parser accepts this positive-only
preset without requiring a `[Negative]` section.

## Workflow contract

The active model path is:

`Krea2 → PatchFlashAttentionKJ → fedor_bypass → KSampler → VAE Decode → SaveImage`

When a character is mapped in Hooking Manager, one request temporarily becomes
`fedor_bypass → selected character LoRA → KSampler`. The source Power LoRA
Loader remains read-only and is used only to populate filenames and defaults.

Fixed-person identity LoRAs, Depth Control, source-image motion transfer, Power
LoRA Loader, and the PiD upscaler are absent. Hooking Manager remains in the path
for queueing, history/view compatibility, gallery backups, and optional tunnel
sharing; its legacy bot rewriting, batching, and weight clamping are disabled.

## Backups and logs

- Previous Hooking Manager config: `comfypack\comfyui_hooking_server\config.pre-krea2.json`
- Previous Hooking Manager workflow: `krea2_integration\backups\hook_workflow_pre_krea2`
- Runtime logs: `krea2_integration\logs`
