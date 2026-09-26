import math
import unittest
from unittest.mock import patch

from nodes import ArtemKo7vUsefulStuffNodesAnyInputSelector as Selector


class AnyInputSelectorTests(unittest.TestCase):
    def setUp(self):
        self.node = Selector()
        self.inputs = {"any_1": object(), "any_3": object(), "any_64": object()}
        self.values = list(self.inputs.values())

    def select(self, index=1, mode="fixed"):
        return self.node.select(**self.inputs, selected_index=index, mode=mode)[0]

    def test_new_node_defaults_to_fixed_first_input(self):
        schema = Selector.INPUT_TYPES()["optional"]
        self.assertEqual(schema["mode"][1]["default"], "fixed")
        self.assertEqual(schema["selected_index"][1]["default"], 1)
        self.assertIs(self.node.select(**self.inputs, selected_index=1)[0], self.values[0])

    def test_fixed_uses_connected_input_order_and_preserves_identity(self):
        for index, value in enumerate(self.values, 1):
            for _ in range(3):
                self.assertIs(self.select(index), value)

    def test_legacy_missing_mode_and_invalid_index_keep_random_fallback(self):
        for index in (None, -1, 0, 4):
            with self.subTest(index=index), patch("nodes.secrets.randbelow", return_value=2) as random:
                result = self.node.select(**self.inputs, selected_index=index)
                self.assertIs(result[0], self.values[2])
                random.assert_called_once_with(3)

    def test_random_ignores_index_and_selects_on_every_execution(self):
        with patch("nodes.secrets.randbelow", side_effect=[2, 0, 0, 1]) as random:
            results = [self.select(999, "random") for _ in range(4)]
            self.assertEqual(results, [self.values[i] for i in (2, 0, 0, 1)])
            self.assertEqual(random.call_count, 4)
            random.assert_called_with(3)

    def test_increment_wraps_from_last_to_first(self):
        results = [self.select(2, "increment") for _ in range(7)]
        self.assertEqual(results, [self.values[i] for i in (1, 2, 0, 1, 2, 0, 1)])

    def test_decrement_wraps_from_first_to_last(self):
        results = [self.select(2, "decrement") for _ in range(7)]
        self.assertEqual(results, [self.values[i] for i in (1, 0, 2, 1, 0, 2, 1)])

    def test_invalid_cycle_start_uses_first_input(self):
        for mode in ("increment", "decrement"):
            for index in (None, -1, 0, 4):
                with self.subTest(mode=mode, index=index):
                    node = Selector()
                    self.assertIs(node.select(**self.inputs, selected_index=index, mode=mode)[0], self.values[0])

    def test_single_input_stays_selected_in_all_modes(self):
        value = object()
        for mode in ("fixed", "random", "increment", "decrement"):
            for _ in range(3):
                self.assertIs(self.node.select(value, 1, mode)[0], value)

    def test_changing_start_index_restarts_cycle(self):
        self.select(1, "increment")
        self.select(1, "increment")
        self.assertIs(self.select(3, "increment"), self.values[2])
        self.assertIs(self.select(3, "increment"), self.values[0])

    def test_changing_mode_restarts_cycle(self):
        for mode in ("fixed", "random", "decrement"):
            with self.subTest(mode=mode):
                self.select(2, "increment")
                self.select(2, "increment")
                self.select(2, mode)
                self.assertIs(self.select(2, "increment"), self.values[1])

    def test_changing_connected_slots_restarts_cycle(self):
        self.select(1, "increment")
        self.select(1, "increment")
        self.inputs["any_2"] = self.inputs.pop("any_3")
        self.assertIs(self.select(1, "increment"), self.values[0])
        self.inputs.pop("any_64")
        self.assertIs(self.select(1, "increment"), self.values[0])
        self.assertIs(self.select(1, "increment"), self.values[1])
        self.assertIs(self.select(1, "increment"), self.values[0])

    def test_changing_values_does_not_restart_cycle(self):
        self.select(1, "increment")
        replacement = object()
        self.inputs["any_3"] = replacement
        self.assertIs(self.select(1, "increment"), replacement)

    def test_instances_have_independent_progress(self):
        self.select(1, "increment")
        other = Selector()
        self.assertIs(other.select(**self.inputs, selected_index=1, mode="increment")[0], self.values[0])
        self.assertIs(self.select(1, "increment"), self.values[1])

    def test_execution_cache_is_invalidated(self):
        for mode in ("fixed", "random", "increment", "decrement"):
            self.assertTrue(math.isnan(Selector.IS_CHANGED(mode=mode)))

    def test_unknown_mode_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unknown Any Input Selector mode"):
            self.select(mode="typo")


class AnyInputSelectorRecreatedInstanceTests(unittest.TestCase):
    def setUp(self):
        states = patch.object(Selector, "_cycle_states", {})
        states.start()
        self.addCleanup(states.stop)
        self.node_id = "selector"
        self.inputs = {"any_1": "A", "any_3": "B", "any_64": "C"}

    def execute(self, mode="increment", index=1, node_id=None, workflow_id=None):
        # Each execution gets a fresh Python object but the same graph node ID.
        return Selector().select(
            **self.inputs,
            selected_index=index,
            mode=mode,
            unique_id=node_id or self.node_id,
            extra_pnginfo={"workflow": {"id": workflow_id}} if workflow_id else None,
        )[0]

    def test_cycle_survives_instance_recreation_without_workflow_metadata(self):
        for mode, expected in (
            ("increment", ["B", "C", "A", "B", "C", "A", "B"]),
            ("decrement", ["B", "A", "C", "B", "A", "C", "B"]),
        ):
            with self.subTest(mode=mode):
                self.assertEqual([self.execute(mode, 2) for _ in range(7)], expected)

    def test_hidden_inputs_provide_stable_identity(self):
        hidden = Selector.INPUT_TYPES().get("hidden", {})
        self.assertEqual(hidden.get("unique_id"), "UNIQUE_ID")
        self.assertEqual(hidden.get("extra_pnginfo"), "EXTRA_PNGINFO")

    def test_different_node_ids_have_independent_progress(self):
        self.assertEqual(self.execute(), "A")
        self.assertEqual(self.execute(node_id=self.node_id + "-other"), "A")
        self.assertEqual(self.execute(), "B")

    def test_same_node_id_in_different_workflows_has_independent_progress(self):
        self.assertEqual(self.execute(workflow_id="first"), "A")
        self.assertEqual(self.execute(workflow_id="second"), "A")
        self.assertEqual(self.execute(workflow_id="first"), "B")
        self.assertEqual(self.execute(workflow_id="second"), "B")

    def test_changing_start_or_slots_restarts_shared_cycle(self):
        self.assertEqual(self.execute(), "A")
        self.assertEqual(self.execute(), "B")
        self.assertEqual(self.execute(index=3), "C")
        self.assertEqual(self.execute(index=3), "A")
        self.inputs["any_2"] = self.inputs.pop("any_3")
        self.assertEqual(self.execute(index=3), "C")

    def test_fixed_and_random_reset_shared_cycle(self):
        for mode in ("fixed", "random"):
            with self.subTest(mode=mode):
                self.assertEqual(self.execute(index=2), "B")
                self.assertEqual(self.execute(index=2), "C")
                self.execute(mode)
                self.assertEqual(self.execute(index=2), "B")
                self.execute("fixed")

    def test_changed_values_do_not_reset_or_reuse_old_input_objects(self):
        self.assertEqual(self.execute(), "A")
        replacement = object()
        self.inputs["any_3"] = replacement
        self.assertIs(self.execute(), replacement)


if __name__ == "__main__":
    unittest.main()
