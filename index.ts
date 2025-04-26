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


function evaluate(body: Node, primals: { [key: string | number]: [number, number] }, counter: number): [string | number, number] {
  try {
    switch (body.type) {
      // every step: store primal values, return reference
      // new value: use counter as key, then increment counter

      case "BinaryExpression":
        console.log("Binary Expression!")

        let [firstVal, secondVal, firstDer, secondDer] = [1, 1, 0, 0];

        const first = evaluate((body as BinaryExpression).left, primals, counter)
        counter = first[1];
        firstVal = primals[first[0]][0]
        firstDer = primals[first[0]][1]

        const second = evaluate((body as BinaryExpression).right, primals, counter)
        counter = second[1];
        secondVal = primals[second[0]][0]
        secondDer = primals[second[0]][1]

        const [res, der] = binCombine([firstVal, firstDer], (body as BinaryExpression).operator, [secondVal, secondDer])

        primals[counter] = [res, der]

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
      der = (leftDer - rightDer)
      break;
  }

  return [val, der]
}

// console.log(parse("a + b", {ecmaVersion: "latest"}).body)
const primals = { a: [1, 0], b: [1, 1] }
console.log(evaluate(parse("((b**2 + b) ** 2)", { ecmaVersion: "latest" }).body[0].expression, primals, 0))



// console.dir(parse("((b**2 + b) ** 2)", {ecmaVersion: "latest"}), { depth: null })
