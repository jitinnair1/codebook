const Tests = {
  boolCheck(msg: string, b: boolean) {
    if (b) {
      console.log(`Test passed: ${msg}`);
    } else {
      console.log(`Test failed: ${msg}`);
      throw new Error(`Test failed: ${msg}`);
    }
  },

  equalCheck(msg: string, expected: any, actual: any) {
    if (expected === actual) {
      console.log(`Test passed: ${msg}`);
    } else {
      console.log(`Test failed: ${msg}\nExpected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual)}`);
      throw new Error(`Test failed: ${msg}`);
    }
  }
};
