const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const extensions = [];
const app = { registerExtension: extension => extensions.push(extension), graph: { setDirtyCanvas() {} } };
for (const filename of ["dynamic_selectors.js", "string_match_switch.js"]) {
    const source = fs.readFileSync(path.join(__dirname, "../web/js", filename), "utf8")
        .replace('import { app } from "../../scripts/app.js";', "");
    vm.runInNewContext(source, { app, setTimeout });
}

const prefix = "ArtemKo7vUsefulStuffNodes";
const kinds = ["AnyInputSelector", "ImageTextPairSelector", "AnyMatchRouter", "StringMatchSwitch"];

// Model the LiteGraph creation/configuration paths without the app's nodeCreated
// extension callback: previews must already be normalized at that point.
function create(kind) {
    class Node {
        constructor() {
            this.inputs = [];
            this.outputs = [];
            this.widgets = [];
            this.size = [300, 2000];
            this.graph = { links: {} };
            this.disconnected = [];
            this.created = 0;
            this.configured = 0;
            this.connectionsChanged = 0;
            const widget = (name, value = "") => this.addWidget("text", name, value, () => {});
            if (kind === "AnyInputSelector") {
                widget("selected_index", 1);
                widget("mode", "fixed");
                for (let i = 1; i <= 64; i++) this.addInput(`any_${i}`, "*");
                this.addOutput("selected", "*");
            } else if (kind === "ImageTextPairSelector") {
                widget("selected_index", -1);
                for (let i = 1; i <= 64; i++) {
                    this.addInput(`image_${i}`, "IMAGE");
                    widget(`text_${i}`);
                }
                this.addOutput("image", "IMAGE");
                this.addOutput("text", "STRING");
            } else if (kind === "AnyMatchRouter") {
                this.addInput("any", "*");
                widget("match");
                for (let i = 1; i <= 64; i++) {
                    widget(`text_${i}`);
                    this.addOutput(`any_out_${i}`, "*");
                }
            } else {
                widget("match");
                this.addInput("default", "*");
                for (let i = 2; i <= 64; i++) {
                    this.addInput(`value_${i}`, "*");
                    widget(`control_${i}`);
                }
                this.addOutput("selected", "*");
            }
            this.creationResult = this.onNodeCreated();
        }
        onNodeCreated() { this.created++; return "original result"; }
        onConfigure() { this.configured++; }
        onConnectionsChange() { this.connectionsChanged++; }
        addInput(name, type) { this.inputs.push({ name, type, link: null }); }
        removeInput(index) { this.inputs.splice(index, 1); }
        addOutput(name, type) { this.outputs.push({ name, type, links: null }); }
        removeOutput(index) {
            const output = this.outputs[index];
            this.disconnected.push(...(output.links ?? []));
            this.outputs.splice(index, 1);
        }
        addWidget(type, name, value, callback) {
            const widget = { type, name, value, callback };
            this.widgets.push(widget);
            return widget;
        }
        computeSize() { return [210, 40 + 20 * Math.max(this.inputs.length, this.outputs.length) + 24 * this.widgets.length]; }
        setSize(size) { this.size = [...size]; }
        configure(data) {
            if (data.inputs) {
                this.inputs = structuredClone(data.inputs);
                for (const input of this.inputs) {
                    if (input.link != null) this.graph.links[input.link] = { type: input.type };
                }
            }
            if (data.outputs) this.outputs = structuredClone(data.outputs);
            this.size = [...(data.size ?? [440, 2000])];
            for (const [index, widget] of this.widgets.entries()) {
                if (data.widgets_values?.[index] !== undefined) widget.value = data.widgets_values[index];
            }
            this.onConfigure(data);
        }
    }
    Node.type = prefix + kind;
    for (const extension of extensions) extension.beforeRegisterNodeDef(Node, { name: Node.type });
    return new Node();
}
const names = items => items.map(item => item.name);
function assertHeight(node) {
    assert.equal(node.size[1], node.computeSize()[1]);
}
function connect(node, name, id = 100, type = "IMAGE") {
    node.inputs.find(input => input.name === name).link = id;
    node.graph.links[id] = { type };
    node.onConnectionsChange();
}
function edit(node, name, value) {
    const widget = node.widgets.find(widget => widget.name === name);
    widget.value = value;
    widget.callback(value);
}

for (const kind of kinds) {
    test(`${kind}: preview starts compact and retains the original creation hook`, () => {
        const node = create(kind);
        assert.equal(node.created, 1);
        assert.equal(node.creationResult, "original result");
        const expected = {
            AnyInputSelector: [1, 1, 2],
            ImageTextPairSelector: [2, 2, 1],
            AnyMatchRouter: [1, 0, 2],
            StringMatchSwitch: [2, 1, 2],
        }[kind];
        assert.deepEqual([node.inputs.length, node.outputs.length, node.widgets.length], expected);
        assertHeight(node);
        assert.ok(node.size[1] < 200);
    });
    test(`${kind}: loading repairs excessive height and preserves width`, () => {
        const node = create(kind);
        node.configure({ size: [550, 2000], widgets_values: node.widgets.map(widget => widget.value) });
        assert.equal(node.configured, 1);
        assert.equal(node.size[0], 550);
        assertHeight(node);
    });
}

test("Any Input Selector grows, shrinks, and propagates linked types", () => {
    const node = create("AnyInputSelector");
    connect(node, "any_1");
    assert.deepEqual(names(node.inputs), ["any_1", "any_2"]);
    connect(node, "any_2", 101);
    assert.deepEqual(names(node.inputs), ["any_1", "any_2", "any_3"]);
    assert.ok(node.inputs.every(input => input.type === "IMAGE"));
    assert.equal(node.outputs[0].type, "IMAGE");
    node.inputs[1].link = null;
    node.onConnectionsChange();
    assert.deepEqual(names(node.inputs), ["any_1", "any_2"]);
    assert.equal(node.connectionsChanged, 3);
    assertHeight(node);
});

test("Image Text Pair Selector grows and shrinks in pairs", () => {
    const node = create("ImageTextPairSelector");
    connect(node, "text_1", 100, "STRING");
    assert.deepEqual(names(node.inputs), ["image_1", "text_1", "image_2", "text_2"]);
    node.inputs[1].link = null;
    node.onConnectionsChange();
    assert.deepEqual(names(node.inputs), ["image_1", "text_1"]);
    assertHeight(node);
});

test("String Match Switch grows and retains filled control fields", () => {
    const node = create("StringMatchSwitch");
    connect(node, "value_2");
    assert.deepEqual(names(node.inputs), ["default", "value_2", "value_3"]);
    edit(node, "control_3", "keep");
    node.inputs[1].link = null;
    node.onConnectionsChange();
    assert.ok(node.widgets.some(widget => widget.name === "control_3" && widget.value === "keep"));
    edit(node, "control_3", "");
    assert.deepEqual(names(node.inputs), ["default", "value_2"]);
    assertHeight(node);
});

test("Any Match Router adds outputs without a later timer resetting edits", async () => {
    const node = create("AnyMatchRouter");
    edit(node, "text_1", "first");
    edit(node, "text_2", "second");
    node.outputs[1].links = [500];
    edit(node, "text_1", "");
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.deepEqual(names(node.outputs), ["any_out_2"]);
    assert.deepEqual(node.outputs[0].links, [500]);
    assertHeight(node);
});

test("Any Match Router restores output links and text controls", () => {
    const node = create("AnyMatchRouter");
    node.configure({
        outputs: [{ name: "any_out_1", type: "IMAGE", links: [700] }, { name: "any_out_3", type: "IMAGE", links: [701] }],
        widgets_values: ["match", "first", "", "third", ""],
    });
    assert.deepEqual(names(node.outputs), ["any_out_1", "any_out_3"]);
    assert.deepEqual(node.outputs.map(output => output.links), [[700], [701]]);
    assert.deepEqual(node.disconnected, []);
    assert.deepEqual(node.widgets.map(widget => widget.value), ["match", "first", "", "third", ""]);
    assertHeight(node);
});

test("String Match Switch restores links and all saved controls", () => {
    const node = create("StringMatchSwitch");
    node.configure({
        inputs: [{ name: "default", type: "IMAGE", link: 200 }, { name: "value_2", type: "IMAGE", link: 201 }, { name: "value_3", type: "IMAGE", link: 202 }],
        widgets_values: ["match", "first", "second"],
    });
    assert.deepEqual(node.inputs.slice(0, 3).map(input => input.link), [200, 201, 202]);
    assert.deepEqual(names(node.inputs), ["default", "value_2", "value_3", "value_4"]);
    assert.deepEqual(node.widgets.map(widget => widget.value), ["match", "first", "second", ""]);
    assertHeight(node);
});

for (const kind of ["AnyInputSelector", "ImageTextPairSelector"]) {
    test(`${kind}: restores the maximum socket count without losing links`, () => {
        const node = create(kind);
        const inputs = [];
        for (let i = 1; i <= 64; i++) {
            if (kind === "AnyInputSelector") inputs.push({ name: `any_${i}`, type: "IMAGE", link: i });
            else inputs.push({ name: `image_${i}`, type: "IMAGE", link: i }, { name: `text_${i}`, type: "STRING", link: i + 64 });
        }
        node.configure({ inputs, widgets_values: kind === "AnyInputSelector" ? [5, "decrement"] : [5] });
        assert.deepEqual(node.inputs, inputs);
        assert.equal(node.widgets[0].value, 5);
        if (kind === "AnyInputSelector") assert.equal(node.widgets[1].value, "decrement");
        assertHeight(node);
    });
}

test("Extensions leave unrelated node classes untouched", () => {
    class Unrelated { onNodeCreated() {} }
    const hook = Unrelated.prototype.onNodeCreated;
    for (const extension of extensions) extension.beforeRegisterNodeDef(Unrelated, { name: "OtherNode" });
    assert.equal(Unrelated.prototype.onNodeCreated, hook);
});
