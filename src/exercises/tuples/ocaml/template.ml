let z1 =            (* 1 + 2i *)
let z2 =            (* 3 - i *)

(* do not edit below this line *)

(* complex type as tuple of two floats *)
type complex = float * float

(* Function to add two complex numbers *)
let cadd ((a, b), (c, d)) : complex = (a +. c, b +. d)

(* call the add function with z1 and z2 *)
let sum = cadd (z1, z2)

