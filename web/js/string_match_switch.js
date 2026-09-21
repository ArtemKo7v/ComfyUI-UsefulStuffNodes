import { app } from "../../scripts/app.js";

const NODE_TYPE = "ArtemKo7vUsefulStuffNodesStringMatchSwitch";
const VALUE_PREFIX = "value_";
const CONTROL_PREFIX = "control_";
const MAX_OPTION_INDEX = 64;

function pairIndex(name) {
    const match = new RegExp(`^${VALUE_PREFIX}(\\d+)$`).exec(name ?? "");
    return match ? Number(match[1]) : null;
}

function pairs(node) {
    return (node.inputs ?? [])
        .map((input) => ({ input, index: pairIndex(input.name) }))
        .filter((pair) => pair.index !== null && pair.index >= 2)
        .sort((left, right) => left.index - right.index);
}

function controlWidget(node, index) {
    return node.widgets?.find((widget) => widget.name === `${CONTROL_PREFIX}${index}`);
}

function resetDynamicPairs(node) {
    for (let index = (node.inputs?.length ?? 0) - 1; index >= 0; index -= 1) {
        if (pairIndex(node.inputs[index].name) !== null) {
            node.removeInput(index);
        }
    }
    for (let index = (node.widgets?.length ?? 0) - 1; index >= 0; index -= 1) {
        if (node.widgets[index].name?.startsWith(CONTROL_PREFIX)) {
            node.widgets.splice(index, 1);
        }
    }
}

function markDirty(node) {
    const size = node.computeSize?.() ?? node.size;
    node.setSize?.([Math.max(node.size?.[0] ?? 0, size[0]), size[1]]);
    app.graph?.setDirtyCanvas?.(true, true);
}

function linkedType(node, input) {
    if (input?.link == null) {
        return "*";
    }

    const inputIndex = node.inputs.indexOf(input);
    const link = node.getInputLink?.(inputIndex)
        ?? node.graph?.links?.[input.link]
        ?? node.graph?.links?.get?.(input.link);
    return link?.type ?? "*";
}

function updateTypes(node) {
    const defaultInput = node.inputs?.find((input) => input.name === "default");
    const type = linkedType(node, defaultInput);
    for (const pair of pairs(node)) {
        pair.input.type = type;
    }
    if (node.outputs?.[0]) {
        node.outputs[0].type = type;
    }
}

function addPair(node, index) {
    if (!node.inputs?.some((input) => input.name === `${VALUE_PREFIX}${index}`)) {
        const defaultInput = node.inputs?.find((input) => input.name === "default");
        node.addInput(`${VALUE_PREFIX}${index}`, linkedType(node, defaultInput));
    }

    if (!controlWidget(node, index)) {
        node.addWidget("text", `${CONTROL_PREFIX}${index}`, "", () => {
            normalize(node);
            markDirty(node);
        });
    }
}

function removeLastPair(node, pair) {
    const widget = controlWidget(node, pair.index);
    if (widget && node.widgets) {
        node.widgets.splice(node.widgets.indexOf(widget), 1);
    }
    node.removeInput(node.inputs.indexOf(pair.input));
}

function normalize(node) {
    if (node.__stringMatchSwitchUpdating) {
        return;
    }
    node.__stringMatchSwitchUpdating = true;
    try {
        let nodePairs = pairs(node);
        if (nodePairs.length === 0) {
            addPair(node, 2);
            nodePairs = pairs(node);
        }

        let last = nodePairs.at(-1);
        if (last.input.link != null && last.index < MAX_OPTION_INDEX) {
            addPair(node, last.index + 1);
            nodePairs = pairs(node);
        }

        while (nodePairs.length > 1) {
            last = nodePairs.at(-1);
            const previous = nodePairs.at(-2);
            const lastEmpty = last.input.link == null && !controlWidget(node, last.index)?.value;
            const previousEmpty = previous.input.link == null && !controlWidget(node, previous.index)?.value;
            if (!lastEmpty || !previousEmpty) {
                break;
            }
            removeLastPair(node, last);
            nodePairs = pairs(node);
        }

        updateTypes(node);
    } finally {
        node.__stringMatchSwitchUpdating = false;
    }
}

function restorePairs(node, data) {
    const savedIndexes = (data?.inputs ?? [])
        .map((input) => pairIndex(input.name))
        .filter((index) => index !== null && index >= 2)
        .sort((left, right) => left - right);
    const highestIndex = Math.min(savedIndexes.at(-1) ?? 2, MAX_OPTION_INDEX);
    for (let index = 2; index <= highestIndex; index += 1) {
        addPair(node, index);
    }

    const savedWidgets = data?.widgets_values;
    if (Array.isArray(savedWidgets)) {
        for (let index = 2; index <= highestIndex; index += 1) {
            const widget = controlWidget(node, index);
            if (widget && savedWidgets[index - 1] !== undefined) {
                widget.value = savedWidgets[index - 1];
            }
        }
    }
}

app.registerExtension({
    name: "ArtemKo7v.UsefulStuffNodes.StringMatchSwitch",
    beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = onNodeCreated?.apply(this, arguments);
            const node = this;

            const originalOnConfigure = node.onConfigure;
            node.onConfigure = function (data) {
                restorePairs(this, data);
                originalOnConfigure?.apply(this, arguments);
                restorePairs(this, data);
                normalize(this);
                markDirty(this);
            };

            const originalOnConnectionsChange = node.onConnectionsChange;
            node.onConnectionsChange = function () {
                originalOnConnectionsChange?.apply(this, arguments);
                normalize(this);
                markDirty(this);
            };

            resetDynamicPairs(node);
            normalize(node);
            markDirty(node);
            return result;
        };
    },
});
