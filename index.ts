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

}


// Contains initial args and subsequent primal values.
type Table = { [key: string | number]: [number, number] }

function fwdPass(body: Node, table: Table, counter: number): [string | number, number] | never {
  switch (body.type) {
    // every step: store primal values, return reference
    // new value: use counter as key, then increment counter

    // case "CallExpression":


    case "BinaryExpression":
      console.log("Binary Expression!")

      const first = fwdPass((body as BinaryExpression).left, table, counter)
      counter = first[1];
      let firstVal = table[first[0]][0]
      let firstDer = table[first[0]][1]

      const second = fwdPass((body as BinaryExpression).right, table, counter)
      counter = second[1];
      let secondVal = table[second[0]][0]
      let secondDer = table[second[0]][1]

      const [res, der] = binCombine([firstVal, firstDer], (body as BinaryExpression).operator, [secondVal, secondDer])

      table[counter] = [res, der]

      return [counter, counter + 1]

    case "Literal":
      const val = (body as Literal).value as number
      table[counter] = [val, 0]; // the gradient of a literal/scalar is 0
      return [counter, counter + 1]

    case "Identifier":
      return [(body as Identifier).name, counter]
  }

  throw new Error("Invalid construct")
}


function binCombine(left: [number, number], operator: BinaryOperator, right: [number, number]): [number, number] {
  const [leftVal, leftDer] = left
  const [rightVal, rightDer] = right

  let [val, der] = [0, 0]

  switch (operator) {
    case "*":
      val = leftVal * rightVal
      der = leftVal * rightDer + rightVal * leftDer
      break;
    case "+":
      val = leftVal + rightVal
      der = leftDer + rightDer
      break;
    case "**":
      val = leftVal ** rightVal
      der = (rightVal * (leftVal ** (rightVal - 1)))
        * (leftDer + leftVal ** rightVal * Math.log(leftVal) * rightDer) // handles the case when the exponent contains the variable being differentiated w.r.t
      break;
    case "-":
      val = leftVal - rightVal
      der = leftDer - rightDer
      break;
  }

  return [val, der]
}

// console.log(parse("a + b", {ecmaVersion: "latest"}).body)
const primals = { a: [1, 0], b: [1, 1] }
// console.log(fwdPass(parse("((b**2 + b) ** 2)", { ecmaVersion: "latest" }).body[0].expression, primals, 0))
console.dir(parse("Math.log(b)", { ecmaVersion: "latest"}), {depth: null})



// console.dir(parse("((b**2 + b) ** 2)", {ecmaVersion: "latest"}), { depth: null })
