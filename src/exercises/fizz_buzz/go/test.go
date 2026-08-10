package main

import "fmt"

func main() {
	testCases := []struct {
		input    int
		expected string
	}{
		{1, "1"},
		{3, "Fizz"},
		{5, "Buzz"},
		{30, "FizzBuzz"},
	}

	for _, tc := range testCases {
		res := FizzBuzz(tc.input)
		Tests.EqualCheck(fmt.Sprintf("fizzbuzz(%d)", tc.input), tc.expected, res)
	}
}
