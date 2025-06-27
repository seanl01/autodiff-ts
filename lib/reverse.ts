import { Pattern, parse, Identifier, BinaryExpression, BlockStatement, ReturnStatement, Expression, ExpressionStatement, ArrowFunctionExpression, Function as FunctionType, Node as NodeType, Literal, CallExpression, MemberExpression } from "acorn";
import { Variable, CompNode, GraphNode } from "./classes";
import { MathExpression, Result } from "./types";
import { provideNodeFns } from "./nodeFns";

export interface Context {
  args: { [key: string]: number };
  inputs: { [key: string]: Variable };
  ordering: GraphNode[]
}


/**
 * Creates a gradient function for a given function.
 * @param fn - function to create gradient function for
 * @returns a function that takes arguments and returns the value and gradients
 */
export function makeGradFn(fn: (...params: any[]) => number): (...args: any[]) => Result {
  const { body, params } = parseGivenFunction(fn)
  const argsOrder: string[] = params.map(p => (p as Identifier).name)
  const ctxt = createGraph(body)

  return (...args: any) => {
    if (args.length !== argsOrder.length) {
      throw new Error(`Expected ${argsOrder.length} arguments, but got ${args.length}`);
    }

    ctxt.args = Object.fromEntries(argsOrder.map((name, i) => [name, args[i]]))
    fwdPass(ctxt)
    bwdPass(ctxt)

    const value = (ctxt.ordering[ctxt.ordering.length - 1] as Variable).value
    const gradients = argsOrder.map(name => ctxt.inputs[name].gradientAcc)

    return { value, gradients }
  }
}


/**
 * From an AST, we generate the graph of variables and CompNodes
 * @param parsedFn - the parsed function body
 * @returns a context objecting containing the graph structure and inputs
 */
function createGraph(parsedFn: NodeType): Context {
  const ctxt: Context = {
    args: {},
    inputs: {},
    ordering: []
  }

  _createGraphInternal(parsedFn, [], null, ctxt)

  return ctxt
}

export function _createGraphInternal(body: NodeType, incoming: GraphNode[], outgoing: GraphNode | null, ctxt: Context): Variable {
  let node;

  switch (body.type) {
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
      const { left, right, operator } = body as BinaryExpression;
      node = addCompNode([left, right], operator, ctxt)
      break;

    case "CallExpression":
      node = _encodeCallExpression(body as CallExpression, [], null, ctxt)
      break;

    default:
      throw new Error(`Unsupported node type: ${body.type}`);
  }

  ctxt.ordering.push(node);
  return node;
}


/**
 * Adds a computation node to the graph.
 * @param inputs - the input nodes to the computation
 * @param operator - the operator for the computation (e.g., "+", "*", "sin", etc.)
 * @param ctxt - the context containing the graph structure and inputs
 * @returns a Variable representing the output of the computation
 */
function addCompNode(inputs: NodeType[], operator: string, ctxt: Context): Variable {
  const comp = new CompNode();
  const inputNodes: [GraphNode, number][] = inputs.map(input => [_createGraphInternal(input, [], comp, ctxt), 1])

  comp.incoming = inputNodes

  // bind computation and backward gradient functions to compnode
  const [computeFn, gradFn] = provideNodeFns(operator)
  comp.computeFn = computeFn;
  comp.gradFn = gradFn;

  // compNode result variable
  ctxt.ordering.push(comp);
  const node = Variable.fromCompNode(comp); // output variable
  comp.outgoing = node

  return node
}


/**
 * Places the call expression into the graph.
 * @param expr - the CallExpression to encode
 * @param incoming - the incoming graph nodes
 * @param outgoing - the outgoing graph node (if any)
 * @param ctxt - the context object for the graph
 * @returns a Variable representing the result of the call expression
 */
function _encodeCallExpression(expr: CallExpression, incoming: GraphNode[], outgoing: GraphNode | null, ctxt: Context): Variable {
  const callee = expr.callee
  switch (callee.type) {
    case "MemberExpression":
      if (callee.object.type === "Identifier" && callee.object.name === "Math") {
        const mathExpr = expr as MathExpression
        return addCompNode(mathExpr.arguments, mathExpr.callee.property.name as string, ctxt)
      }

    default:
      throw new Error(`Unsupported callee type: ${callee.type}`);
  }
}

/**
 * Performs a forward pass through the graph, evaluating nodes in topological order.
 * @param ctxt
 * @returns context object
 */
export function fwdPass(ctxt: Context): Context {
  if (Object.keys(ctxt.args).length === 0)
    throw new Error("Environment is empty");

  _fwdPassInternal(0, ctxt);
  return ctxt;
}

function _fwdPassInternal(cur: number, ctxt: Context): void {
  if (cur >= ctxt.ordering.length) return;

  let node = ctxt.ordering[cur];

  // calculates values for each node in the graph
  // then calculate elementary gradients for each variable-compnode

  if (node instanceof Variable) {
    node.gradientAcc = 0; // reset gradient accumulator
    if (node.name && node.name in ctxt.args) {
      node.value = ctxt.args[node.name] // get value from environment
      delete ctxt.args[node.name] // prevent repeated assignment
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

  _fwdPassInternal(cur + 1, ctxt)
}

/**
 * Performs a backward pass through the graph, accumulating gradients in reverse topological order.
 * @param ctxt - Context object
 * @returns Context object
 */
export function bwdPass(ctxt: Context): Context {
  const outputNode = ctxt.ordering[ctxt.ordering.length - 1] as Variable;
  outputNode.gradientAcc = 1; // set the gradient accumulator for the output node to 1

  _bwdPassInternal(outputNode)
  return ctxt;
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

/**
 * Parses the given function into an AST and extracts the body and parameters.
 * @param fn - a function to parse into an AST
 * @returns an object containing the function body and parameters
 */
export function parseGivenFunction(fn: (...args: any[]) => number): { body: NodeType, params: Pattern[] } {
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
