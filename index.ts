// fn/kernel
// input vector (arguments)

import { ArrowFunctionExpression, ExpressionStatement, BinaryExpression, Identifier, Node, parse, BinaryOperator, Literal } from "acorn";
import { full, recursive } from "acorn-walk"

function fn(x: number, y: number) {
  return x + y;
}


// Intermediate primals:
// The first one to get evaluated is the v0 primal. Subsequent ones that are composed of it come later.


function pass(fn: (...args: any[]) => any) {
  // get params: start from vi - n
  const funcObj = ((parse(fn.toString(), { ecmaVersion: 6 }).body[0] as ExpressionStatement)
    .expression as ArrowFunctionExpression)

  const { body, params } = funcObj;
  console.log(funcObj)

  console.log("params", params)
  console.log("body", body)

  const primals = [...params];

  // full(body, node => {
  //   switch (node.type) {
  //     case "BinaryExpression":

  //   }
  // })

  // output scalar/vector

  // primals

  // gradients
  // tangents

}


function evaluate(body: Node, primals: {[key: string | number]: [number, number]}, counter: number): [string | number, number] {
  let expr: Node = body;

  try {

    switch (body.type) {
      // every step: store primal values, return reference
      // new value: use counter as key, then increment counter

      case "BinaryExpression":
        console.log("Binary Expression!")
        const first = evaluate((body as BinaryExpression).left, primals, counter)
        counter = first[1];
        const second = evaluate((body as BinaryExpression).right, primals, counter)
        counter = second[1];

        const res = binaryOperation(primals[first[0]][0], (body as BinaryExpression).operator, primals[second[0]][0])
        const grad = binGradient(primals[first[0]], (body as BinaryExpression).operator, primals[second[0]])

        primals[counter] = [res, grad]

        return [counter, counter + 1]

      case "Literal":
        const val = (body as Literal).value as number
        primals[counter] = [val, 0]; // the gradient of a literal/scalar is 0
        return [counter, counter + 1]

      case "Identifier":
        return [(body as Identifier).name, counter]

    }
  }

  finally {
    console.log("primals", primals)
  }

  return [0, 0]
}



function binaryOperation(a: number, operator: BinaryOperator, b: number) {
  return eval(`a ${operator} b`)
}

function binGradient(a: [number, number], operator: BinaryOperator, b: [number, number]): number {
  const [aVal, aDiff] = a
  const [bVal, bDiff] = b

  switch (operator) {
    case "*":
      return aVal * bDiff + bVal * aDiff
    case "+":
      return aDiff + bDiff
    case "**":
      return bVal * (aVal ** (bVal - 1))
    case "-":
      return aDiff - bDiff
  }
}

// console.log(parse("a + b", {ecmaVersion: "latest"}).body)
console.log(evaluate(parse("a + 3 * (b ** 2)", {ecmaVersion: "latest"}).body[0].expression, {a: [1, 0], b: [1, 1]}, 0))
