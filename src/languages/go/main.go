package main

import (
	"bytes"
	"fmt"
	"syscall/js"

	"github.com/traefik/yaegi/interp"
	"github.com/traefik/yaegi/stdlib"
)

func main() {
	c := make(chan struct{}, 0)

	js.Global().Set("yaegiEval", js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) == 0 {
			return map[string]any{
				"success": false,
				"output":  "",
				"error":   "no code provided",
			}
		}

		code := args[0].String()

		var stdoutBuf, stderrBuf bytes.Buffer

		i := interp.New(interp.Options{
			Stdout: &stdoutBuf,
			Stderr: &stderrBuf,
		})
		if err := i.Use(stdlib.Symbols); err != nil {
			return map[string]any{
				"success": false,
				"output":  "",
				"error":   fmt.Sprintf("failed to load stdlib: %v", err),
			}
		}

		_, err := i.Eval(code)
		outStr := stdoutBuf.String()
		errStr := stderrBuf.String()

		if err != nil {
			fullErr := err.Error()
			if errStr != "" {
				fullErr = fullErr + "\n" + errStr
			}
			return map[string]any{
				"success": false,
				"output":  outStr,
				"error":   fullErr,
			}
		}

		return map[string]any{
			"success": true,
			"output":  outStr,
			"error":   errStr,
		}
	}))

	js.Global().Set("initYaegi", js.FuncOf(func(this js.Value, args []js.Value) any {
		return true
	}))

	<-c
}
