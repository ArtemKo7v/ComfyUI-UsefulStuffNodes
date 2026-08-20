# ComfyUI-UsefulStuffNodes

Utility ComfyUI custom nodes that add a few small helpers for workflows.

## Nodes

- **Empty String** — returns an empty `STRING`.
- **Unix Timestamp** — returns the current Unix timestamp as an `INT`. `current` is freshly generated on every execution. `saved` returns the value that was stored in the node before this execution; after execution, the new current value is written into `last_value` so it can be saved with the workflow.
- **Random Long INT** — returns a large positive random `INT` in the signed 64-bit range. `current` is freshly generated on every execution. `saved` returns the value that was stored in the node before this execution; after execution, the new current value is written into `last_value` so it can be saved with the workflow.

The `last_value` widget is stored as text so large integers are preserved exactly in workflow JSON without JavaScript number precision loss. On a newly created node, the initial saved value is `0`.

## Installation

Use ComfyUI Manager or copy this folder into `ComfyUI/custom_nodes/` and restart ComfyUI. Reload the browser page after installing or updating the node pack so the frontend extension is loaded.
