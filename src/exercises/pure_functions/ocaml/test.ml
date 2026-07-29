let () =
  Tests.string_check string_of_int "add_thirteen 7 = 20" 20 (add_thirteen 7);
  Tests.string_check string_of_int "multiply_by_17 2 = 34" 34 (multiply_by_17 2);;
