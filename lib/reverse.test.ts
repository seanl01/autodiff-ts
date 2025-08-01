import { beforeEach, describe, expect, test } from 'vitest';
import { parseGivenFunction, bwdPass, Context, fwdPass } from './reverse'
import { makeGradFn, _createGraphInternal } from './reverse';
import { CompNode, GraphNode, Variable } from './classes';

describe("given a binary expression function", () => {
  test("a graph should be initialised correctly", () => {
    const fn = (x: number, y: number) => x * y
    const { body } = parseGivenFunction(fn)

    const res = _createGraphInternal(body, [], null, { args: {}, ordering: [], inputs: {} })

    const compNode: CompNode = res.incoming[0][0] as CompNode;

    expect(compNode.gradFn).toBeInstanceOf(Function)

    // test incoming variables are
    expect((compNode.incoming[0][0] as Variable).name).toBe("x")
    expect((compNode.incoming[1][0] as Variable).name).toBe("y")

    // test variable connection to compNode
    expect(compNode.incoming[0][0].outgoing).toBe(compNode)
    expect(compNode.incoming[1][0].outgoing).toBe(compNode)

  })

})

describe("given a three-term function", () => {
  test("the topological order is correct", () => {
    const fn = (x: number, y: number) => x * y + 3
    const { body } = parseGivenFunction(fn)

    const ordering: GraphNode[] = []
    _createGraphInternal(body, [], null, { args: {}, ordering, inputs: {} })

    console.log("ordering", ordering)

    expect(ordering.length).toBe(7)
    expect((ordering[0] as Variable).name).toBe("x")
    expect((ordering[1] as Variable).name).toBe("y")
    expect(ordering[2].incoming[0][0]).toBe(ordering[0])
    expect(ordering[2].incoming[1][0]).toBe(ordering[1])

    // compnode result is ordering[3]
    expect(ordering[3].incoming[0][0]).toBe(ordering[2])

    // ordering[5] is compnode for +
    expect(ordering[5].incoming[0][0]).toBe(ordering[3])
    expect(ordering[5].incoming[1][0]).toBe(ordering[4])

    console.log("five", ordering[5])
    expect(ordering[5].outgoing).toBe(ordering[6])
    expect(ordering[6].incoming[0][0]).toBe(ordering[5])

  })
})

describe("given an ordering", () => {
  let context: Context
  const { body } = parseGivenFunction((x: number, y: number) => (x**2 * y) + 3)

  beforeEach(() => {
    context = { args: {x: 2, y: 2}, ordering: [], inputs: {}}
    _createGraphInternal(body, [], null, context);
  })

  test("the forward pass works", () => {
    fwdPass(context)
    console.log("ordering", context.ordering)
    expect(context.ordering.slice(-1)[0].value).toEqual(11)
  })

  test("the backward pass works", () => {
    fwdPass(context);
    bwdPass(context)

    expect(context.inputs["x"].gradientAcc).toEqual(8)
    expect(context.inputs["y"].gradientAcc).toEqual(4)
  })

})

describe("given an ordering with repeated variables", () => {
  let context: Context
  const { body } = parseGivenFunction((x: number, y: number) => (x**2 * y) + x * y)

  beforeEach(() => {
    context = { args: {x: 2, y: 2}, ordering: [], inputs: {}}
    _createGraphInternal(body, [], null, context);
  })

  test("the forward pass works", () => {
    fwdPass(context)
    console.log("ordering", context.ordering)
    expect(context.inputs["x"].value).toBe(2)
  })

  test("the backward pass works consecutively", () => {
    fwdPass(context);
    bwdPass(context)

    expect((context.ordering[context.ordering.length - 1] as Variable).value).toEqual(12)
    expect(context.inputs["x"].gradientAcc).toEqual(10)
    expect(context.inputs["y"].gradientAcc).toEqual(6)
    expect("x" in context.args).toBeFalsy()

    context.args["x"] = 3
    context.args["y"] = 3

    fwdPass(context);
    bwdPass(context)

    expect((context.ordering[context.ordering.length - 1] as Variable).value).toEqual(36)
    expect(context.inputs["x"].gradientAcc).toEqual(21)
    expect(context.inputs["y"].gradientAcc).toEqual(12)
  })

})

describe("given a function with repeated variable", () => {
  test("able to create a gradient function", () => {
    const fn = makeGradFn((x, y, z) => x + y * (z ** 2))
    let res = fn(2, 3, 4)

    expect(res.value).toEqual(50)
    expect(res.gradients).toEqual([1, 16, 24])

    res = fn(12, 12, 3)
    expect(res.value).toEqual(120)
    expect(res.gradients).toEqual([1, 9, 72])

  })
})

describe("given a function with math functions", () => {
  test("able to create a gradient function", () => {
    const fn = makeGradFn((x, y) => Math.sin(x) + Math.cos(y))
    let res = fn(2, 3)

    expect(res.value).toEqual(Math.sin(2) + Math.cos(3))
    expect(res.gradients).toEqual([Math.cos(2), -Math.sin(3)])

    res = fn(0, 0)
    expect(res.value).toEqual(1)
    expect(res.gradients[0]).toEqual(Math.cos(0))
    expect(res.gradients[1]).toEqual(Math.abs(-Math.sin(0))) // -0 and 0 bug
  })

})
