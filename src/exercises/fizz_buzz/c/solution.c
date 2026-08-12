#include <stdio.h>

const char *fizzbuzz(int n) {
  if (n % 15 == 0)
    return "FizzBuzz";
  if (n % 3 == 0)
    return "Fizz";
  if (n % 5 == 0)
    return "Buzz";
  char str[16];
  sprintf(str, "%d", n);
  return str;
}
