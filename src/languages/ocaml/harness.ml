module Tests = struct
  let bool_check msg b =
    if b then
      Printf.printf "Test passed: %s\n" msg
    else begin
      Printf.printf "Test failed: %s\n" msg;
      failwith "Test failed"
    end

  let string_check to_str msg expected actual =
    if expected = actual then
      Printf.printf "Test passed: %s\n" msg
    else begin
      Printf.printf "Test failed: %s\nExpected: %s\nActual:   %s\n" msg (to_str expected) (to_str actual);
      failwith "Test failed"
    end

 let equal_check msg expected actual =
    if expected = actual then
      Printf.printf "Test passed: %s\n" msg
    else begin
      Printf.printf "Test failed: %s\n" msg;
      failwith "Test failed"
    end
end
