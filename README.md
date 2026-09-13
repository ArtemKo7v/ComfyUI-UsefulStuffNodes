# ComfyUI-UsefulStuffNodes

Utility ComfyUI custom nodes that add a few small helpers for workflows.

## Nodes

- **Empty String** — returns an empty `STRING`.
- **Unix Timestamp** — returns the current Unix timestamp as an `INT`. `current` is freshly generated on every execution. `saved` returns the value that was stored in the node before this execution; after execution, the new current value is written into `last_value` so it can be saved with the workflow.
- **Random Long INT** — returns a large positive random `INT` in the signed 64-bit range. `current` is freshly generated on every execution. `saved` returns the value that was stored in the node before this execution; after execution, the new current value is written into `last_value` so it can be saved with the workflow.
- **Boolean Random** — returns a random `BOOLEAN`: `true` or `false`. `current` is freshly generated on every execution. `saved` returns the value stored in the node before this execution; after execution, the new current value is written into `last_value` so it can be saved with the workflow.
- **String Match Switch** — passes through the first connected option whose control string exactly equals `match`; otherwise it returns the required `default` input. Connecting an option adds the next option/control pair. Disconnected options never participate. The UI expands as needed, up to 63 selectable options.
- **Any Match Router** — sends one input value to the first any_out_N whose text_N exactly equals match. Filling the last text field adds the next text/output pair. If nothing matches, every output is None.

The `last_value` widget is a read-only native value: `INT` for integer nodes and `BOOLEAN` for Boolean Random. On a newly created node, the initial saved value is `0` for integer nodes and `false` for Boolean Random.

## Installation

Use ComfyUI Manager or copy this folder into `ComfyUI/custom_nodes/` and restart ComfyUI. Reload the browser page after installing or updating the node pack so the frontend extension is loaded.
