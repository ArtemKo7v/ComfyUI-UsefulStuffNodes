import { app } from "../../scripts/app.js";

const BRANCH_NAMES = {
    ArtemKo7vUsefulStuffNodesAnySwitch: {
        outputs: { any_out_1: "out_true", any_out_2: "out_false" },
    },
    ArtemKo7vUsefulStuffNodesAnyIfElse: {
        inputs: { any_1: "in_true", any_2: "in_false" },
    },
};

function renameSlots(slots, names) {
    for (const slot of slots ?? []) {
        const name = names?.[slot.name];
        if (!name) continue;
        if (slot.label === slot.name) slot.label = name;
        slot.name = name;
    }
}

app.registerExtension({
    name: "ArtemKo7v.UsefulStuffNodes.BooleanBranches",
    beforeRegisterNodeDef(nodeType, nodeData) {
        const names = BRANCH_NAMES[nodeData.name];
        if (!names) return;

        const configure = nodeType.prototype.configure;
        nodeType.prototype.configure = function (data) {
            // Migrate before ComfyUI matches saved inputs to the current definition.
            renameSlots(data?.inputs, names.inputs);
            renameSlots(data?.outputs, names.outputs);
            return configure.apply(this, arguments);
        };
    },
});
