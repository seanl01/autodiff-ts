import { describe, expect, test } from 'vitest';
import { _createGraphInternal, _parseGivenFunction, CompNode, Variable } from './reverse'

describe("given a binary expression function", () => {
  test("a graph should be initialised correctly", () => {
    const fn = (x: number, y: number) => x * y
    const { body, params } = _parseGivenFunction(fn)

    const res = _createGraphInternal(body, [], null)

    const compNode: CompNode = res.incoming[0] as CompNode;

    expect(compNode.gradFn).toBeInstanceOf(Function)

    // test incoming variables are
    expect((compNode.incoming[0] as Variable).name).toBe("x")
    expect((compNode.incoming[1] as Variable).name).toBe("y")

    // test variable connection to compNode
    expect(compNode.incoming[0].outgoing).toBe(compNode)
    expect(compNode.incoming[1].outgoing).toBe(compNode)

  })
})
