import { ComputeFnStore, Fn, GradFnStore as ElemGradFnStore } from "./types";

function provideFn<R extends number | number[]>(operator: string, store: Record<string, Fn<R>>): Fn<R> {
  if (operator in store)
    return store[operator]

  throw new Error(`Unsupported operator type: ${operator}`);
}

const mathOperators: ComputeFnStore = {
  "*": (vs) => vs[0].value * vs[1].value,
  "+": (vs) => vs[0].value + vs[1].value,
  "**": (vs) => vs[0].value ** vs[1].value,
  "-": (vs) => vs[0].value - vs[1].value,
  "/": (vs) => vs[0].value / vs[1].value
};

const mathFns: ComputeFnStore = {
  "pow": (vs) => Math.pow(vs[0].value, vs[1].value),
  "sin": (vs) => Math.sin(vs[0].value),
  "cos": (vs) => Math.cos(vs[0].value),
  "tan": (vs) => Math.tan(vs[0].value),
  "log": (vs) => Math.log(vs[0].value),
  "exp": (vs) => Math.exp(vs[0].value)
};


const gradOperators: ElemGradFnStore = {
  "*": (vs) => [vs[1].value, vs[0].value],
  "+": (vs) => [1, 1],
  "**": (vs) => [vs[1].value * vs[0].value ** (vs[1].value - 1), Math.log(vs[0].value) * vs[0].value ** vs[1].value],
  "-": (vs) => [1, -1],
  "/": (vs) => [1 / vs[1].value, -vs[0].value / (vs[1].value ** 2)]
};

const gradMathFns: ElemGradFnStore = {
  "pow": (vs) => [vs[1].value * vs[0].value ** (vs[1].value - 1), Math.log(vs[0].value) * vs[0].value ** vs[1].value],
  "sin": (vs) => [Math.cos(vs[0].value)],
  "cos": (vs) => [-Math.sin(vs[0].value)],
  "tan": (vs) => [1 / Math.cos(vs[0].value) ** 2],
  "log": (vs) => [1 / vs[0].value],
  "exp": (vs) => [Math.exp(vs[0].value)]
};

const computeFns = { ...mathOperators, ...mathFns }
const gradFns = { ...gradOperators, ...gradMathFns };

export function provideNodeFns(operator: string) {
  return [provideFn(operator, computeFns), provideFn(operator, gradFns)] as const;
}
