import secrets
import time


INT64_MAX = (1 << 63) - 1
RANDOM_LONG_MIN = 1_000_000_000_000_000_000


def _parse_saved_int(value) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return 0


def _parse_saved_bool(value) -> bool:
    return str(value).strip().lower() == "true"


class ArtemKo7vUsefulStuffNodesEmptyString:
    CATEGORY = "ArtemKo7v"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("string",)
    FUNCTION = "get_empty_string"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    def get_empty_string(self):
        return ("",)


class _ArtemKo7vStatefulIntBase:
    CATEGORY = "ArtemKo7v"
    RETURN_TYPES = ("INT", "INT")
    RETURN_NAMES = ("current", "saved")
    FUNCTION = "generate"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "last_value": ("INT", {"default": 0})
            }
        }

    @classmethod
    def IS_CHANGED(cls, last_value):
        return float("nan")

    @staticmethod
    def _new_value() -> int:
        raise NotImplementedError

    def generate(self, last_value):
        saved_value = _parse_saved_int(last_value)
        current_value = self._new_value()
        return {
            "ui": {"stored_value": [current_value]},
            "result": (current_value, saved_value),
        }


class ArtemKo7vUsefulStuffNodesUnixTimestamp(_ArtemKo7vStatefulIntBase):
    @staticmethod
    def _new_value() -> int:
        return int(time.time())


class ArtemKo7vUsefulStuffNodesRandomLongInt(_ArtemKo7vStatefulIntBase):
    @staticmethod
    def _new_value() -> int:
        return RANDOM_LONG_MIN + secrets.randbelow(INT64_MAX - RANDOM_LONG_MIN + 1)


class ArtemKo7vUsefulStuffNodesRandomBoolean:
    CATEGORY = "ArtemKo7v"
    RETURN_TYPES = ("BOOLEAN", "BOOLEAN")
    RETURN_NAMES = ("current", "saved")
    FUNCTION = "generate"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "last_value": ("BOOLEAN", {"default": False})
            }
        }

    @classmethod
    def IS_CHANGED(cls, last_value):
        return float("nan")

    def generate(self, last_value):
        saved_value = _parse_saved_bool(last_value)
        current_value = bool(secrets.randbelow(2))
        return {
            "ui": {"stored_value": [current_value]},
            "result": (current_value, saved_value),
        }


class ArtemKo7vUsefulStuffNodesStringMatchSwitch:
    CATEGORY = "ArtemKo7v"
    MAX_OPTION_INDEX = 64
    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("selected",)
    FUNCTION = "select"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "match": (
                    "STRING",
                    {
                        "default": "",
                        "multiline": False,
                    },
                ),
                "default": ("*",),
            },
        }

    @classmethod
    def VALIDATE_INPUTS(cls, input_types):
        return True

    def select(self, match, default, **kwargs):
        option_indexes = sorted(
            int(name.removeprefix("value_"))
            for name in kwargs
            if name.startswith("value_") and name.removeprefix("value_").isdigit()
        )
        for index in option_indexes:
            if str(kwargs.get(f"control_{index}", "")) == match:
                return (kwargs[f"value_{index}"],)
        return (default,)


class ArtemKo7vUsefulStuffNodesAnyInputSelector:
    CATEGORY = "ArtemKo7v"
    MAX_INPUT_INDEX = 64
    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("selected",)
    FUNCTION = "select"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"any_1": ("*",)},
            "optional": {"selected_index": ("INT", {"default": -1})},
        }

    @classmethod
    def VALIDATE_INPUTS(cls, input_types):
        return True

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")

    def select(self, any_1, selected_index=None, **kwargs):
        values = [any_1]
        values.extend(kwargs[f"any_{index}"] for index in range(2, self.MAX_INPUT_INDEX + 1) if f"any_{index}" in kwargs)
        selected = _parse_saved_int(selected_index)
        if not 1 <= selected <= len(values):
            selected = secrets.randbelow(len(values)) + 1
        return (values[selected - 1],)


class ArtemKo7vUsefulStuffNodesImageTextPairSelector:
    CATEGORY = "ArtemKo7v"
    MAX_PAIR_INDEX = 64
    RETURN_TYPES = ("IMAGE", "STRING")
    RETURN_NAMES = ("image", "text")
    FUNCTION = "select"

    @classmethod
    def INPUT_TYPES(cls):
        return {"optional": {"selected_index": ("INT", {"default": -1})}}

    @classmethod
    def VALIDATE_INPUTS(cls, input_types):
        return True

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")

    def select(self, selected_index=None, **kwargs):
        pair_indexes = sorted(int(name.removeprefix("image_")) for name in kwargs if name.startswith("image_") and name.removeprefix("image_").isdigit() and f"text_{name.removeprefix('image_')}" in kwargs)
        if not pair_indexes:
            raise ValueError("Connect an image/text pair before executing Image Text Pair Selector.")
        selected = _parse_saved_int(selected_index)
        if not 1 <= selected <= len(pair_indexes):
            selected = secrets.randbelow(len(pair_indexes)) + 1
        index = pair_indexes[selected - 1]
        return (kwargs[f"image_{index}"], kwargs[f"text_{index}"])


NODE_CLASS_MAPPINGS = {
    "ArtemKo7vUsefulStuffNodesEmptyString": ArtemKo7vUsefulStuffNodesEmptyString,
    "ArtemKo7vUsefulStuffNodesUnixTimestamp": ArtemKo7vUsefulStuffNodesUnixTimestamp,
    "ArtemKo7vUsefulStuffNodesRandomLongInt": ArtemKo7vUsefulStuffNodesRandomLongInt,
    "ArtemKo7vUsefulStuffNodesRandomBoolean": ArtemKo7vUsefulStuffNodesRandomBoolean,
    "ArtemKo7vUsefulStuffNodesStringMatchSwitch": ArtemKo7vUsefulStuffNodesStringMatchSwitch,
    "ArtemKo7vUsefulStuffNodesAnyInputSelector": ArtemKo7vUsefulStuffNodesAnyInputSelector,
    "ArtemKo7vUsefulStuffNodesImageTextPairSelector": ArtemKo7vUsefulStuffNodesImageTextPairSelector,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ArtemKo7vUsefulStuffNodesEmptyString": "Empty String",
    "ArtemKo7vUsefulStuffNodesUnixTimestamp": "Unix Timestamp",
    "ArtemKo7vUsefulStuffNodesRandomLongInt": "Random Long INT",
    "ArtemKo7vUsefulStuffNodesRandomBoolean": "Boolean Random",
    "ArtemKo7vUsefulStuffNodesStringMatchSwitch": "String Match Switch",
    "ArtemKo7vUsefulStuffNodesAnyInputSelector": "Any Input Selector",
    "ArtemKo7vUsefulStuffNodesImageTextPairSelector": "Image Text Pair Selector",
}
