declare const BUILD_DATE: string;

/** Global test harness helper injected into runtime exercises */
declare const Tests: {
    equalCheck: (name: string, expected: any, actual: any) => boolean;
    deepEqualCheck: (name: string, expected: any, actual: any) => boolean;
    assert: (name: string, condition: boolean, message?: string) => boolean;
    [key: string]: any;
};