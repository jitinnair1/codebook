if 'fizzbuzz' not in globals():
    raise Exception("fizzbuzz function is not defined")

test_cases = [
    (1, "1"),
    (2, "2"),
    (3, "Fizz"),
    (4, "4"),
    (5, "Buzz"),
    (6, "Fizz"),
    (10, "Buzz"),
    (15, "FizzBuzz"),
    (30, "FizzBuzz"),
]

for input_val, expected in test_cases:
    res = fizzbuzz(input_val)
    Tests.equal_check(f"fizzbuzz({input_val})", expected, res)

