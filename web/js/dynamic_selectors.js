import { app } from "../../scripts/app.js";

const ANY = "ArtemKo7vUsefulStuffNodesAnyInputSelector";
const PAIRS = "ArtemKo7vUsefulStuffNodesImageTextPairSelector";
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
app.registerExtension({ name: "ArtemKo7v.UsefulStuffNodes.DynamicSelectors", nodeCreated(n) {
    if (n.constructor.type === ANY) install(n, normalizeAny, (x,d) => restore(x,d,["any_"], (node,i) => add(node, `any_${i}`, "*")), node => removeInputs(node, ["any_"]));
    if (n.constructor.type === PAIRS) install(n, normalizePairs, (x,d) => restore(x,d,["image_", "text_"], addPair), node => removeInputs(node, ["image_", "text_"]));
}});