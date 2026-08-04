# Adding & Structuring Exercises

Each exercise lives in a topic folder under `src/exercises/` (e.g. `hello_world/`). It contains a shared problem description (`problem.md`) and subdirectories for language variants.

---

## Exercise Directory Structure

```text
src/exercises/hello_world/
├── problem.md           # Problem description (Markdown - first line "# Hello World" is the title)
├── ocaml/
│   ├── template.ml      # Starter code for OCaml
│   ├── test.ml          # Test suite for OCaml
│   └── validator.ts     # (Optional) Custom validator for OCaml
└── c/
    ├── template.c       # Starter code for C
    └── test.c           # Test suite for C
```

---

### Adding a New Language Variant to an Exercise
To add C or Python support to an existing exercise:
1. Create a subfolder inside the exercise directory (e.g., `hello_world/c/`).
2. Add `template.c` (initial user code) and `test.c` (test harness).

---

## Registering & Ordering in Curriculum (`curriculum.yaml`)

Curriculum ordering, chapters, active exercises, and drafts are defined in `src/exercises/curriculum.yaml`.

```yaml
chapters:
  "Basics":
      - hello_world
      - ints_vs_floats
      - functions
      - conditionals
      - tuples
      # - lists
      # - arrays
      # - strings

  "Key Concepts":
      - currying
      # - pure_functions
      # - immutability
      # - side_effects

  # "Intermediate Concepts"
  #     - memoization
  #     - tail_recursion
```

- **Draft Exercises & Chapters**: Disable upcoming exercises or chapters by commenting them out with `#`. Un-comment when ready to release.

---

## NOTE

> **Language availability is exercise-driven in the UI**:
> Enabling a language in `site.toml` registers the compiler/runner site-wide. However, the UI Language Selector dropdown evaluates availability per exercise.
>
> If a language is enabled in `site.toml` (e.g. `c` or `python`), but an exercise directory does not contain a subfolder for that language (e.g. `hello_world/c/`), **the UI dropdown will NOT show or enable that language for that exercise**.

TODO: Add reference here to README in languages directory and vice versa. Point to both as a comment in site config for reference when adding a new language