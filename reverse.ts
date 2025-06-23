// class that computational node info
// can we use the same forward pass?

import { Pattern, parse, Identifier, BinaryExpression, BlockStatement, ReturnStatement, Expression, ExpressionStatement, ArrowFunctionExpression, Function as FunctionType, Node as NodeType, Literal } from "acorn";
// import { MathExpression } from "./types";
// interface for primal/node/variable (value, gradient)
// If we can account for two tracks at the same time, that would be good

interface Context {
  env: {[key: string]: number};
  ordering: GraphNode[]
}

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
    public name: string | null,
    public value: number,
    public gradient: number,
    public gradientAcc: number
  ){
    super();
  }

  static fromLiteral(value: number, outgoing: GraphNode) {
    const node = new Variable(null, value, 0, 1);
    node.outgoing = outgoing;
    return node;
  }

  static fromIdentifier(identifier: Identifier, outgoing: GraphNode) {
    const node = new Variable(identifier.name, 0, 0, 1);
    node.outgoing = outgoing;
    return node;
  }

  static fromCompNode(compNode: CompNode) {
    const node = new Variable(null, 0, 0, 1);
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
}

// function autograd(fwdPass: Function, rvPass: Function):

// from an AST, we generate the graph of compnodes
// we create an environment to store the identifiers and use the same node to refer.

function createGraph(parsedFn: { body: NodeType, params: Pattern[] }) {
  // We start evaluating the first binary expression

  // helpers to evaluate variables, binary combinations, and math functions

  // return reference to the final output node

}

export function _createGraphInternal(body: NodeType, incoming: GraphNode[], outgoing: GraphNode | null, ctxt: Context): Variable {
  let node;

  switch (body.type) {
    // same handler for Literal and Identifier
    case "Literal":
      node = Variable.fromLiteral((body as Literal).value as number, outgoing as GraphNode)
      break;

    case "Identifier":
      node = Variable.fromIdentifier(body as Identifier, outgoing as GraphNode);
      break;

    case "BinaryExpression":
      const comp = new CompNode()

      // evaluate left side and right side
      // connect left/right node's outgoing to compnode, and compnode's incoming to left/right node
      const leftNode = _createGraphInternal((body as BinaryExpression).left, [], comp, ctxt);
      const rightNode = _createGraphInternal((body as BinaryExpression).right, [], comp, ctxt);

      comp.incoming = [leftNode, rightNode]

      const operator = (body as BinaryExpression).operator;
      // bind computation and backward gradient functions to compnode
      const [computeFn, gradFn] = provideNodeFns(operator)
      comp.computeFn = computeFn;
      comp.gradFn = gradFn;

      // compNode result variable
      ctxt.ordering.push(comp);
      node = Variable.fromCompNode(comp); // output variable
      comp.outgoing = node
      break;

    default:
      throw new Error(`Unsupported node type: ${body.type}`);
  }

  ctxt.ordering.push(node);
  return node;
}

// TODO: fill values
// initialise an environment
// for each param, we store in environment
// This is still a forward pass, but we are using reverse mode.
// This simply calculates the gradient of the child node with respect to its inputs.
// It stores this partial derivative in the input nodes.

// given: topological ordering
export function fwdPass(context: Context) {
  if (Object.keys(context.env).length === 0)
    throw new Error("Environment is empty");
  _fwdPassInternal(0, context);
}

function _fwdPassInternal(cur: number, context: Context) {
  if (cur >= context.ordering.length) return;

  let node = context.ordering[cur];

  // calculates values for each node in the graph
  // calculate individual gradients per variable
  if (node instanceof Variable) {
    if (node.name)
      node.value = context.env[node.name] // get value from environment
  }

  else if (node instanceof CompNode) {
    const inputs = node.incoming as Variable[];
    const value = node.computeFn(inputs) // evaluate the compnode
    node.gradFn(inputs) // calculate gradients

    if (node.outgoing)
      (node.outgoing as Variable).value = value // set the value of the outgoing variable
    else
      throw new Error("CompNode has no outgoing variable to set value for");

  }

  else {
    throw new Error(`Unsupported node type in forward pass: ${node.constructor.name}`);
  }

  _fwdPassInternal(cur + 1, context)
}

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

function provideComputeFn(operator: string): (vs: Variable[]) => number {
  switch (operator) {
    case "*":
      return (vs) => vs[0].value * vs[1].value;
    case "+":
      return (vs) => vs[0].value + vs[1].value;
    case "**":
      return (vs) => vs[0].value ** vs[1].value;
    case "-":
      return (vs) => vs[0].value - vs[1].value;
    case "/":
      return (vs) => vs[0].value / vs[1].value;
    default:
      throw new Error(`Unsupported operator type: ${operator}`);
  }
}

function provideGradFn(operator: string): (vs: Variable[]) => void {
  switch (operator) {
    case "*":
      return (vs) => { vs[0].gradient = vs[1].value; vs[1].gradient = vs[0].value; }
    case "+":
      return (vs) => { vs[0].gradient = 1; vs[1].gradient = 1; }
    case "**":
      return (vs) => { vs[0].gradient = vs[1].value * vs[0].value ** (vs[1].value - 1); vs[1].gradient = Math.log(vs[0].value) * vs[0].value ** vs[1].value; }
    case "-":
      return (vs) => { vs[0].gradient = 1; vs[1].gradient = -1; }
    case "/":
      return (vs) => { vs[0].gradient = 1 / vs[1].value; vs[1].gradient = -vs[0].value / (vs[1].value ** 2); }
    default:
      throw new Error(`Unsupported operator type: ${operator}`);
  }
}

function provideNodeFns(operator: string): [NodeFns, NodeFns] {
  return [provideComputeFn(operator), provideGradFn(operator)];
}



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
