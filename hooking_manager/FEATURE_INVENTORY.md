# Krea2 Hooking Manager feature inventory

Issue: #14

## Keep: generation-critical

| Surface | Why it stays |
| --- | --- |
| PocketRisu ComfyUI proxy (`/prompt`, `/history`, `/view`, `/ws`) | Required to receive image requests and return generated images. |
| Illustration queue and progress WebSocket | Serializes Krea2 jobs and makes partial failures visible without blocking later jobs. |
| Backup gallery, prompt view, regeneration, reschedule, prompt edit | Directly operates on chatbot-generated illustrations. |
| Workflow load/reload and conversion diagnostics | Required to recover when a workflow changes or ComfyUI nodes drift. |
| Krea2 character LoRA catalog, aliases, strengths, preset routes | Core identity/style routing feature. |
| Krea2 resolution override and workflow-default reset | Core generation configuration. |
| Cloudflare share start/status/stop and link copy | Required for the user's current remote PocketRisu workflow. |
| Compact runtime status and error log | Directly helps diagnose ComfyUI, workflow, queue, and mapping failures. |

## Remove: no Krea2 dependency

| Surface | Evidence |
| --- | --- |
| GitHub announcement board and notification cache | Fetches a separate announcement repository; never participates in generation. |
| Batch completion sound/tab flashing | Belongs to removed legacy batch generation and is not queue progress. |
| Asset generation/upload/export | Uses separate workflows and asset storage; current Krea2 config does not call it. |
| Pose detection/editor and DWPose model management | Depth/pose workflow was explicitly removed from the target workflow. |
| Outfit extraction and prompt enhancement | Disabled in `config.json`; no Krea2 proxy dependency. |
| Asset auto-match, embedding profiles, chain presets | Supports asset classification, not chatbot illustration delivery. |
| Generic/character/bot/instance LoRA training and galleries | Krea2 routing only reads existing Power LoRA Loader entries; it does not train/manage model files. |
| Bot illustration builder and legacy bot data patch tools | `bot_mode_enabled` is false; PocketRisu module now supplies the final Krea2 prompt. |
| Asset-oriented workflow tests and input-folder patching | Operates removed asset/reference pipelines. |

## Operator layout

1. **Gallery**: generated image history and per-image actions.
2. **Krea2 setup**: resolution presets/manual dimensions, preset routing, character LoRA mappings.
3. **Operations**: ComfyUI/workflow status, queue, share link, compact settings and diagnostics.

The retained general WebSocket notifier is not an announcement feature. It carries queue progress, backup-created, reschedule, and connection-state events.
