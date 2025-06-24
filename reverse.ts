// class that computational node info
// can we use the same forward pass?

import { Pattern, parse, Identifier, BinaryExpression, BlockStatement, ReturnStatement, Expression, ExpressionStatement, ArrowFunctionExpression, Function as FunctionType, Node as NodeType, Literal } from "acorn";
// import { MathExpression } from "./types";
// interface for primal/node/variable (value, gradient)
// If we can account for two tracks at the same time, that would be good

export interface Context {
  args: {[key: string]: number};
  inputs: {[key: string]: Variable};
  ordering: GraphNode[]
}

class GraphNode {
  public incoming: [GraphNode, number][]
  public outgoing: GraphNode | null
  constructor() {
    this.incoming = [];
    this.outgoing = null;
  };
}

export class Variable extends GraphNode {
  public gradientAcc: number
  constructor(
    public name: string | null,
    public value: number,
  ){
    super();
    this.gradientAcc = 0;
  }

  static fromLiteral(value: number, outgoing: GraphNode) {
    const node = new Variable(null, value)
    node.outgoing = outgoing;
    return node;
  }

  static fromIdentifier(identifier: Identifier, outgoing: GraphNode) {
    const node = new Variable(identifier.name, 0)
    node.outgoing = outgoing;
    return node;
  }

  static fromCompNode(compNode: CompNode) {
    const node = new Variable(null, 0);
    node.incoming = [[compNode, 1]];
    return node;
  }
}

export class CompNode extends GraphNode {
  public computeFn: (variables: Variable[]) => number;
  public gradFn: (variable: Variable[]) => number[]; // reverse

  constructor(
  ) {
    super();
    this.computeFn = () => 0;
    this.gradFn = () => [1, 1];
  }

}


export function makeGradFn(fn: (...params: any[]) => number): (...args: any[]) => Result {
  const { body, params } = _parseGivenFunction(fn)
  const argsOrder: string[] = params.map(p => (p as Identifier).name)
  const context = createGraph(body)

  return (...args: any) => {
    if (args.length !== argsOrder.length) {
      throw new Error(`Expected ${argsOrder.length} arguments, but got ${args.length}`);
    }

    context.args = Object.fromEntries(argsOrder.map((name, i) => [name, args[i]]))
    fwdPass(context)
    bwdPass(context)

    return {
      value: (context.ordering[context.ordering.length - 1] as Variable).value,
      gradients: argsOrder.map(name => context.inputs[name].gradientAcc)
    }
  }
}

// from an AST, we generate the graph of compnodes

function createGraph(parsedFn: NodeType): Context {
  const ctxt: Context = {
    args: {},
    inputs: {},
    ordering: []
  }

  _createGraphInternal(parsedFn, [], null, ctxt)

  // return context
  return ctxt
}

export function _createGraphInternal(body: NodeType, incoming: GraphNode[], outgoing: GraphNode | null, ctxt: Context): Variable {
  let node;

  switch (body.type) {
    // same handler for Literal and Identifier
    case "Literal":
      node = Variable.fromLiteral((body as Literal).value as number, outgoing as GraphNode)
      break;

    case "Identifier":
      const identifier = body as Identifier;

      if (!ctxt.inputs.hasOwnProperty(identifier.name)) {
        node = Variable.fromIdentifier(body as Identifier, outgoing as GraphNode);
        ctxt.inputs[identifier.name] = node;
      }
      else {
        node = ctxt.inputs[identifier.name] // already evaluated
        return node;
      }
      break;

    case "BinaryExpression":
      const comp = new CompNode()

      // evaluate left side and right side
      // connect left/right node's outgoing to compnode, and compnode's incoming to left/right node
      const leftNode = _createGraphInternal((body as BinaryExpression).left, [], comp, ctxt);
      const rightNode = _createGraphInternal((body as BinaryExpression).right, [], comp, ctxt);

      comp.incoming = [[leftNode, 1], [rightNode, 1]]

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
export function fwdPass(context: Context): Context {
  if (Object.keys(context.args).length === 0)
    throw new Error("Environment is empty");

  _fwdPassInternal(0, context);
  return context;
}

function _fwdPassInternal(cur: number, context: Context): void {
  if (cur >= context.ordering.length) return;

  let node = context.ordering[cur];

  // calculates values for each node in the graph
  // calculate individual gradients per variable
  if (node instanceof Variable) {
    node.gradientAcc = 0; // reset gradient accumulator
    if (node.name && node.name in context.args) {
      node.value = context.args[node.name] // get value from environment
      delete context.args[node.name] // prevent repeated assignment
    }
  }

  else if (node instanceof CompNode) {
    const inputs = node.incoming.map(([v, _]) => v) as Variable[];

    const value = node.computeFn(inputs) // evaluate the compnode
    // Run gradient function
    const grads = node.gradFn(inputs)
    // assign grads to incoming
    grads.forEach((grad, i) => {
      node.incoming[i][1] = grad;
    })

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

export function bwdPass(context: Context): Context {
  const outputNode = context.ordering[context.ordering.length - 1] as Variable;
  outputNode.gradientAcc = 1; // set the gradient accumulator for the output node to 1

  _bwdPassInternal(outputNode)
  return context;
}

function _bwdPassInternal(node: Variable): void {
  // If node from compNode
  if (node.incoming.length == 1 && node.incoming[0][0] instanceof CompNode) {
    const compNode = node.incoming[0][0];

    for (const [input, grad] of compNode.incoming) {
      const inputVariable = input as Variable
      inputVariable.gradientAcc += node.gradientAcc * grad // accumulate gradients backward

      _bwdPassInternal(inputVariable) // recursively for each input
    }
  }
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

/**
 * @description Provides the gradient function for a given operator.
 * @param operator The operator for which the gradient function is provided.
 * @returns The gradient function for the given operator which returns a pair of gradient values
 */
function provideGradFn(operator: string): (vs: Variable[]) => number[] {
  // the individual gradients (partial derivative ∂comp/∂left and ∂comp/∂right) are calculated by "swiching on and off" the other variable
  switch (operator) {
    case "*":
      return (vs) => [vs[1].value, vs[0].value];
    case "+":
      return (vs) => [1, 1];
    case "**":
      return (vs) => [vs[1].value * vs[0].value ** (vs[1].value - 1), Math.log(vs[0].value) * vs[0].value ** vs[1].value];
    case "-":
      return (vs) => [1, -1];
    case "/":
      return (vs) => [1 / vs[1].value, -vs[0].value / (vs[1].value ** 2)];
    default:
      throw new Error(`Unsupported operator type: ${operator}`);
  }
}

function provideNodeFns(operator: string) {
  return [provideComputeFn(operator), provideGradFn(operator)] as const;
}
