import { describe, test, expect, beforeEach } from 'vitest';
import { _evalCallExpr, _evalMathExpr, makeGradFn } from './forward';
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
