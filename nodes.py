import secrets
import time


INT64_MAX = (1 << 63) - 1
RANDOM_LONG_MIN = 1_000_000_000_000_000_000


def _parse_saved_int(value) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return 0


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
                "last_value": (
                    "STRING",
                    {
                        "default": "0",
                        "multiline": False,
                    },
                )
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
            "ui": {"stored_value": [str(current_value)]},
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


NODE_CLASS_MAPPINGS = {
    "ArtemKo7vUsefulStuffNodesEmptyString": ArtemKo7vUsefulStuffNodesEmptyString,
    "ArtemKo7vUsefulStuffNodesUnixTimestamp": ArtemKo7vUsefulStuffNodesUnixTimestamp,
    "ArtemKo7vUsefulStuffNodesRandomLongInt": ArtemKo7vUsefulStuffNodesRandomLongInt,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ArtemKo7vUsefulStuffNodesEmptyString": "Empty String",
    "ArtemKo7vUsefulStuffNodesUnixTimestamp": "Unix Timestamp",
    "ArtemKo7vUsefulStuffNodesRandomLongInt": "Random Long INT",
}
