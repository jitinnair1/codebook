# Adding & Structuring Exercises

Each exercise lives in a topic folder under `src/exercises/` (e.g. `hello_world/`). It contains a shared problem description (`problem.md`) and subdirectories for language variants. **No TypeScript code (`index.ts`) is required inside exercise folders.**

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
3. **Done!** Sowar automatically discovers the variant—no code changes required!

---

## Registering & Ordering in Curriculum (`curriculum.toml`)

Curriculum ordering, chapters, active exercises, and drafts are defined in `src/exercises/curriculum.toml`.

```toml
[[chapter]]
title = "Basics"
exercises = [
  "hello_world",
  "ints_vs_floats",
  "functions",
  "conditionals",
  "tuples"
]
drafts = [
  "lists",
  "arrays",
  "strings"
]

[[chapter]]
title = "Key Concepts"
exercises = [
  "currying"
]
drafts = [
  "pure_functions",
  "immutability",
  "recursion"
]

# Entire draft chapters placed in [[draft]] are ignored automatically!
[[draft]]
title = "Intermediate Concepts"
exercises = [
  "memoization",
  "tail_recursion"
]
```

- **Dynamic Auto-Numbering**: Exercise IDs (`1.1`, `1.2`, `2.1`) are assigned dynamically based on position in `curriculum.toml`. Reordering exercises or moving them between chapters takes 5 seconds without renaming folders on disk!
- **Title Extraction**: Exercise titles are extracted automatically from the `# Title` heading inside `problem.md`.
- **Draft Exercises**: Move unreleased exercises into `drafts = [...]` array under any chapter.
- **Draft Chapters**: Place upcoming chapters in `[[draft]]` tables, these are ignore by default. Once finalised, just rename these to `[[chapter]]`.

---

## ⚠️ Important Note on Language Dropdown Availability

> **Language availability is exercise-driven in the UI**:
> Enabling a language in `site.toml` registers the compiler/runner site-wide. However, the UI Language Selector dropdown evaluates availability per exercise.
>
> If a language is enabled in `site.toml` (e.g. `c` or `python`), but an exercise directory does not contain a subfolder for that language (e.g. `hello_world/c/`), **the UI dropdown will NOT show or enable that language for that exercise**.
