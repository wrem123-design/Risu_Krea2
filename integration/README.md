# PocketRisu Krea2 illustration integration

This installation is isolated from `D:\ComfyUI-Easy-Install` except for model
directory junctions. Normal generation reads those shared model files; the
existing ComfyUI installation and original module remain unchanged.

## Runtime endpoints

- Krea2 ComfyUI: `http://127.0.0.1:8190`
- Hooking Manager / PocketRisu image endpoint: `http://127.0.0.1:8189`

Double-click `E:\Chatbot\Start Krea2 Chatbot.bat` after a reboot to start both
services and PocketRisu. The batch file calls `start_krea2_stack.ps1`, which is idempotent and
does not start a second process when a port is already listening.
The ComfyUI process uses the same `--use-flash-attention` and isolated Python
launch mode as `D:\ComfyUI-Easy-Install\Start ComfyUI FlashAttention.bat`.

The original LightBoard 3.4.0 backend is used unchanged. Image-count completion
belongs to the illustration module's final output boundary and does not require
backend-wide validation retry changes. Set the backend's standard `최대 시도`
control to `2` to retain focused repair for genuinely missing fields.

## PocketRisu setup

1. Open Settings → Modules and import
   `E:\Chatbot\Download\모듈\🔦라이트보드 🌠 삽화 Krea2 4.4.16.module.charx`.
   Do not use the main character drag-and-drop importer. Remove or unbind an
   earlier Krea2 copy, then bind the newly imported module to the bot/chat.
2. In Settings → Other bots → Image generation, select ComfyUI.
3. Set the request URL to `http://127.0.0.1:8189`.
4. Paste the contents of `artifacts\Krea2_turbo_chatbot_api.json` into Workflow.
5. Add or replace the per-bot lorebook named exactly `lb-xnai.lb.extra` using
   `templates\lb-xnai.lb.extra-krea2.txt`. Replace the placeholders with each
   bot's fixed English appearance profiles. Character-specific profile data is
   intentionally not stored in this public repository.

The module defaults to four to six image descriptions per response. Its menu can
instead require an exact total from one through six. The same count is injected
into the auxiliary-model instructions and enforced by the validator, and an
optional key visual counts toward that total. Each description
is assembled into five English natural-language paragraphs: appearance, outfit,
background, composition, and details. The negative prompt is empty.
Each descriptor targets 280–420 English words. Missing paragraphs are repaired,
while shorter non-empty prose is retained so a weak auxiliary model does not
replace a usable response with a worse full rewrite.
Version 4.4.16 declares `character_count` as 1, 2, or 3. It retains dialogue,
mutual gaze, touch, confrontation, and other visible interactions when they are
part of the selected moment. A single-person descriptor sends the primary
character's canonical English name as an internal routing marker, and Hooking
Manager applies at most one exactly matched character LoRA. A two- or
three-person descriptor sends a multi-character marker that always bypasses the
dynamic LoRA node, preventing one identity LoRA from affecting every face.
Empty or unmatched single-person names also bypass the dynamic LoRA node.
The validator still requests targeted rewrites for prose below the documented
minimums. If a backend reports validation complete with slightly short but
non-empty prose, the final generator now degrades gracefully instead of blocking
the image request with a duplicate word-count gate.
`프리셋 1` assembles `{appearance}`, `{outfit}`, `{background}`,
`{composition}`, and `{details}` as five paragraphs. Its fifth paragraph prefixes
`{details}` with the fixed smartphone and photorealistic style. Module generation
rules keep `{details}` style-neutral, so another preset can later replace only the
style prefix to produce 2D or another rendering medium. The preset remains
positive-only and does not require a `[Negative]` section.

The module menu retains only settings that are read by active Lua, prompt macros,
or legacy post-processing. `생성 장수` selects automatic 4–6 output or an exact
1–6 total. `키비주얼` selects automatic, required, or disabled keyvis behavior.
`장면 선택` selects balanced distribution, strongest-moment priority, or later-scene
priority. Changes apply to the next illustration request without a restart. Prompt
activation, image activation, preset number, key-visual position, and saved-history
count remain available. PocketRisu select controls are interpreted by their stored
zero-based indices. Disabled keyvis is enforced both during validation and immediately
before image generation, key-visual position now controls top/bottom placement, and
saved-history count is clamped to 1–20. Unused NAI-era controls are removed.

The 4.4.16 output hook removes malformed descriptors before any ComfyUI request,
converts a valid disabled key visual into an ordinary scene, and asks the auxiliary
model twice for every missing descriptor. It no longer fills the image count by
cloning one scene, so malformed or duplicate retries stop with a clear error instead
of producing near-identical images. The output boundary imports a versioned generator
entry and records planned, successful, and failed generation counts in
`lb-xnai-last-generation-debug`.
If every initial descriptor is malformed, it requests a new complete seed scene
before filling the remaining count instead of requiring an existing valid scene.
Initial planning and focused repair both treat meaningful cast coverage as a soft
tie-breaker after story relevance. Repeated protagonist-only shots yield to an
equally meaningful supporting-character or interaction moment, but passive people
are never promoted and no gender or cast quota is enforced. Focused repairs also
receive the active balanced, strongest-moment, or later-moment selection policy and
a summary of the characters already represented in the selected image set.
Focused repairs receive the story with its real `[Slot N]` paragraph markers and
must copy an unused marker nearest the selected event. The fixed `slot: 0` example
and sequential fallback assignment are removed. Invalid or duplicate slots are
discarded and regenerated. With key visuals disabled, an unplaced key visual is
replaced by a properly slotted ordinary scene instead of being inserted at the
first paragraph boundary.
For balanced and later-scene selection, a long story whose returned slots are an
obvious ordinal top cluster such as `0,1,2,3` is rebuilt from the marked story.
Strongest-moment selection keeps clustered slots because the strongest events may
legitimately occur close together.

Temporary extras use per-descriptor identity records and a chat-scoped
`lb-xnai-extra-registry-v1` state. Only records marked `source=extra` are retained,
up to the configured 1–50 limit, and the immutable appearance is injected into the
next auxiliary-model request through a separate chat variable. The canonical
`lb-xnai.lb.extra` lorebook is read-only and takes precedence on normalized English
or Korean name collisions. Temporary extras never receive character LoRA routing.

## Workflow contract

The active model path is:

`Krea2 → PatchFlashAttentionKJ → fedor_bypass → KSampler → VAE Decode → SaveImage`

When a single visible character is mapped in Hooking Manager, one request temporarily becomes
`fedor_bypass → selected character LoRA → KSampler`. The source Power LoRA
Loader remains read-only and is used only to populate filenames and defaults.

For scenes with two or three identifiable characters, the request remains
`fedor_bypass → KSampler`; no character LoRA is inserted.

Fixed-person identity LoRAs, Depth Control, source-image motion transfer, Power
LoRA Loader, and the PiD upscaler are absent. Hooking Manager remains in the path
for queueing, history/view compatibility, gallery backups, and optional tunnel
sharing; its legacy bot rewriting, batching, and weight clamping are disabled.

## Backups and logs

- Previous Hooking Manager config: `comfypack\comfyui_hooking_server\config.pre-krea2.json`
- Previous Hooking Manager workflow: `krea2_integration\backups\hook_workflow_pre_krea2`
- Runtime logs: `krea2_integration\logs`
