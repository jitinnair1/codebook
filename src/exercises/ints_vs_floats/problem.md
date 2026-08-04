Like most (good) languages, OCaml is a statically typed language. This means the compiler checks for type errors before your code ever runs. But unlike C or Java, instead of manually declaring the type of each variable, in OCaml, you can let the compiler infer the type of the variable for you.

## Integers vs. Floats

Ocaml does this by a smart use of operators. For example, if you were adding two integers, you would use the standard operator:

```ocaml
1 + 2
```
But, if you were adding an two floating point numbers, you would use the floating point operator:

```ocaml
1. +. 2.
```
Notice the `.` after the `+` operator. It tells the compiler that the operation is a floating point operation. f you try to use + with floats, or +. with ints, the compiler will complain.

Now, to assign the result of such operation to a variable, we would use the let keyword. For example:

```ocaml
let x = 1 + 2
```
So think of the right hand side to be be an expression or a function that is evalauted and the result is then assigned to the variable on the left hand side (x in this case).

## Functions

The `let` keyword can also be used to define functions. Typically in C-style languages you would define a function like this:

```c
float sum(float a, float b) {
    return a + b;
}
```
But in OCaml, you could define a function like this:

```ocaml
let sum a b = a +. b
```
Here `let` is the keyword that defines a function. Then, `sum` is the name of the function. Right after that, we have the arguments of the function i.e. `a` and `b` here.

So one way to read the function would be, the function `sum` takes two arguments `a` and `b` and the expression used to calculate the result is the one to the right of the `=` sign.

Once we define the function, we can use it like this:

```ocaml
let x = sum 1. 2.
```
So here, what we're doing is evaluate the function sum, which takes two arguments `1.` and `2.` and assigns the result to the variable `x`.

<details>

<summary>Everything is an Expression!</summary>

You remember how we used `let () =` in the previous exercise to print a message? Well, `()` is the unit type in OCaml, and it's often used in situations where a function returns no meaningful value. Like a "void" type in other programming languages. The takeway here is that the pattern of "everything as an expression" is something you'll see a lot in OCaml.
</details><br>

# Problem Statement

Implement a function average that takes two floating-point numbers and returns their average as a float.
