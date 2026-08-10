// JN: since TS lang server will flag errors here as these functions are not availabl, we ignore checks:
// @ts-nocheck
if (typeof fizzbuzz !== "function") {
  throw new Error("fizzbuzz function is not defined");
}

const testCases = [
  [1, "1"],
  [2, "2"],
  [3, "Fizz"],
  [4, "4"],
  [5, "Buzz"],
  [6, "Fizz"],
  [10, "Buzz"],
  [15, "FizzBuzz"],
  [30, "FizzBuzz"],
];

for (const [input, expected] of testCases) {
  const result = fizzbuzz(input as number);
  Tests.equalCheck(`fizzbuzz(${input})`, expected, result);
}
