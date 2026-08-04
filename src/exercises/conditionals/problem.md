Conditionals are a standard control structure where we want a `if...then...else` like behaviour.

The Ocaml syntax for this is as follows:

```ocaml
if (condition) then  (expression_if_true) else (expression_if_false)
```

Also, as with most things in OCaml, the `if...then...else` is an expression, not a statement. This means it evaluates to a value.

For example:

```ocaml
let is_even x = if x mod 2 = 0 then true else false
```

The `is_even` function here is evaluating the expression so if its result is assigned to a new variable with `let` it would be  `true` or `false`. So `is_even` will have a function signature of `int -> bool`.

(Note: In OCaml, `mod` is the modulo operator. It is used to find the remainder of a division. You may have encountered it as the `%` operator in some other languages.)

# Problem Statement

Write a function `abs_int` that takes an integer `x` and returns `-x` if `x` is negative and `x` otherwise.
