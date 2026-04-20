We looked at function signatures before like:

```ocaml
float -> float -> float
```
and how functions could be passed to other functions. Let's look under the hood to see how OCaml puts together functions.

In OCaml, when you write something like:

```ocaml
let sum x y = x + y
```
Here, technically, `sum` is not a function that takes two arguments. It builds up like this: When you call `sum 1 2`, what actually happens is, `sum 1` returns a new function that adds 1 to its argument.

Now, that new function is immediately called with `2` as its argument which gives the result `3`.

This is called currying (named after Haskell Curry) and what this means is technically, every function in Ocaml takes exactly one argument. So multi-argument functions are essentially just syntactic sugar.

But why do this? What benefits does this give us?

## Partial Application

Since multi-argument functions are built up via currying, if we provide fewer argumnets than a function expects, we get a perfectly usable function back.

Again, we can compare this with C-styled languages. If we had a multi-argument function, we would need all argumnets to call it.

Well, this idea, called partial application can be useful in creating specialised functions without wrappers as we saw earlier.

If we already had `add` and `multiply` functions, we could we could create specialised functions by partail application like this:

```ocaml
let add x y = x + y
let multiply x y = x * y

(* now we can create specialized functions *)
let add_five = add 5
let multiply_by_two = multiply 2
```
Notice how although `add` requires two arguments, we can define `add_five` as a derived function of add but it just adds 5 to its input.

While this example is a bit silly, the point was to intoduce the way in which currying and partial application work.

# Problem Statement

Given two functions, `add` and `multiply`, create a function `add_thirteen` and a function `multiply_by_17`
