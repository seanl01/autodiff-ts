// class that computational node info
// can we use the same forward pass?

import { Pattern, parse, Identifier, BinaryExpression, BlockStatement, ReturnStatement, Expression, ExpressionStatement, ArrowFunctionExpression, Function as FunctionType, Node as NodeType, Literal } from "acorn";
// import { MathExpression } from "./types";
// interface for primal/node/variable (value, gradient)
// If we can account for two tracks at the same time, that would be good

// each module should implement its own combination function
// addition?
// log?

class GraphNode {
  public incoming: GraphNode[]
  public outgoing: GraphNode | null
  constructor() {
    this.incoming = [];
    this.outgoing = null;
  };
}

export class Variable extends GraphNode {
  constructor(
    public name: string,
    public value: number,
    public gradient: number,
    public gradientAcc: number
  ){
    super();
  }

  static fromIdentifier(identifier: Identifier, outgoing: GraphNode) {
    const node = new Variable(identifier.name, 0, 0, 1);
    node.outgoing = outgoing;
    return node;
  }

  static fromCompNode(compNode: CompNode) {
    const node = new Variable("", 0, 0, 1);
    node.incoming = [compNode];
    return node;
  }
}

export class CompNode extends GraphNode {
  public computeFn: (variables: Variable[]) => number;
  public gradFn: (variable: Variable[]) => number; // reverse

  constructor(
  ) {
    super();
    this.computeFn = () => 0;
    this.gradFn = () => 1;
  }

  public bindComputeFn(computeFn: (variables: number[]) => number) {
    this.computeFn = (variables: Variable[]) => computeFn(variables.map(v => v.value));
  }
}

// function autograd(fwdPass: Function, rvPass: Function):

// from an AST, we generate the graph of compnodes
// we create an environment to store the identifiers and use the same node to refer.

function createGraph(parsedFn: { body: NodeType, params: Pattern[] }) {
  // We start evaluating the first binary expression

  // helpers to evaluate variables, binary combinations, and math functions

  // return reference to the final output node

}

export function _createGraphInternal(body: NodeType, incoming: GraphNode[], outgoing: GraphNode | null): Variable {
  switch (body.type) {
    case "Literal":
      return Variable.fromIdentifier(body as Identifier, outgoing as GraphNode);

    case "Identifier":
      return Variable.fromIdentifier(body as Identifier, outgoing as GraphNode);

    case "BinaryExpression":
      const comp = new CompNode()

      // evaluate left side and right side
      // connect left/right node's outgoing to compnode, and compnode's incoming to left/right node
      const leftNode = _createGraphInternal((body as BinaryExpression).left, [], comp);
      const rightNode = _createGraphInternal((body as BinaryExpression).right, [], comp);

      comp.incoming = [leftNode, rightNode]

      // bind computation and backward gradient functions to compnode
      comp.bindComputeFn((vs) => vs[0] * vs[1]);
      comp.gradFn = (vs) => vs[0].value * vs[1].gradient + vs[1].value * vs[0].gradient;

      // compNode result variable
      return Variable.fromCompNode(comp);

    default:
      throw new Error(`Unsupported node type: ${body.type}`);
  }
}

// TODO: fill values
// initialise an environment
// for each param, we store in environment



export function _parseGivenFunction(fn: (...args: any[]) => number): { body: NodeType, params: Pattern[] } {
  // evaluates both normal function declarations and arrow functions
  let funcExpr = (parse(fn.toString(), { ecmaVersion: 7 })
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

  const { body, params } = func

  return { body, params }
}

function fwdPass() {
  // calculates values for each node in the graph


}


// This is still a forward pass, but we are using reverse mode.
// This simply calculates the gradient of the child node with respect to its inputs.
// It stores this partial derivative in the input nodes.

// function _binCombine(left: Variable, operator: string, right: Variable): Variable {
//   const operatorNode = new CompNode([left, right], new Variable(1, 1, 1))
//   switch (operator) {
//     case "*":
//       left.gradient = right.value
//       right.gradient = left.value
//       operatorNode.output.value = left.value * right.value
//       break;
//     case "+":
//       left.gradient = 1
//       right.gradient = 1
//       operatorNode.output.value = left.value + right.value
//       break;
//     case "**":
//       left.gradient = right.value ** (right.value - 1)
//       right.gradient = left.value ** right.value * Math.log(left.value)
//       operatorNode.output.value = left.value + right.value
//       break;
//     case "-":
//       left.gradient = 1
//       right.gradient = -1
//       operatorNode.output.value = left.value - right.value
//       break;
//     default:
//       throw new Error(`Unsupported binary operator: ${operator}`)
//   }

//   return operatorNode.output;
// }

// function reverseModeMath(node: CompNode, expr: MathExpression): CompNode {
//   const childNode = new CompNode(0, 0, [node]);
//   const args = expr.arguments;

//   switch (expr.callee.property.name) {
//     case "log":
//       childNode.value = Math.log(node.value)
//       childNode.gradient =
//       break;

//     case "sin":
//       table[counter] = [Math.sin(val), (Math.cos(val) * der)]
//       break;

//     case "sqrt":
//       table[counter] = _binCombine([val, der], "**", [1 / 2, 0])
//       break;

//     case "pow":
//       [key, counter] = fwdPass(args[1], table, counter)
//       let [rightVal, rightDer] = table[key]
//       table[counter] = _binCombine([val, der], "**", [rightVal, rightDer])
//       break;

//     default:
//       throw new Error(`Unsupported math function: ${expr.callee.property.name.toString()}`)
//   }
// }
