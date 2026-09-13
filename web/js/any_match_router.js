import { app } from "../../scripts/app.js";

const NODE_TYPE = "ArtemKo7vUsefulStuffNodesAnyMatchRouter";
const TEXT_PREFIX = "text_";
const OUTPUT_PREFIX = "any_out_";
const MAX_OPTION_INDEX = 64;

function optionIndex(name, prefix) {
    const match = new RegExp("^" + prefix + "(\\d+)$").exec(name ?? "");
    return match ? Number(match[1]) : null;
}

function options(node) {
    return (node.widgets ?? [])
        .map((widget) => ({ widget, index: optionIndex(widget.name, TEXT_PREFIX) }))
        .filter((option) => option.index !== null)
        .sort((left, right) => left.index - right.index);
}

function output(node, index) {
    return node.outputs?.find((item) => item.name === OUTPUT_PREFIX + index);
}

function markDirty(node) {
    node.setSize?.(node.computeSize?.() ?? node.size);
    app.graph?.setDirtyCanvas?.(true, true);
}

function linkedType(node) {
    const input = node.inputs?.find((item) => item.name === "any");
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
    const type = linkedType(node);
    for (const item of node.outputs ?? []) {
        if (optionIndex(item.name, OUTPUT_PREFIX) !== null) {
            item.type = type;
        }
    }
}

function addOption(node, index) {
    if (!node.widgets?.some((widget) => widget.name === TEXT_PREFIX + index)) {
        node.addWidget("text", TEXT_PREFIX + index, "", () => {
            normalize(node);
            markDirty(node);
        });
    }
    if (!output(node, index)) {
        node.addOutput(OUTPUT_PREFIX + index, linkedType(node));
    }
}

function removeLastOption(node, option) {
    const widgetIndex = node.widgets.indexOf(option.widget);
    if (widgetIndex >= 0) {
        node.widgets.splice(widgetIndex, 1);
    }
    const item = output(node, option.index);
    if (item) {
        node.removeOutput(node.outputs.indexOf(item));
    }
}

function normalize(node) {
    if (node.__anyMatchRouterUpdating) {
        return;
    }
    node.__anyMatchRouterUpdating = true;
    try {
        let nodeOptions = options(node);
        if (nodeOptions.length === 0) {
            addOption(node, 1);
            nodeOptions = options(node);
        }

        let last = nodeOptions.at(-1);
        if (last.widget.value && last.index < MAX_OPTION_INDEX) {
            addOption(node, last.index + 1);
            nodeOptions = options(node);
        }

        while (nodeOptions.length > 1) {
            last = nodeOptions.at(-1);
            const previous = nodeOptions.at(-2);
            if (last.widget.value || previous.widget.value) {
                break;
            }
            removeLastOption(node, last);
            nodeOptions = options(node);
        }
        updateTypes(node);
    } finally {
        node.__anyMatchRouterUpdating = false;
    }
}

function resetOptions(node) {
    for (let index = (node.widgets?.length ?? 0) - 1; index >= 0; index -= 1) {
        if (optionIndex(node.widgets[index].name, TEXT_PREFIX) !== null) {
            node.widgets.splice(index, 1);
        }
    }
    for (let index = (node.outputs?.length ?? 0) - 1; index >= 0; index -= 1) {
        if (optionIndex(node.outputs[index].name, OUTPUT_PREFIX) !== null) {
            node.removeOutput(index);
        }
    }
}

function restoreOptions(node, data) {
    const savedIndexes = (data?.outputs ?? [])
        .map((item) => optionIndex(item.name, OUTPUT_PREFIX))
        .filter((index) => index !== null)
        .sort((left, right) => left - right);
    const highestIndex = Math.min(savedIndexes.at(-1) ?? 1, MAX_OPTION_INDEX);
    for (let index = 1; index <= highestIndex; index += 1) {
        addOption(node, index);
    }

    if (Array.isArray(data?.widgets_values)) {
        for (let index = 1; index <= highestIndex; index += 1) {
            const widget = node.widgets?.find((item) => item.name === TEXT_PREFIX + index);
            if (widget && data.widgets_values[index] !== undefined) {
                widget.value = data.widgets_values[index];
            }
        }
    }
}

app.registerExtension({
    name: "ArtemKo7v.UsefulStuffNodes.AnyMatchRouter",
    nodeCreated(node) {
        if (node.constructor.type !== NODE_TYPE) {
            return;
        }

        const originalOnConfigure = node.onConfigure;
        node.onConfigure = function (data) {
            restoreOptions(this, data);
            originalOnConfigure?.apply(this, arguments);
            restoreOptions(this, data);
            normalize(this);
        };

        const originalOnConnectionsChange = node.onConnectionsChange;
        node.onConnectionsChange = function () {
            originalOnConnectionsChange?.apply(this, arguments);
            normalize(this);
            markDirty(this);
        };

        resetOptions(node);
        normalize(node);
    },
});
