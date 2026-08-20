import { app } from "../../scripts/app.js";

const STATEFUL_NODE_TYPES = new Set([
    "ArtemKo7vUsefulStuffNodesUnixTimestamp",
    "ArtemKo7vUsefulStuffNodesRandomLongInt",
]);

app.registerExtension({
    name: "ArtemKo7v.UsefulStuffNodes.StoredValue",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        const nodeName = nodeData?.name ?? nodeType?.ComfyClass ?? nodeType?.comfyClass;
        if (!STATEFUL_NODE_TYPES.has(nodeName)) {
            return;
        }

        const originalOnExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            originalOnExecuted?.apply(this, arguments);

            const storedValue = message?.stored_value?.[0];
            if (storedValue === undefined || storedValue === null) {
                return;
            }

            const widget = this.widgets?.find((item) => item.name === "last_value");
            if (!widget) {
                return;
            }

            widget.value = String(storedValue);
            app.graph?.setDirtyCanvas?.(true, true);
        };
    },
});
