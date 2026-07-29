let string_of_float_pair (x, y) =
  Printf.sprintf "(%f, %f)" x y

let () =
  Tests.string_check string_of_float_pair
  "cadd ((1.0, -2.0), (3.0, -1.0)) = (4.0, -3.0)"
  (4.0, -3.0) (cadd ((1.0, -2.0), (3.0, -1.0)))
