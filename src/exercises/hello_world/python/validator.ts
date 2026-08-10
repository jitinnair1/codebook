export function validate(_code: string, output: string): true | string {
  const lowercaseOutput = output.toLowerCase();
  if (lowercaseOutput.includes("hello") && lowercaseOutput.includes("world")) return true;
  return "Expected output to contain: hello and world";
}

export default validate;
