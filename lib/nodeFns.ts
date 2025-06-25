import { Variable } from "./classes";
import { ComputeFnStore, Fn } from "./types";

const mathOperators: ComputeFnStore = {
  "*": (vs) => vs[0].value * vs[1].value,
  "+": (vs) => vs[0].value + vs[1].value,
  "**": (vs) => vs[0].value ** vs[1].value,
  "-": (vs) => vs[0].value - vs[1].value,
  "/": (vs) => vs[0].value / vs[1].value
};

const mathFns: ComputeFnStore = {
  "Math.pow": (vs) => Math.pow(vs[0].value, vs[1].value),
  "Math.sin": (vs) => Math.sin(vs[0].value),
  "Math.cos": (vs) => Math.cos(vs[0].value),
  "Math.tan": (vs) => Math.tan(vs[0].value),
  "Math.log": (vs) => Math.log(vs[0].value),
  "Math.exp": (vs) => Math.exp(vs[0].value)
};

const computeFns = { ...mathOperators, ...mathFns }

function provideFn<R extends number | number[]>(operator: string, store: Record<string, Fn<R>>): Fn<R> {
  if (operator in store)
    return store[operator]

  throw new Error(`Unsupported operator type: ${operator}`);
}

/**
 * @description Provides the gradient function for a given operator.
 * @param symbol The operator for which the gradient function is provided.
 * @returns The gradient function for the given operator which returns a pair of gradient values
 */
function provideGradFn(symbol: string): (vs: Variable[]) => number[] {
  // the individual gradients (partial derivative ∂comp/∂left and ∂comp/∂right) are calculated by "swiching on and off" the other variable
  switch (symbol) {
    case "*":
      return (vs) => [vs[1].value, vs[0].value];
    case "+":
      return (vs) => [1, 1];
    case "**":
      return (vs) => [vs[1].value * vs[0].value ** (vs[1].value - 1), Math.log(vs[0].value) * vs[0].value ** vs[1].value];
    case "-":
      return (vs) => [1, -1];
    case "/":
      return (vs) => [1 / vs[1].value, -vs[0].value / (vs[1].value ** 2)];
    default:
      throw new Error(`Unsupported operator type: ${symbol}`);
  }
}

export function provideNodeFns(operator: string) {
  return [provideFn(operator, computeFns), provideGradFn(operator)] as const;
}
