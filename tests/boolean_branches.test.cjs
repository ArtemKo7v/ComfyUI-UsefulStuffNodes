const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

let extension;
const source = fs.readFileSync(path.join(__dirname, "../web/js/boolean_branches.js"), "utf8")
    .replace('import { app } from "../../scripts/app.js";', "");
vm.runInNewContext(source, { app: { registerExtension(value) { extension = value; } } });

const cases = [
    { kind: "AnyIfElse", side: "inputs", inputs: ["in_true", "in_false", "condition"], outputs: ["any_out"], aliases: { any_1: "in_true", any_2: "in_false" } },
    { kind: "AnySwitch", side: "outputs", inputs: ["any", "enabled"], outputs: ["out_true", "out_false"], aliases: { any_out_1: "out_true", any_out_2: "out_false" } },
];

for (const frontend of ["legacy", "current"]) {
    for (const fixture of cases) {
        test(`${fixture.kind}: ${frontend} frontend restores legacy links without duplicate slots`, () => {
            class Node {
                constructor() {
                    this.inputs = fixture.inputs.map(name => ({ name, type: "*", link: null }));
                    this.outputs = fixture.outputs.map(name => ({ name, type: "*", links: null }));
                    this.configured = 0;
                }
                configure(data) {
                    if (frontend === "current") {
                        // ComfyUI matches inputs by name, but outputs by position.
                        const byName = new Map(data.inputs.map(input => [input.name, input]));
                        const definedNames = new Set(this.inputs.map(input => input.name));
                        data.inputs = [
                            ...this.inputs.map(input => ({ ...byName.get(input.name), name: input.name, type: input.type })),
                            ...data.inputs.filter(input => !definedNames.has(input.name)),
                        ];
                        data.outputs = this.outputs.map((output, index) => ({ ...data.outputs[index], name: output.name, type: output.type }));
                    }
                    this.inputs = structuredClone(data.inputs);
                    this.outputs = structuredClone(data.outputs);
                    this.onConfigure(data);
                    return "original result";
                }
                onConfigure(data) { this.configured++; this.lastConfiguration = data; }
            }
            const onConfigure = Node.prototype.onConfigure;
            extension.beforeRegisterNodeDef(Node, { name: "ArtemKo7vUsefulStuffNodes" + fixture.kind });
            assert.equal(Node.prototype.onConfigure, onConfigure);
            const node = new Node();
            const saved = {
                inputs: fixture.inputs.map((name, index) => ({ name, type: "*", link: 100 + index })),
                outputs: fixture.outputs.map((name, index) => ({ name, type: "*", links: [200 + index] })),
                widgets_values: [false],
            };
            saved[fixture.side].forEach((slot, index) => {
                slot.name = Object.keys(fixture.aliases).find(name => fixture.aliases[name] === slot.name) ?? slot.name;
                slot.label = index === 0 ? slot.name : "Custom label";
            });
            for (let load = 1; load <= 2; load++) {
                const data = structuredClone(saved);
                assert.equal(node.configure(data), "original result");
                assert.deepEqual(node.inputs.map(slot => slot.name), fixture.inputs);
                assert.deepEqual(node.outputs.map(slot => slot.name), fixture.outputs);
                assert.deepEqual(node.inputs.map(slot => slot.link), saved.inputs.map(slot => slot.link));
                assert.deepEqual(node.outputs.map(slot => slot.links), saved.outputs.map(slot => slot.links));
                assert.equal(node[fixture.side][0].label, fixture[fixture.side][0]);
                assert.equal(node[fixture.side][1].label, "Custom label");
                assert.deepEqual(data.widgets_values, [false]);
                assert.equal(node.configured, load);
                assert.equal(node.lastConfiguration, data);
            }
        });
    }
}

test("Boolean branch migration leaves unrelated nodes untouched", () => {
    class Node { configure() {} onConfigure() {} }
    const configure = Node.prototype.configure;
    const onConfigure = Node.prototype.onConfigure;
    extension.beforeRegisterNodeDef(Node, { name: "OtherNode" });
    assert.equal(Node.prototype.configure, configure);
    assert.equal(Node.prototype.onConfigure, onConfigure);
});
