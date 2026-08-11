#include <stdio.h>
#include <string.h>

int main() {
    struct { int input; const char* expected; } test_cases[] = {
        {1, "1"},
        {2, "2"},
        {3, "Fizz"},
        {4, "4"},
        {5, "Buzz"},
        {6, "Fizz"},
        {10, "Buzz"},
        {15, "FizzBuzz"},
        {30, "FizzBuzz"}
    };
    int num_tests = sizeof(test_cases) / sizeof(test_cases[0]);

    for (int i = 0; i < num_tests; i++) {
        const char* res = fizzbuzz(test_cases[i].input);
        if (strcmp(res, test_cases[i].expected) == 0) {
            printf("PASS: fizzbuzz(%d) == %s\n", test_cases[i].input, test_cases[i].expected);
        } else {
            printf("FAIL: fizzbuzz(%d) = %s, expected %s\n", test_cases[i].input, res, test_cases[i].expected);
        }
    }
    return 0;
}
