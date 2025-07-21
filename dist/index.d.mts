type Result = {
    value: number;
    gradients: number[];
};

/**
 * Creates a gradient function for a given function.
 * @param fn - function to create gradient function for
 * @returns a function that takes arguments and returns the value and gradients
 */
declare function makeGradFn$1(fn: (...params: any[]) => number): (...args: any[]) => Result;

/**
* Function factory which returns a wrapped version of the function that returns the value as well as the jacobian vector
* @param fn a pure arrow function or reference to another pure function. Only supports functions that returns a single expression which evaluates to a scalar
* @returns a wrapped version of the passed function that returns the standard value as well as the jacobian vector
*/
declare function makeGradFn(fn: (...args: any[]) => number): (...args: any[]) => never | {
    value: number;
    gradients: any[];
};

export { makeGradFn$1 as default, makeGradFn as fwdMakeGradFn_unstable };
