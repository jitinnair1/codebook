package main

import "fmt"

func main() {
	testCases := []struct {
		input    int
		expected string
	}{
		{1, "1"},
		{2, "2"},
		{3, "Fizz"},
		{4, "4"},
		{5, "Buzz"},
		{6, "Fizz"},
		{10, "Buzz"},
		{15, "FizzBuzz"},
		{30, "FizzBuzz"},
	}

	for _, tc := range testCases {
		res := FizzBuzz(tc.input)
		Tests.EqualCheck(fmt.Sprintf("fizzbuzz(%d)", tc.input), tc.expected, res)
	}
}
