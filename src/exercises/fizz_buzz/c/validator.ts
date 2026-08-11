export function validate(_code: string, output: string): true | string {
  if (output.includes("FAIL:")) {
    return "Some tests failed. Check the output for details.";
  }
  if (output.includes("PASS:")) {
    return true;
  }
  return "No test output found.";
}

export default validate;
