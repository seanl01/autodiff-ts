// fn/kernel
// input vector (arguments)

import {
  CallExpression, ArrowFunctionExpression, ExpressionStatement, BinaryExpression
  , Identifier, Node, parse, BinaryOperator, Literal, Expression, Function as FunctionType,
  BlockStatement,
  ReturnStatement
} from "acorn";
import { full, recursive } from "acorn-walk"
import { MathExpression, Table } from "./types";
import { FunctionExpression } from "typescript";

function fn(x: number, y: number) {
  return x + y;
}


// Intermediate primals:
// The first one to get evaluated is the v0 primal. Subsequent ones that are composed of it come later.

/**
* Function factory which returns a wrapped version of the function that returns the value as well as the jacobian vector
* @param fn a pure arrow function or reference to another pure function. Only supports functions that returns a single expression which evaluates to a scalar
* @returns a wrapped version of the passed function that returns the standard value as well as the jacobian vector
*/

export function makeGradFn(fn: (...args: any[]) => number): (...args: any[]) => never | { value: number, gradients: any[] } {
  let funcExpr = (parse(fn.toString(), { ecmaVersion: 6 })
    .body[0])

  let func: FunctionType;

  if (funcExpr.type === "FunctionDeclaration") {
    if (funcExpr.body instanceof Array)
      throw new Error("Function contains more than just return statement")

    if (funcExpr.body.body[0].type !== "ReturnStatement")
      throw new Error("Function contains more than just return statement")

      func = funcExpr as FunctionType
      func.body = ((func.body as BlockStatement).body[0] as ReturnStatement).argument as Expression
  }

  else if ((funcExpr as ExpressionStatement).expression.type === "ArrowFunctionExpression") {
    func = (funcExpr as ExpressionStatement).expression as ArrowFunctionExpression
  }

  else {
    throw new Error("Invalid function expression")
  }

  console.log("func", func)
  const { body, params } = func
  let value: number | null = null
  const gradients: any[] = []

  return (...args) => {
    // alternate switching "on and off" each argument for forward pass
    const table: Table = {}

    // fill value for each passed argument
    params.forEach((p, idx) => {
      p = p as Identifier
      table[p.name] = [args[idx], 0];
    })

    // Differentiate for each variable
    params.forEach((p, _) => {
      p = p as Identifier
      const tableCopy = structuredClone(table);

      tableCopy[p.name] = [table[p.name][0], 1] // equivalent to multiplying by unit vector

      const [lastPrimalIdx] = fwdPass(body, tableCopy, 0)

      if (value === null)
        value = tableCopy[lastPrimalIdx][0]

      gradients.push(tableCopy[lastPrimalIdx][1]) // push gradient for that param
    })

    if (value === null)
      throw new Error("Invalid value")

    return { value, gradients }
  }
}

function fwdPass(body: Node, table: Table, counter: number): [string | number, number] {
  // takes advantage of pre-computed values?
  // if (counter.toString() in table) {
  //   return [counter, counter + 1]
  // }

  switch (body.type) {
    // every step: store primal values, return reference
    // new value: use counter as key, then increment counter

    case "CallExpression":



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

      const [res, der] = _binCombine([firstVal, firstDer], (body as BinaryExpression).operator, [secondVal, secondDer])

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

export function _evalCallExpr(expr: CallExpression, table: Table, counter: number): [string | number, number] {
  // evaluate callee
  const callee = expr.callee;

  if (callee.type === "MemberExpression") {
    if (callee.object.type === "Identifier" && callee.object.name === "Math")
      return _evalMathExpr(expr as MathExpression, table, counter);

  }



  // evaluate args

  //
}

export function _evalMathExpr(expr: MathExpression, table: Table, counter: number): [string | number, number] {
  const args = expr.arguments

  // evaluate argument
  let key: string | number;
  [key, counter] = fwdPass(args[0], table, counter);

  let [val, der] = [table[key][0], table[key][1]]

  switch (expr.callee.property.name) {
    case "log":
      table[counter] = [Math.log(val), (1 / val * der)]
      break;

    case "sin":
      table[counter] = [Math.sin(val), (Math.cos(val) * der)]
      break;

    case "sqrt":
      table[counter] = _binCombine([val, der], "**", [1 / 2, 0])
      break;
  }

  return [counter, counter + 1]
}


// function evalMathExpr

function _binCombine(left: [number, number], operator: BinaryOperator, right: [number, number]): [number, number] {
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
const funcs = { func: () => b }

console.dir(parse("", { ecmaVersion: "latest" }), { depth: null })



// console.dir(parse("((b**2 + b) ** 2)", {ecmaVersion: "latest"}), { depth: null })
