We looked a little bit at functions earlier. If you had been following along closely in the console window, you may have noticed the functions signatures being displayed.

Things like:

```ocaml
val average : float -> float -> float
```

In a C-style languages, the function signatures might look like this:

```c
float average(float a, float b);
```

So we know for sure that the function takes two inputs and returns a single output. But the same function when represented in OCaml has just a bunch of arrows pointing outwards. Why? This brings us to how OCaml, and broadly how functional programming languages view functions.

In OCaml, functions are first class citizens. This means that functions can be treated as values. So you can pass a function into another function or return a function from a function. We will get back to this idea in detail in the coming lessons.

# Problem Statement

You're given a `square` function. Your task is to complete the `sum_of_squares` function that reuses the square function to calculate the sum of the squares of two numbers.

(Don't forget to use the dot operator `.`)
