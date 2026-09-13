import { app } from "../../scripts/app.js";

const ANY = "ArtemKo7vUsefulStuffNodesAnyInputSelector";
const PAIRS = "ArtemKo7vUsefulStuffNodesImageTextPairSelector";
const MATCH_ROUTER = "ArtemKo7vUsefulStuffNodesAnyMatchRouter";
const MAX = 64;
const dirty = n => { n.setSize?.(n.computeSize?.() ?? n.size); app.graph?.setDirtyCanvas?.(true, true); };
const entries = (n, p) => (n.inputs ?? []).map(input => ({ input, index: Number(new RegExp(`^${p}(\\d+)$`).exec(input.name ?? "")?.[1]) })).filter(x => Number.isInteger(x.index)).sort((a,b) => a.index-b.index);
const add = (n, name, type) => { if (!n.inputs?.some(x => x.name === name)) n.addInput(name, type); };
const type = (n, input) => {
    if (input?.link == null) return "*";
    const link = n.getInputLink?.(n.inputs.indexOf(input)) ?? n.graph?.links?.[input.link] ?? n.graph?.links?.get?.(input.link);
    return link?.type ?? "*";
};
function normalizeAny(n) {
    let xs = entries(n, "any_");
    if (!xs.length) add(n, "any_1", "*");
    xs = entries(n, "any_");
    if (xs.at(-1).input.link != null && xs.at(-1).index < MAX) add(n, `any_${xs.at(-1).index + 1}`, type(n, xs[0].input));
    xs = entries(n, "any_");
    while (xs.length > 1 && xs.at(-1).input.link == null && xs.at(-2).input.link == null) { n.removeInput(n.inputs.indexOf(xs.at(-1).input)); xs = entries(n, "any_"); }
    const t = type(n, xs[0].input); xs.forEach(x => x.input.type = t); if (n.outputs?.[0]) n.outputs[0].type = t;
}
const addPair = (n, i) => { add(n, `image_${i}`, "IMAGE"); add(n, `text_${i}`, "STRING"); };
function normalizePairs(n) {
    let is = entries(n, "image_"), ts = entries(n, "text_");
    if (!is.length || !ts.length) addPair(n, 1);
    is = entries(n, "image_"); ts = entries(n, "text_");
    if ((is.at(-1).input.link != null || ts.at(-1).input.link != null) && is.at(-1).index < MAX) addPair(n, is.at(-1).index + 1);
    is = entries(n, "image_"); ts = entries(n, "text_");
    while (is.length > 1 && is.at(-1).input.link == null && ts.at(-1).input.link == null && is.at(-2).input.link == null && ts.at(-2).input.link == null) { n.removeInput(n.inputs.indexOf(ts.at(-1).input)); n.removeInput(n.inputs.indexOf(is.at(-1).input)); is = entries(n, "image_"); ts = entries(n, "text_"); }
}
function removeInputs(n, prefixes) {
    const matches = name => prefixes.some(prefix => new RegExp(`^${prefix}\\d+$`).test(name ?? ""));
    for (let index = (n.inputs?.length ?? 0) - 1; index >= 0; index -= 1) {
        if (matches(n.inputs[index].name)) n.removeInput(index);
    }
    for (let index = (n.widgets?.length ?? 0) - 1; index >= 0; index -= 1) {
        if (matches(n.widgets[index].name)) n.widgets.splice(index, 1);
    }
}
function restore(n, data, prefixes, create) {
    const indexes = (data?.inputs ?? []).flatMap(x => prefixes.map(p => Number(new RegExp(`^${p}(\\d+)$`).exec(x.name ?? "")?.[1]))).filter(Number.isInteger);
    for (let i = 1; i <= Math.min(Math.max(1, ...indexes), MAX); i++) create(n, i);
}
function install(n, normalize, restoreInputs, reset) {
    const configured = n.onConfigure; n.onConfigure = function(data) { restoreInputs(this, data); configured?.apply(this, arguments); restoreInputs(this, data); normalize(this); };
    const changed = n.onConnectionsChange; n.onConnectionsChange = function() { changed?.apply(this, arguments); normalize(this); dirty(this); };
    reset?.(n); normalize(n);
}

const routerIndex = (name, prefix) => {
    const m = new RegExp("^" + prefix + "(\\d+)$").exec(name ?? "");
    return m ? Number(m[1]) : null;
};
const routerOptions = n => (n.widgets ?? []).map(widget => ({ widget, index: routerIndex(widget.name, "text_") })).filter(x => x.index !== null).sort((a, b) => a.index - b.index);
const routerOutput = (n, index) => n.outputs?.find(item => item.name === "any_out_" + index);
const routerType = n => type(n, n.inputs?.find(input => input.name === "any"));
const addRouterText = (n, index) => {
    if (!n.widgets?.some(widget => widget.name === "text_" + index)) {
        n.addWidget("text", "text_" + index, "", () => { normalizeRouter(n); dirty(n); });
    }
};
const syncRouterOutputs = n => {
    const active = new Set(routerOptions(n).filter(x => x.widget.value).map(x => x.index));
    for (let index = (n.outputs?.length ?? 0) - 1; index >= 0; index -= 1) {
        const outputIndex = routerIndex(n.outputs[index].name, "any_out_");
        if (outputIndex !== null && !active.has(outputIndex)) n.removeOutput(index);
    }
    const outputType = routerType(n);
    for (const index of [...active].sort((a, b) => a - b)) {
        const item = routerOutput(n, index);
        if (item) item.type = outputType;
        else n.addOutput("any_out_" + index, outputType);
    }
};
function normalizeRouter(n) {
    if (n.__anyMatchRouterUpdating) return;
    n.__anyMatchRouterUpdating = true;
    try {
        let xs = routerOptions(n);
        if (!xs.length) {
            addRouterText(n, 1);
            xs = routerOptions(n);
        }
        if (xs.at(-1).widget.value && xs.at(-1).index < MAX) {
            addRouterText(n, xs.at(-1).index + 1);
            xs = routerOptions(n);
        }
        while (xs.length > 1 && !xs.at(-1).widget.value && !xs.at(-2).widget.value) {
            n.widgets.splice(n.widgets.indexOf(xs.at(-1).widget), 1);
            xs = routerOptions(n);
        }
        syncRouterOutputs(n);
    } finally {
        n.__anyMatchRouterUpdating = false;
    }
}
function resetRouter(n) {
    for (let index = (n.widgets?.length ?? 0) - 1; index >= 0; index -= 1) {
        if (routerIndex(n.widgets[index].name, "text_") !== null) n.widgets.splice(index, 1);
    }
    for (let index = (n.outputs?.length ?? 0) - 1; index >= 0; index -= 1) {
        if (routerIndex(n.outputs[index].name, "any_out_") !== null) n.removeOutput(index);
    }
}
function restoreRouter(n, data) {
    const saved = Array.isArray(data?.widgets_values) ? data.widgets_values : [];
    let highestFilled = 0;
    for (let index = 1; index <= MAX; index += 1) {
        if (saved[index]) highestFilled = index;
    }
    const highestText = Math.min(Math.max(1, highestFilled + 1), MAX);
    for (let index = 1; index <= highestText; index += 1) {
        addRouterText(n, index);
        const widget = n.widgets?.find(item => item.name === "text_" + index);
        if (widget && saved[index] !== undefined) widget.value = saved[index];
    }
}
function installRouter(n) {
    const configured = n.onConfigure;
    n.onConfigure = function(data) {
        n.__anyMatchRouterConfigured = true;
        resetRouter(this);
        restoreRouter(this, data);
        normalizeRouter(this);
        configured?.apply(this, arguments);
        normalizeRouter(this);
    };
    const changed = n.onConnectionsChange;
    n.onConnectionsChange = function() {
        changed?.apply(this, arguments);
        normalizeRouter(this);
        dirty(this);
    };
    resetRouter(n);
    normalizeRouter(n);
    setTimeout(() => {
        if (!n.__anyMatchRouterConfigured) {
            resetRouter(n);
            normalizeRouter(n);
            dirty(n);
        }
    }, 0);
}

app.registerExtension({ name: "ArtemKo7v.UsefulStuffNodes.DynamicSelectors", nodeCreated(n) {
    if (n.constructor.type === ANY) install(n, normalizeAny, (x,d) => restore(x,d,["any_"], (node,i) => add(node, `any_${i}`, "*")), node => removeInputs(node, ["any_"]));
    if (n.constructor.type === PAIRS) install(n, normalizePairs, (x,d) => restore(x,d,["image_", "text_"], addPair), node => removeInputs(node, ["image_", "text_"]));
    if (n.constructor.type === MATCH_ROUTER) installRouter(n);
}});