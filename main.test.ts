import { describe, test, expect, beforeEach } from 'vitest';
import { _evalCallExpr, _evalMathExpr, makeGradFn } from '.';
import { ExpressionStatement, parse } from 'acorn';
import { MathExpression, Table } from './types';


describe('given a call expr', () => {
  let table: Table = {}
  let counter: number

  beforeEach(() => {
    table = { x: [2, 3] } // non-1 derivative tests chain rule application
    counter = 0;
  })

  const cases = [
    ['Math.log', Math.log(2), 3 / 2],
    ['Math.sin', Math.sin(2), Math.cos(2) * 3],
    ['Math.sqrt', Math.sqrt(2), 3 / 2 * (2 ** -(1 / 2))],
  ]

  test.each(cases)("when the expr is %s, then it should evaluate to the derivative", (fnName, expectedValue, expectedDerivative) => {
    const expr = parse(`${fnName}(x)`, { ecmaVersion: 7 }).body[0] as ExpressionStatement
    const [key] = _evalMathExpr(expr.expression as MathExpression, table, counter)

    expect(table[key]).toEqual([expectedValue, expectedDerivative])
  });

  test("when expr is Math.pow, then it should evaluate to the derivative", () => {
    const expr = parse(`Math.pow(x, 2)`, { ecmaVersion: 7 }).body[0] as ExpressionStatement
    const [key] = _evalMathExpr(expr.expression as MathExpression, table, counter)

    expect(table[key]).toEqual([Math.pow(2, 2), 2 * 2 * 3])
  });

});


describe("given a function expression", () => {
  test("when a unary arrow function is given, then it should return a valid function", () => {
    const { value, gradients } = makeGradFn((x) => x + 3)(3)
    expect(value).toEqual(6)
    expect(gradients).toEqual([1])
  });

  test("when a unary arrow function with exponent is given, then it should return a valid function", () => {
    const { value, gradients } = makeGradFn((x) => x ** 3)(3)
    expect(value).toEqual(27)
    expect(gradients).toEqual([27])
  });

  test("when a binary arrow function is given, then it should return a valid function", () => {
    const { value, gradients } = makeGradFn((x, y) => x * y + 3)(3, 3)
    expect(value).toEqual(12)
    expect(gradients).toEqual([3, 3])
  });

  test("when a normal function declaration is used, then it should return a valid function", () => {
    function fn(x: number) {
      return x + 3
    }
    const { value, gradients } = makeGradFn(fn)(3)
    expect(value).toEqual(6)
    expect(gradients).toEqual([1])
  });

  test("when a normal function declaration is used with extra lines, then it should throw", () => {
    function fn(x: number) {
      console.log("hello")
      return x + 3
    }
    expect(() => makeGradFn(fn)).toThrowError()
  });
});



describe("given a complex function expression", () => {
  test("when a complex function expression is given, then it should return a valid function", () => {
    const { value, gradients } = makeGradFn((x, y) => x * y + Math.sin(x))(3, 3)
    expect(value).toEqual(9 + Math.sin(3))
    expect(gradients).toEqual([3 + Math.cos(3), 3])
  });
  test("when a complex function expression is given, then it should return a valid function", () => {
    const { value, gradients } = makeGradFn((x, y) => x * y + Math.sin(x ** 2))(3, 3)
    expect(value).toEqual(9 + Math.sin(9))
    expect(gradients).toEqual([3 + Math.cos(9) * 6, 3])
  });
});
