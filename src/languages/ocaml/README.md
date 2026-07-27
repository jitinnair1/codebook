# Build the Toplevel

The following are instrcutions to ONLY build the Toplevel. It is assumed you already have `opam` installed:

Initialize a local switch (this creates a `_opam` folder hidden in the root)

```bash
opam switch create . 5.2.0
```
Activate the Environment

```bash
eval $(opam env)
```

Install dependencies:

```bash
opam install . --deps-only
```

Now, build the Toplevel

```bash
dune build
```
and copt the built file to `public`

```bash
cp _build/default/toplevel.bc.js ./toplevel.bc.js
```

NOTE: If you run into eval `Unbound module` errors, it could be you've not run
`eval $(opam env)`
