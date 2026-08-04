We often want to group related things together to make it easy to work with them. There are multiple ways to do this grouping in programming: lists, arrays, tuples, structs, objects, classes etc. There are variations in which programming languages and styles use these. For now, lets start with tuples.

A good use case for tuples is when the different things you group have some shared attributes or relationships. For example a point is a tuple of two numbers (x, y). Same logic works for a complex number (real, imaginary) or even RGB colour which is a tuple of three numbers (r, g, b) each between 0 and 255.

In OCaml, a tuple is written as `(x, y)` for two elements, `(x, y, z)` for three elements and so on. So say you wanted to create a tuple of type point with two elements representing the x and y co-ordinates you could write it as:

```ocaml
let a = (1.0, -2.0)
```
which creates a tuple with two elements representing the x and y co-ordinates of point `a`.

# Problem Statement

The program should add two complex numbers but the two numbers to be added have not been defined. Define them as tuples of two floats.
