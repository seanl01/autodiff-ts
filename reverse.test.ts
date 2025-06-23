import { describe, expect, test } from 'vitest';
import { _createGraphInternal, _parseGivenFunction, CompNode, fwdPass, GraphNode, Variable } from './reverse'

describe("given a binary expression function", () => {
  test("a graph should be initialised correctly", () => {
    const fn = (x: number, y: number) => x * y
    const { body } = _parseGivenFunction(fn)

    const res = _createGraphInternal(body, [], null, { env: {}, ordering: [] })

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

describe("given a three-term function", () => {
  test("the topological order is correct", () => {
    const fn = (x: number, y: number) => x * y + 3
    const { body } = _parseGivenFunction(fn)

    const ordering: GraphNode = []
    _createGraphInternal(body, [], null, { env: {}, ordering })

    console.log("ordering", ordering)

    expect(ordering.length).toBe(7)
    expect(ordering[0].name).toBe("x")
    expect(ordering[1].name).toBe("y")
    expect(ordering[2].incoming[0]).toBe(ordering[0])
    expect(ordering[2].incoming[1]).toBe(ordering[1])

    // compnode result is ordering[3]
    expect(ordering[3].incoming[0]).toBe(ordering[2])

    // ordering[5] is compnode for +
    expect(ordering[5].incoming[0]).toBe(ordering[3])
    expect(ordering[5].incoming[1]).toBe(ordering[4])

    console.log("five", ordering[5])
    expect(ordering[5].outgoing).toBe(ordering[6])
    expect(ordering[6].incoming[0]).toBe(ordering[5])

  })
})

describe("given an ordering", () => {
  test("the forward pass works", () => {
    const { body } = _parseGivenFunction((x: number, y: number) => x * y + 3)
    const context = { env: {x: 2, y: 2}, ordering: []}
    _createGraphInternal(body, [], null, context);

    fwdPass(context)

    console.log("ordering", context.ordering)
    expect(context.ordering.slice(-1)[0].value).toEqual(7)
  })

})
