let () =
  Tests.string_check string_of_int "abs_int (-25) = 25" 25 (abs_int (-25))