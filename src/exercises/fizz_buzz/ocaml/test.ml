let () =
  let test_cases = [
    (1, "1");
    (2, "2");
    (3, "Fizz");
    (4, "4");
    (5, "Buzz");
    (6, "Fizz");
    (10, "Buzz");
    (15, "FizzBuzz");
    (30, "FizzBuzz");
  ] in
  List.iter (fun (input_val, expected) ->
    let res = fizzbuzz input_val in
    let msg = "fizzbuzz " ^ string_of_int input_val in
    Tests.string_check (fun s -> "\"" ^ s ^ "\"") msg expected res
  ) test_cases

