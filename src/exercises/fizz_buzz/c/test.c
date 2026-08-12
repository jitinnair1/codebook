#include <stdio.h>
#include <string.h>

int main() {
  int inputs[] = {1, 2, 3, 4, 5, 6, 10, 15, 30};
  const char *expected[] = {"1",    "2",    "Fizz",     "4",       "Buzz",
                            "Fizz", "Buzz", "FizzBuzz", "FizzBuzz"};
  int num_tests = 9;
  int i;

  for (i = 0; i < num_tests; i++) {
    const char *res = fizzbuzz(inputs[i]);
    if (strcmp(res, expected[i]) == 0) {
      printf("Test passed: fizzbuzz(%d) == %s\n", inputs[i], expected[i]);
    } else {
      printf("Test failed: fizzbuzz(%d) = %s, expected %s\n", inputs[i], res,
             expected[i]);
    }
  }
  return 0;
}
