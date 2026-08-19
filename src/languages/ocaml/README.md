# Build the WebAssembly Toplevel

The following are instructions to build the OCaml WebAssembly (`wasm_of_ocaml`) Toplevel. It is assumed you already have `opam` installed.

### 1. Initialize a local switch (creates a `_opam` folder in the root) 

```bash
opam switch create . 5.2.0
```

### 2. Activate the Environment

```bash
eval $(opam env)
```

### 3. Install dependencies

```bash
opam install . --deps-only
```

### 4. Build the Wasm Toplevel

Use the **default (dev) profile** — this is required for the OCaml toplevel REPL. Do NOT use `--profile release` as that disables dynamic compilation.

```bash
dune build ./toplevel.bc.wasm.js
```

### 5. Copy the built Wasm assets

Copy the generated JavaScript loader **and** the WebAssembly assets directory to the OCaml language directory:

```bash
cp _build/default/toplevel.bc.wasm.js ./toplevel.bc.wasm.js
cp -r _build/default/toplevel.bc.wasm.assets ./toplevel.bc.wasm.assets
```
