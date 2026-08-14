# Building the Go WASM Interpreter

## Prerequisites
- Go 1.22+

## Build Instructions

1. Download dependencies:
```bash
go mod tidy
```

2. Compile to WebAssembly:
```bash
GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o yaegi.wasm main.go
```

3. Update `wasm_exec.js` (if upgrading Go version):
```bash
cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" ./wasm_exec.js
```
