const Tests = {
  boolCheck(msg: string, b: boolean) {
    if (b) {
      console.log(`Test passed: ${msg}`);
    } else {
      console.log(`Test failed: ${msg}`);
      throw new Error(`Test failed: ${msg}`);
    }
  },

  equalCheck<T>(msg: string, expected: T, actual: T) {
    if (expected === actual) {
      console.log(`Test passed: ${msg}`);
    } else {
      console.log(`Test failed: ${msg}\nExpected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual)}`);
      throw new Error(`Test failed: ${msg}`);
    }
  }
};
