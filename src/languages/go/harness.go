package main

import (
	"fmt"
	"os"
	"reflect"
)

type TestHarness struct{}

var Tests TestHarness

func (t TestHarness) BoolCheck(msg string, b bool) {
	if b {
		fmt.Printf("Test passed: %s\n", msg)
	} else {
		fmt.Printf("Test failed: %s\n", msg)
		os.Exit(1)
	}
}

func (t TestHarness) EqualCheck(msg string, expected, actual interface{}) {
	if reflect.DeepEqual(expected, actual) {
		fmt.Printf("Test passed: %s\n", msg)
	} else {
		fmt.Printf("Test failed: %s\nExpected: %#v\nActual:   %#v\n", msg, expected, actual)
		os.Exit(1)
	}
}
