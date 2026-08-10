class Tests:
    @staticmethod
    def bool_check(msg: str, b: bool):
        if b:
            print(f"Test passed: {msg}")
        else:
            print(f"Test failed: {msg}")
            raise Exception(f"Test failed: {msg}")

    @staticmethod
    def equal_check(msg: str, expected, actual):
        if expected == actual:
            print(f"Test passed: {msg}")
        else:
            print(f"Test failed: {msg}\nExpected: {repr(expected)}\nActual:   {repr(actual)}")
            raise Exception(f"Test failed: {msg}")
