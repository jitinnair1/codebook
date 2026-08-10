# **OCaml Exercises: From Hello World to FFTW-style Bindings**

Assumptions:

* **Phase 1 (Exercises 1-25):** Learners can solve these in a browser REPL or utop.
* **Phase 2 (Local Dev & Capstone):** Requires a local environment (Dune/Opam) to handle external libraries (Bigarray) and C linking.

---

## **1. Hello World**

Objective: Get familiar with print_endline and unit.
Assignment: Write a program/expression that prints Hello world.
Tests:

* Manual: Output should contain Hello world.
* Example:
  ```ocaml
  print_endline "Hello world"
  ```

Expected: prints Hello world and returns unit (()).

## **2. Numbers and operators (int vs float)**

Objective: Learn that ints and floats use different operators (+ vs +. etc.).
Assignment: Implement average : float -> float -> float.
Tests:

* Example:
  ```ocaml
  let average a b = (a +. b) /. 2.0
  ;;
  assert (average 2.0 4.0 = 3.0)
  ```

* Negative test: try writing it with + and see the type error.

## **3. Functions are values (Currying)**

*New for C-style learners*
Objective: Understand partial application. In C, f(a,b) is a single call. In OCaml, f a b is (f a) b.
Assignment:

* Define add : int -> int -> int.
* Define add_five : int -> int by partially applying add.

Tests:

* Example:
  ```ocaml
  let add x y = x + y
  let add_five = add 5
  ;;
  assert (add_five 10 = 15);
  assert (add_five 0 = 5);
  ```

## **4. Let...in and Local Scope**

*New for C-style learners*
Objective: Understand that let...in creates local bindings (like C braces but as an expression).
Assignment:

* Write hypotenuse : float -> float -> float that uses let...in to bind intermediate squared values.

Tests:

* Example:
  ```ocaml
  let hypotenuse a b =
    let a_sq = a *. a in
    let b_sq = b *. b in
    sqrt (a_sq +. b_sq)
  ;;
  assert (hypotenuse 3.0 4.0 = 5.0);
  ```

## **5. Conditionals are expressions**

Objective: Understand if ... then ... else ... always returns a value.
Assignment: Write abs_int : int -> int.
Tests:

* Example:
  ```ocaml
  let abs_int x = if x < 0 then -x else x
  ;;
  assert (abs_int (-3) = 3);
  assert (abs_int 3 = 3);
  ```

## **6. Tuples: Anonymous Compound Data**

*New for C-style learners*
Objective: Learn that (a, b) is a product type without needing a struct definition.
Assignment:

* Write swap : 'a * 'b -> 'b * 'a that swaps tuple elements.
* Write fst3 : 'a * 'b * 'c -> 'a to extract the first element of a triple.

Tests:

* Example:
  ```ocaml
  let swap (a, b) = (b, a)
  let fst3 (a, _, _) = a
  ;;
  assert (swap (1, "hello") = ("hello", 1));
  assert (fst3 (10, 20, 30) = 10);
  ```

## **7. Recursion warm-up: GCD (Euclid)**

Objective: Use let rec and pattern/guards via if.
Assignment: Implement gcd : int -> int -> int using Euclid's algorithm.
Tests:

* Example:
  ```ocaml
  let rec gcd a b =
    if b = 0 then a else gcd b (a mod b)
  ;;
  assert (gcd 54 24 = 6);
  ```

## **8. Tail Recursion: The Stack Safety Net**

*New for C-style learners*
Objective: Learn that recursion doesn't have to blow the stack if you use an accumulator.
Assignment:

* Implement factorial_unsafe : int -> int (standard recursion).
* Implement factorial_tail : int -> int (using an internal helper with an accumulator).

Tests:

* Both should return correct values.
* (Conceptual) Notice that factorial_tail passes the result *forward*, acting like a C while loop.
  ```ocaml
  let factorial_tail n =
    let rec loop acc i =
      if i <= 0 then acc
      else loop (acc * i) (i - 1)
    in
    loop 1 n
  ;;
  assert (factorial_tail 5 = 120);
  ```

## **9. Pattern Matching Fundamentals**

*New for C-style learners*
Objective: Understand pattern matching as a switch on steroids that can destructure data.
Assignment:

* Write classify : int -> string that returns "negative", "zero", or "positive".
* Write tuple_sum : int * int -> int using pattern matching on the tuple.

Tests:

* Example:
  ```ocaml
  let classify n =
    match n with
    | 0 -> "zero"
    | x when x < 0 -> "negative"
    | _ -> "positive"

  let tuple_sum t =
    match t with
    | (a, b) -> a + b
  ;;
  assert (classify (-5) = "negative");
  assert (tuple_sum (3, 7) = 10);
  ```

## **10. Lists I: Construction and Pattern Matching**

Objective: Learn list pattern matching ([] and x :: xs).
Assignment:

* Write list_length : 'a list -> int using pattern matching.
* Write list_sum : int list -> int recursively.

Tests:

* Example:
  ```ocaml
  let rec list_length xs =
    match xs with
    | [] -> 0
    | _ :: rest -> 1 + list_length rest

  let rec list_sum xs =
    match xs with
    | [] -> 0
    | x :: rest -> x + list_sum rest
  ;;
  assert (list_length [1;2;3] = 3);
  assert (list_sum [1;2;3;4] = 10);
  ```

## **11. Lists II: map/filter by hand**

Objective: Implement classic list transformations manually.
Assignment: Given a list of ints, return only even numbers multiplied by 10.
Tests:

* Example:
  ```ocaml
  let rec evens_times_10 xs =
    match xs with
    | [] -> []
    | x :: rest ->
      if x mod 2 = 0 then (x * 10) :: evens_times_10 rest
      else evens_times_10 rest
  ;;
  assert (evens_times_10 [1;2;3;4] = [20;40]);
  ```

## **12. Variants: More than just Enums**

*New for C-style learners*
Objective: Understand Tagged Unions (Algebraic Data Types).
Assignment:

* Define a type shape with constructors Circle of float (radius) and Rectangle of float * float (width, height).
* Write area : shape -> float.

Tests:

* Example:
  ```ocaml
  type shape =
    | Circle of float
    | Rectangle of float * float

  let area s =
    match s with
    | Circle r -> 3.14159 *. r *. r
    | Rectangle (w, h) -> w *. h
  ;;
  assert (area (Rectangle (2.0, 3.0)) = 6.0);
  ```

## **13. Options: safe division**

Objective: Use option to avoid exceptions in normal control flow.
Assignment: Implement safe_div : int -> int -> int option.
Tests:

* Example:
  ```ocaml
  let safe_div a b = if b = 0 then None else Some (a / b)
  ;;
  assert (safe_div 10 2 = Some 5);
  assert (safe_div 10 0 = None);
  ```

## **14. Working with Options**

Objective: Learn to chain and transform option values.
Assignment:

* Write map_option : ('a -> 'b) -> 'a option -> 'b option.
* Write safe_sqrt_then_div : float -> float -> float option that takes sqrt of first arg (only if >= 0) then divides by second (only if != 0).

Tests:

* Example:
  ```ocaml
  let map_option f opt =
    match opt with
    | None -> None
    | Some x -> Some (f x)

  let safe_sqrt_then_div a b =
    if a < 0.0 then None
    else if b = 0.0 then None
    else Some (sqrt a /. b)
  ;;
  assert (map_option (fun x -> x * 2) (Some 5) = Some 10);
  assert (safe_sqrt_then_div 16.0 2.0 = Some 2.0);
  assert (safe_sqrt_then_div (-1.0) 2.0 = None);
  ```

## **15. The Pipe Operator**

*New for C-style learners*
Objective: Understand |> as left-to-right function composition (like Unix pipes).
Assignment:

* Rewrite the expression String.length (String.uppercase_ascii "hello") using |>.
* Write a pipeline that takes a number, adds 5, multiplies by 2, then converts to string.

Tests:

* Example:
  ```ocaml
  let result = "hello" |> String.uppercase_ascii |> String.length
  ;;
  assert (result = 5);

  let process n =
    n
    |> (+) 5
    |> ( * ) 2
    |> string_of_int
  ;;
  assert (process 3 = "16");
  ```

## **16. Higher-order functions (HOF): map/filter/fold**

Objective: Use List.map, List.filter, and one List.fold_left.
Assignment:

* Rewrite exercise 11 using List.filter + List.map.
* Also write sum : int list -> int using fold_left.

Tests:

* Example:
  ```ocaml
  let evens_times_10 xs =
    xs
    |> List.filter (fun x -> x mod 2 = 0)
    |> List.map (fun x -> x * 10)
  ;;
  assert (evens_times_10 [1;2;3;4] = [20;40]);

  let sum xs = List.fold_left ( + ) 0 xs
  ;;
  assert (sum [1;2;3] = 6);
  ```

## **17. Strings and Basic Manipulation**

Objective: Learn string operations and that strings are immutable.
Assignment:

* Write word_count : string -> int that counts space-separated words.
* Write reverse_words : string -> string that reverses word order.

Tests:

* Example:
  ```ocaml
  let word_count s =
    if String.length s = 0 then 0
    else
      String.split_on_char ' ' s
      |> List.filter (fun w -> String.length w > 0)
      |> List.length

  let reverse_words s =
    String.split_on_char ' ' s
    |> List.rev
    |> String.concat " "
  ;;
  assert (word_count "hello world test" = 3);
  assert (reverse_words "hello world" = "world hello");
  ```

## **18. Records: complex numbers (data modeling)**

Objective: Define a record type and implement basic operations.
Assignment:

* Define type complex = { re : float; im : float }
* Implement cadd and cmul.

Tests:

* Example:
  ```ocaml
  type complex = { re : float; im : float }

  let cadd a b = { re = a.re +. b.re; im = a.im +. b.im }

  let cmul a b =
    { re = (a.re *. b.re) -. (a.im *. b.im)
    ; im = (a.re *. b.im) +. (a.im *. b.re)
    }
  ;;
  let a = { re = 1.0; im = 2.0 } in
  let b = { re = 3.0; im = 4.0 } in
  let p = cmul a b in
  assert (p.re = -5.0 && p.im = 10.0);
  ```

## **19. Modules: encapsulate complex arithmetic**

Objective: Use a module + signature to hide representation.
Assignment:

* Create module type COMPLEX exposing:
  * type t
  * val create : float -> float -> t
  * val add : t -> t -> t
  * val mul : t -> t -> t
  * val re : t -> float
  * val im : t -> float
  * val compare : t -> t -> int (* needed for next exercise *)
* Implement module Complex : COMPLEX.

Tests:

* Example:
  ```ocaml
  module type COMPLEX = sig
    type t
    val create : float -> float -> t
    val add : t -> t -> t
    val mul : t -> t -> t
    val re : t -> float
    val im : t -> float
    val compare : t -> t -> int
  end

  module Complex : COMPLEX = struct
    type t = { re : float; im : float }
    let create re im = { re; im }
    let add a b = { re = a.re +. b.re; im = a.im +. b.im }
    let mul a b =
      { re = (a.re *. b.re) -. (a.im *. b.im)
      ; im = (a.re *. b.im) +. (a.im *. b.re)
      }
    let re a = a.re
    let im a = a.im
    (* simple lexicographic comparison *)
    let compare a b =
      let c = compare a.re b.re in
      if c <> 0 then c else compare a.im b.im
  end
  ;;
  let z = Complex.create 1.0 2.0 in
  assert (Complex.re z = 1.0);
  ```

## **20. Functors: Generating Structures**

*New for Intermediate Learning*
Objective: Understand that Functors are functions from Modules to Modules. They are essential for generic data structures like Sets and Maps.
Assignment:

* Use Set.Make to create a module ComplexSet.
* Create a set containing three complex numbers (two identical, one different).
* Verify the size of the set is 2 (deduplication).

Tests:

* Example:
  ```ocaml
  module ComplexSet = Set.Make(Complex)

  let s = ComplexSet.empty
    |> ComplexSet.add (Complex.create 1.0 1.0)
    |> ComplexSet.add (Complex.create 1.0 1.0)
    |> ComplexSet.add (Complex.create 2.0 2.0)
  ;;
  assert (ComplexSet.cardinal s = 2);
  ```

## **21. Exceptions: When Things Go Wrong**

*New for Intermediate Learning*
Objective: Learn OCaml's exception mechanism and when to use it vs Result.
Assignment:

* Write safe_head : 'a list -> 'a that raises Not_found on empty list.
* Write safe_head_opt : 'a list -> 'a option that returns None instead.
* Write try_divide : int -> int -> int that catches Division_by_zero and returns 0.

Tests:

* Example:
  ```ocaml
  let safe_head xs =
    match xs with
    | [] -> raise Not_found
    | x :: _ -> x

  let safe_head_opt xs =
    match xs with
    | [] -> None
    | x :: _ -> Some x

  let try_divide a b =
    try a / b
    with Division_by_zero -> 0
  ;;
  assert (safe_head_opt [] = None);
  assert (try_divide 10 0 = 0);
  ```

## **22. Arrays and Mutation**

*New for C-style learners (finally familiar territory)*
Objective: Learn array.(i) indexing and in-place update with <-.
Assignment:

* Write swap : 'a array -> int -> int -> unit.

Tests:

* Example:
  ```ocaml
  let swap a i j =
    let tmp = a.(i) in
    a.(i) <- a.(j);
    a.(j) <- tmp
  ;;
  let a = [|1;2;3|] in
  swap a 0 2;
  assert (a = [|3;2;1|]);
  ```

## **23. Refs: Mutable Variables**

*New for Intermediate Learning*
Objective: Learn that ref is how OCaml handles mutable pointers. This is effectively a malloc(sizeof(int)) in C syntax.
Assignment:

* Write a function impure_counter : int -> int that takes a limit n, counts up to it using a while loop and a ref, and returns the sum.

Tests:

* Example:
  ```ocaml
  let impure_counter n =
    let sum = ref 0 in
    let i = ref 1 in
    while !i <= n do
      sum := !sum + !i;
      i := !i + 1
    done;
    !sum
  ;;
  assert (impure_counter 3 = 6);
  ```

## **24. Immutability vs Mutation: When to Use What**

Objective: Understand the trade-offs and typical usage patterns.
Assignment:

* Implement list_reverse_functional : 'a list -> 'a list using pure recursion with an accumulator.
* Implement array_reverse_imperative : 'a array -> unit that reverses in-place.
* Discuss: Why might you prefer one over the other?

Tests:

* Example:
  ```ocaml
  let list_reverse_functional xs =
    let rec aux acc = function
      | [] -> acc
      | x :: rest -> aux (x :: acc) rest
    in
    aux [] xs

  let array_reverse_imperative arr =
    let n = Array.length arr in
    for i = 0 to (n / 2) - 1 do
      swap arr i (n - 1 - i)
    done
  ;;
  assert (list_reverse_functional [1;2;3] = [3;2;1]);
  let a = [|1;2;3|] in
  array_reverse_imperative a;
  assert (a = [|3;2;1|]);
  ```

## **25. The Result Type: Robust Error Handling**

*New for Intermediate Learning*
Objective: Don't use exceptions for logic errors. Use Result (Ok | Error) to enforce handling.
Assignment:

* Write validate_size : int -> (int, string) result.
* It should return Ok n if n is a power of 2, and Error "Not a power of 2" otherwise.
* Write bind_result : ('a, 'e) result -> ('a -> ('b, 'e) result) -> ('b, 'e) result.

Tests:

* Example:
  ```ocaml
  let is_power_of_two n = n > 0 && (n land (n - 1) = 0)

  let validate_size n =
    if is_power_of_two n then Ok n
    else Error "Not a power of 2"

  let bind_result r f =
    match r with
    | Ok x -> f x
    | Error e -> Error e
  ;;
  assert (validate_size 4 = Ok 4);
  assert (validate_size 3 = Error "Not a power of 2");

  let result = validate_size 8 |> bind_result (fun n -> Ok (n * 2)) in
  assert (result = Ok 16);
  ```

## **26. Roots of unity (twiddle factors)**

Objective: Generate complex exponentials used in FFT: W_k = exp(-2πi*k/N).
Assignment:

* Write roots : int -> Complex.t array producing twiddle factors.
* Use Complex.create with re = cos(theta) and im = sin(theta).

Tests:

* Example check (approximate):
  ```ocaml
  let pi = 4.0 *. atan 1.0

  let roots n =
    Array.init n (fun k ->
      let theta = -2.0 *. pi *. float_of_int k /. float_of_int n in
      Complex.create (cos theta) (sin theta)
    )
  ;;
  let w = roots 4 in
  (* W_0 should be approximately 1 + 0i *)
  let w0 = w.(0) in
  assert (abs_float (Complex.re w0 -. 1.0) < 1e-10);
  assert (abs_float (Complex.im w0) < 1e-10);
  ```

## **27. Naive DFT (correctness oracle)**

Objective: Implement the O(N^2) DFT to validate FFT results later.
Assignment:

* Write dft : Complex.t array -> Complex.t array.
* Use the formula: X[k] = Σ(n=0 to N-1) x[n] * exp(-2πikn/N)

Tests:

* Example:
  ```ocaml
  let dft input =
    let n = Array.length input in
    let output = Array.make n (Complex.create 0.0 0.0) in
    let pi = 4.0 *. atan 1.0 in
    for k = 0 to n - 1 do
      let sum = ref (Complex.create 0.0 0.0) in
      for j = 0 to n - 1 do
        let theta = -2.0 *. pi *. float_of_int (k * j) /. float_of_int n in
        let twiddle = Complex.create (cos theta) (sin theta) in
        let term = Complex.mul input.(j) twiddle in
        sum := Complex.add !sum term
      done;
      output.(k) <- !sum
    done;
    output
  ;;
  (* Test on simple input *)
  let test_input = [|
    Complex.create 1.0 0.0;
    Complex.create 0.0 0.0;
    Complex.create 0.0 0.0;
    Complex.create 0.0 0.0
  |] in
  let result = dft test_input in
  (* First element should be sum of all inputs *)
  assert (abs_float (Complex.re result.(0) -. 1.0) < 1e-10);
  ```

## **28. Radix-2 FFT (Cooley–Tukey) - Recursive**

Objective: Implement a recursive FFT using divide-and-conquer.
Assignment:

* Write fft_recursive : Complex.t array -> Complex.t array.
* Split into even and odd indices, recurse, then combine with twiddle factors.
* Assume input size is a power of 2.

Tests:

* Example:
  ```ocaml
  let rec fft_recursive input =
    let n = Array.length input in
    if n = 1 then input
    else begin
      let even = Array.init (n / 2) (fun i -> input.(2 * i)) in
      let odd = Array.init (n / 2) (fun i -> input.(2 * i + 1)) in
      let fft_even = fft_recursive even in
      let fft_odd = fft_recursive odd in
      let output = Array.make n (Complex.create 0.0 0.0) in
      let pi = 4.0 *. atan 1.0 in
      for k = 0 to (n / 2) - 1 do
        let theta = -2.0 *. pi *. float_of_int k /. float_of_int n in
        let twiddle = Complex.create (cos theta) (sin theta) in
        let t = Complex.mul twiddle fft_odd.(k) in
        output.(k) <- Complex.add fft_even.(k) t;
        output.(k + n / 2) <- Complex.add fft_even.(k) (Complex.create (-.Complex.re t) (-.Complex.im t))
      done;
      output
    end
  ;;
  (* Compare with DFT on same input *)
  let test_input = [|
    Complex.create 1.0 0.0;
    Complex.create 2.0 0.0;
    Complex.create 3.0 0.0;
    Complex.create 4.0 0.0
  |] in
  let dft_result = dft test_input in
  let fft_result = fft_recursive test_input in
  (* Results should match within floating point tolerance *)
  for i = 0 to 3 do
    assert (abs_float (Complex.re dft_result.(i) -. Complex.re fft_result.(i)) < 1e-10)
  done;
  ```

---

## **29. Local Development Module (Read Only)**

*Checkpoint: Leaving the Browser*
Up to this point, you may have used an online REPL. For the Capstone, you need a real environment because we will interface with C code.

**Key Concepts:**

1. **Opam**: The Package Manager (like npm or pip).
   * `opam switch create . 5.0.0` (Creates an isolated compiler environment for this project)
   * `opam install dune`
2. **Dune**: The Build System (like make or cmake, but specific to OCaml).
   * `dune init project fft_project` creates a standard directory structure (bin/, lib/, test/).
3. **Dune Files**:
   * dune files live in directories and describe what to build.
   * To use Bigarray, you must add `(libraries bigarray)` to your dune file.

**Action Item:**

* Install Opam.
* Initialize a new project: `dune init project fftw_caml`.
* Move your Complex module into lib/complex.ml.
* Create a dune file in lib/:
  ```
  (library
   (name fftw_caml)
   (libraries bigarray))
  ```

---

## **30. Capstone Phase 1: Understanding Bigarray**

Objective: Standard OCaml arrays are arrays of pointers (boxed). For FFTW, we need contiguous memory.
Assignment:

* Use the Bigarray module to create a 1D array of floats.
* Learn to access elements using .{i} syntax or Array1.get/set.
* Create a function fill_with_sin : Bigarray.Array1.t -> unit that fills the array with sin values.
* This maps directly to a double* in C.

Tests:

* Example:
  ```ocaml
  open Bigarray
  let n = 10
  let buffer = Array1.create float64 c_layout n
  ;;
  buffer.{0} <- 1.23;
  assert (buffer.{0} = 1.23);

  let fill_with_sin arr =
    let n = Array1.dim arr in
    for i = 0 to n - 1 do
      let x = float_of_int i in
      arr.{i} <- sin x
    done
  ;;
  let test_arr = Array1.create float64 c_layout 5 in
  fill_with_sin test_arr;
  assert (abs_float (test_arr.{0} -. sin 0.0) < 1e-10);
  ```

## **31. Capstone Phase 2: Complex Numbers in Bigarray**

Objective: Represent complex numbers as interleaved real/imag values in a Bigarray (FFTW convention).
Assignment:

* Create a function complex_to_bigarray : Complex.t array -> Bigarray.Array1.t that converts.
* Create a function bigarray_to_complex : Bigarray.Array1.t -> Complex.t array that converts back.
* Convention: [re0, im0, re1, im1, ...] in the Bigarray.

Tests:

* Example:
  ```ocaml
  let complex_to_bigarray carr =
    let n = Array.length carr in
    let barr = Array1.create float64 c_layout (2 * n) in
    for i = 0 to n - 1 do
      barr.{2 * i} <- Complex.re carr.(i);
      barr.{2 * i + 1} <- Complex.im carr.(i)
    done;
    barr

  let bigarray_to_complex barr =
    let n = Array1.dim barr / 2 in
    Array.init n (fun i ->
      Complex.create barr.{2 * i} barr.{2 * i + 1}
    )
  ;;
  let test = [| Complex.create 1.0 2.0; Complex.create 3.0 4.0 |] in
  let ba = complex_to_bigarray test in
  let back = bigarray_to_complex ba in
  assert (Complex.re back.(0) = 1.0 && Complex.im back.(0) = 2.0);
  ```

## **32. Capstone Phase 3: In-place FFT Foundation**

Objective: Implement bit-reversal permutation needed for iterative FFT.
Assignment:

* Write reverse_bits : int -> int -> int that reverses the low nbits of a number.
* Write bit_reverse_permute : Complex.t array -> Complex.t array that reorders elements.
* This is preparation for Cooley-Tukey iterative implementation.

Tests:

* Example:
  ```ocaml
  let reverse_bits x nbits =
    let rec aux acc x n =
      if n = 0 then acc
      else aux ((acc lsl 1) lor (x land 1)) (x lsr 1) (n - 1)
    in
    aux 0 x nbits

  let bit_reverse_permute arr =
    let n = Array.length arr in
    let log_n = int_of_float (log (float_of_int n) /. log 2.0) in
    Array.init n (fun i ->
      let j = reverse_bits i log_n in
      arr.(j)
    )
  ;;
  assert (reverse_bits 0b0001 4 = 0b1000);
  assert (reverse_bits 0b0110 4 = 0b0110);
  ```

## **33. Capstone Phase 4: Iterative FFT**

Objective: Implement in-place iterative FFT (more cache-friendly than recursive).
Assignment:

* Write fft_iterative : Complex.t array -> Complex.t array.
* Start with bit-reversal, then iterate through stages combining pairs.
* This mimics FFTW's approach more closely.

Tests:

* Example skeleton:
  ```ocaml
  let fft_iterative input =
    let n = Array.length input in
    let arr = bit_reverse_permute input in
    let pi = 4.0 *. atan 1.0 in

    let stage_size = ref 2 in
    while !stage_size <= n do
      let half_stage = !stage_size / 2 in
      let angle = -2.0 *. pi /. float_of_int !stage_size in

      for i = 0 to n - 1 do
        if i land half_stage = 0 then begin
          let k = i mod half_stage in
          let theta = angle *. float_of_int k in
          let twiddle = Complex.create (cos theta) (sin theta) in
          let j = i + half_stage in
          if j < n then begin
            let t = Complex.mul twiddle arr.(j) in
            arr.(j) <- Complex.add arr.(i) (Complex.create (-.Complex.re t) (-.Complex.im t));
            arr.(i) <- Complex.add arr.(i) t
          end
        end
      done;
      stage_size := !stage_size * 2
    done;
    arr
  ;;
  (* Verify against recursive version *)
  ```

## **34. Capstone Phase 5: The Planner (Symbolic Representation)**

Objective: FFTW distinguishes between "planning" (finding the strategy) and "execution". Use Variants to model this tree.
Assignment:

* Define a "Plan" type (ADT) representing different FFT strategies.
* Include: DFT_Naive, FFT_Radix2_Recursive, FFT_Radix2_Iterative.
* Add size validation.

Tests:

* Example:
  ```ocaml
  type direction = Forward | Backward

  type plan =
    | DFT_Naive of { n : int; dir : direction }
    | FFT_Radix2_Recursive of { n : int; dir : direction }
    | FFT_Radix2_Iterative of { n : int; dir : direction }

  let make_plan n dir =
    if n <= 0 then Error "Size must be positive"
    else if not (is_power_of_two n) then Error "Size must be power of 2"
    else if n <= 4 then Ok (DFT_Naive { n; dir })
    else if n <= 1024 then Ok (FFT_Radix2_Recursive { n; dir })
    else Ok (FFT_Radix2_Iterative { n; dir })
  ;;
  assert (make_plan 4 Forward = Ok (DFT_Naive { n = 4; dir = Forward }));
  assert (make_plan 3 Forward = Error "Size must be power of 2");
  ```

## **35. Capstone Phase 6: The Executor (Interpreter)**

Objective: Execute the symbolic plan on actual data.
Assignment:

* Write execute_plan : plan -> Complex.t array -> Complex.t array.
* This function pattern matches on the plan and dispatches to the appropriate implementation.
* Handle both Forward and Backward transforms (Backward requires normalization).

Tests:

* Example:
  ```ocaml
  let execute_plan plan input =
    match plan with
    | DFT_Naive { n; dir } ->
        if dir = Forward then dft input
        else (* implement inverse DFT *) input
    | FFT_Radix2_Recursive { n; dir } ->
        if dir = Forward then fft_recursive input
        else (* implement inverse *) input
    | FFT_Radix2_Iterative { n; dir } ->
        if dir = Forward then fft_iterative input
        else (* implement inverse *) input
  ;;
  let test_data = Array.init 8 (fun i -> Complex.create (float_of_int i) 0.0) in
  let plan_result = make_plan 8 Forward in
  match plan_result with
  | Ok plan ->
      let result = execute_plan plan test_data in
      (* Verify result *)
      ()
  | Error _ -> failwith "Plan creation failed"
  ```

## **36. Capstone Phase 7: Bigarray Integration**

Objective: Make the executor work with Bigarray instead of Complex.t array.
Assignment:

* Write execute_plan_bigarray : plan -> Bigarray.Array1.t -> Bigarray.Array1.t.
* Convert between Bigarray and Complex.t array internally as needed.
* This prepares for C interop where we'll work with raw buffers.

Tests:

* Example:
  ```ocaml
  let execute_plan_bigarray plan input_ba =
    let complex_arr = bigarray_to_complex input_ba in
    let result_arr = execute_plan plan complex_arr in
    complex_to_bigarray result_arr
  ;;
  let n = 8 in
  let ba_input = Array1.create float64 c_layout (2 * n) in
  for i = 0 to n - 1 do
    ba_input.{2 * i} <- float_of_int i;
    ba_input.{2 * i + 1} <- 0.0
  done;
  let plan = Result.get_ok (make_plan n Forward) in
  let result_ba = execute_plan_bigarray plan ba_input in
  (* Verify dimensions *)
  assert (Array1.dim result_ba = 2 * n);
  ```

## **37. Capstone Phase 8: C Interop - Simple Function**

Objective: Pass your Bigarray to a C function.
Assignment:

* Write a C function `void c_scale(double* data, int n, double factor)` that multiplies every element by factor.
* Use `external` to bind it in OCaml.
* Create appropriate C stubs file and dune configuration.

Files needed:

* stubs.c:
  ```c
  #include <caml/mlvalues.h>
  #include <caml/bigarray.h>

  //scale array in place
  void c_scale_impl(double* data, int n, double factor) {
    for (int i = 0; i < n; i++) {
      data[i] *= factor;
    }
  }

  //caml wrapper
  CAMLprim value c_scale(value ba, value n, value factor) {
    double* data = (double*)Caml_ba_data_val(ba);
    c_scale_impl(data, Int_val(n), Double_val(factor));
    return Val_unit;
  }
  ```

* OCaml side:
  ```ocaml
  external c_scale :
    (float, Bigarray.float64_elt, Bigarray.c_layout) Bigarray.Array1.t ->
    int ->
    float ->
    unit = "c_scale"

  let test () =
    let arr = Array1.create float64 c_layout 5 in
    for i = 0 to 4 do arr.{i} <- float_of_int i done;
    c_scale arr 5 2.0;
    assert (arr.{2} = 4.0);
    print_endline "C interop test passed"
  ```

* Update dune file:
  ```
  (library
   (name fftw_caml)
   (libraries bigarray)
   (c_names stubs))
  ```

## **38. Capstone Phase 9: C-based DFT Implementation**

Objective: Implement the DFT in C for performance comparison.
Assignment:

* Write a C function that implements naive DFT on interleaved complex data.
* Bind it to OCaml and compare performance with OCaml implementation.
* Measure timing differences on arrays of size 128, 256, 512.

Tests:

* C implementation in stubs.c:
  ```c
  #include <math.h>
  #include <caml/mlvalues.h>
  #include <caml/bigarray.h>

  //naive dft: input and output are interleaved [re,im,re,im,...]
  void c_dft_impl(double* input, double* output, int n) {
    const double pi = 3.14159265358979323846;
    for (int k = 0; k < n; k++) {
      double sum_re = 0.0, sum_im = 0.0;
      for (int j = 0; j < n; j++) {
        double theta = -2.0 * pi * k * j / n;
        double cos_t = cos(theta);
        double sin_t = sin(theta);
        double in_re = input[2 * j];
        double in_im = input[2 * j + 1];
        sum_re += in_re * cos_t - in_im * sin_t;
        sum_im += in_re * sin_t + in_im * cos_t;
      }
      output[2 * k] = sum_re;
      output[2 * k + 1] = sum_im;
    }
  }

  CAMLprim value c_dft(value input_ba, value output_ba, value n) {
    double* input = (double*)Caml_ba_data_val(input_ba);
    double* output = (double*)Caml_ba_data_val(output_ba);
    c_dft_impl(input, output, Int_val(n));
    return Val_unit;
  }
  ```

* OCaml binding:
  ```ocaml
  external c_dft :
    (float, Bigarray.float64_elt, Bigarray.c_layout) Bigarray.Array1.t ->
    (float, Bigarray.float64_elt, Bigarray.c_layout) Bigarray.Array1.t ->
    int ->
    unit = "c_dft"
  ```

## **39. Capstone Phase 10: Wisdom System (Optional Advanced)**

Objective: Implement a "wisdom" system that remembers optimal plans for given sizes.
Assignment:

* Create a mutable Map or Hashtbl that stores best plans for each size.
* Write save_wisdom : string -> unit and load_wisdom : string -> unit to persist to file.
* Implement a benchmarking function that tests different strategies and updates wisdom.

This demonstrates:
- File I/O
- Mutable data structures
- Marshaling/serialization
- Performance measurement

Tests:

* Example skeleton:
  ```ocaml
  module Wisdom = struct
    type wisdom_entry = {
      size : int;
      best_plan : plan;
      execution_time : float;
    }

    let wisdom_table : (int, wisdom_entry) Hashtbl.t = Hashtbl.create 100

    let add size plan time =
      Hashtbl.replace wisdom_table size { size; best_plan = plan; execution_time = time }

    let lookup size =
      Hashtbl.find_opt wisdom_table size

    let save filename =
      let oc = open_out filename in
      Marshal.to_channel oc wisdom_table [];
      close_out oc

    let load filename =
      try
        let ic = open_in filename in
        let loaded = (Marshal.from_channel ic : (int, wisdom_entry) Hashtbl.t) in
        close_in ic;
        Hashtbl.iter (fun k v -> Hashtbl.replace wisdom_table k v) loaded
      with _ -> ()
  end
  ```

## **40. Capstone Phase 11: Final Integration and CLI**

Objective: Create a command-line tool that brings everything together.
Assignment:

* Create bin/main.ml with a CLI interface.
* Accept arguments: size, input file, output file, use C implementation flag.
* Support loading/saving wisdom.
* Provide help text and error handling.

Example:

```ocaml
(* bin/main.ml *)
let usage = "fftw_caml -n <size> [-i input.txt] [-o output.txt] [--use-c] [--wisdom wisdom.dat]"

let main () =
  let size = ref 0 in
  let input_file = ref None in
  let output_file = ref None in
  let use_c = ref false in
  let wisdom_file = ref None in

  let specs = [
    ("-n", Arg.Set_int size, "FFT size (must be power of 2)");
    ("-i", Arg.String (fun s -> input_file := Some s), "Input file");
    ("-o", Arg.String (fun s -> output_file := Some s), "Output file");
    ("--use-c", Arg.Set use_c, "Use C implementation");
    ("--wisdom", Arg.String (fun s -> wisdom_file := Some s), "Wisdom file");
  ] in

  Arg.parse specs (fun _ -> ()) usage;

  if !size = 0 then begin
    Printf.eprintf "Error: Must specify size with -n
%s
" usage;
    exit 1
  end;

  (* Load wisdom if specified *)
  (match !wisdom_file with
   | Some f -> Wisdom.load f
   | None -> ());

  (* Create or load input data *)
  let input_data = match !input_file with
    | Some f -> (* load from file *) Array1.create float64 c_layout (2 * !size)
    | None ->
        (* Generate test data *)
        let arr = Array1.create float64 c_layout (2 * !size) in
        for i = 0 to !size - 1 do
          arr.{2 * i} <- float_of_int i;
          arr.{2 * i + 1} <- 0.0
        done;
        arr
  in

  (* Execute FFT *)
  let plan = Result.get_ok (make_plan !size Forward) in
  let result = execute_plan_bigarray plan input_data in

  (* Save output if specified *)
  (match !output_file with
   | Some f -> (* save to file *) ()
   | None -> Printf.printf "FFT of size %d completed
" !size);

  (* Save wisdom if specified *)
  (match !wisdom_file with
   | Some f -> Wisdom.save f
   | None -> ())

let () = main ()
```

Update bin/dune:
```
(executable
 (name main)
 (libraries fftw_caml bigarray))
```

---

## **Conclusion**

This curriculum takes you from OCaml basics through a sophisticated FFT library with C bindings. The capstone is now broken into granular phases:

1. **Phases 30-31**: Understanding Bigarray and complex number representation
2. **Phases 32-33**: Implementing efficient in-place FFT algorithms
3. **Phases 34-36**: Building the planner/executor abstraction
4. **Phases 37-39**: C interop with increasing complexity
5. **Phases 40**: Final integration

Each phase builds concrete skills needed for the next, making the learning curve manageable while working toward a production-quality system.
