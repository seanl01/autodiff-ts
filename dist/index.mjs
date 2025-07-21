// lib/reverse.ts
import { parse } from "acorn";

// lib/classes.ts
var GraphNode = class {
  constructor() {
    this.incoming = [];
    this.outgoing = null;
  }
};
var Variable = class _Variable extends GraphNode {
  constructor(name, value) {
    super();
    this.name = name;
    this.value = value;
    this.gradientAcc = 0;
  }
  static fromLiteral(value, outgoing) {
    const node = new _Variable(null, value);
    node.outgoing = outgoing;
    return node;
  }
  static fromIdentifier(identifier, outgoing) {
    const node = new _Variable(identifier.name, 0);
    node.outgoing = outgoing;
    return node;
  }
  static fromCompNode(compNode) {
    const node = new _Variable(null, 0);
    node.incoming = [[compNode, 1]];
    return node;
  }
};
var CompNode = class extends GraphNode {
  // backward
  constructor() {
    super();
    this.computeFn = () => 0;
    this.gradFn = () => [1, 1];
  }
};

// lib/nodeFns.ts
function provideFn(operator, store) {
  if (operator in store)
    return store[operator];
  throw new Error(`Unsupported operator type: ${operator}`);
}
var mathOperators = {
  "*": (vs) => vs[0].value * vs[1].value,
  "+": (vs) => vs[0].value + vs[1].value,
  "**": (vs) => vs[0].value ** vs[1].value,
  "-": (vs) => vs[0].value - vs[1].value,
  "/": (vs) => vs[0].value / vs[1].value
};
var mathFns = {
  "pow": (vs) => Math.pow(vs[0].value, vs[1].value),
  "sin": (vs) => Math.sin(vs[0].value),
  "cos": (vs) => Math.cos(vs[0].value),
  "tan": (vs) => Math.tan(vs[0].value),
  "log": (vs) => Math.log(vs[0].value),
  "exp": (vs) => Math.exp(vs[0].value)
};
var gradOperators = {
  "*": (vs) => [vs[1].value, vs[0].value],
  "+": (vs) => [1, 1],
  "**": (vs) => [vs[1].value * vs[0].value ** (vs[1].value - 1), Math.log(vs[0].value) * vs[0].value ** vs[1].value],
  "-": (vs) => [1, -1],
  "/": (vs) => [1 / vs[1].value, -vs[0].value / vs[1].value ** 2]
};
var gradMathFns = {
  "pow": (vs) => [vs[1].value * vs[0].value ** (vs[1].value - 1), Math.log(vs[0].value) * vs[0].value ** vs[1].value],
  "sin": (vs) => [Math.cos(vs[0].value)],
  "cos": (vs) => [-Math.sin(vs[0].value)],
  "tan": (vs) => [1 / Math.cos(vs[0].value) ** 2],
  "log": (vs) => [1 / vs[0].value],
  "exp": (vs) => [Math.exp(vs[0].value)]
};
var computeFns = { ...mathOperators, ...mathFns };
var gradFns = { ...gradOperators, ...gradMathFns };
function provideNodeFns(operator) {
  return [provideFn(operator, computeFns), provideFn(operator, gradFns)];
}

// lib/reverse.ts
function makeGradFn(fn) {
  const { body, params } = parseGivenFunction(fn);
  const argsOrder = params.map((p) => p.name);
  const ctxt = createGraph(body);
  return (...args) => {
    if (args.length !== argsOrder.length) {
      throw new Error(`Expected ${argsOrder.length} arguments, but got ${args.length}`);
    }
    ctxt.args = Object.fromEntries(argsOrder.map((name, i) => [name, args[i]]));
    fwdPass(ctxt);
    bwdPass(ctxt);
    const value = ctxt.ordering[ctxt.ordering.length - 1].value;
    const gradients = argsOrder.map((name) => ctxt.inputs[name].gradientAcc);
    return { value, gradients };
  };
}
function createGraph(parsedFn) {
  const ctxt = {
    args: {},
    inputs: {},
    ordering: []
  };
  _createGraphInternal(parsedFn, [], null, ctxt);
  return ctxt;
}
function _createGraphInternal(body, incoming, outgoing, ctxt) {
  let node;
  switch (body.type) {
    case "Literal":
      node = Variable.fromLiteral(body.value, outgoing);
      break;
    case "Identifier":
      const identifier = body;
      if (!ctxt.inputs.hasOwnProperty(identifier.name)) {
        node = Variable.fromIdentifier(body, outgoing);
        ctxt.inputs[identifier.name] = node;
      } else {
        node = ctxt.inputs[identifier.name];
        return node;
      }
      break;
    case "BinaryExpression":
      const { left, right, operator } = body;
      node = addCompNode([left, right], operator, ctxt);
      break;
    case "CallExpression":
      node = _encodeCallExpression(body, [], null, ctxt);
      break;
    default:
      throw new Error(`Unsupported node type: ${body.type}`);
  }
  ctxt.ordering.push(node);
  return node;
}
function addCompNode(inputs, operator, ctxt) {
  const comp = new CompNode();
  const inputNodes = inputs.map((input) => [_createGraphInternal(input, [], comp, ctxt), 1]);
  comp.incoming = inputNodes;
  const [computeFn, gradFn] = provideNodeFns(operator);
  comp.computeFn = computeFn;
  comp.gradFn = gradFn;
  ctxt.ordering.push(comp);
  const node = Variable.fromCompNode(comp);
  comp.outgoing = node;
  return node;
}
function _encodeCallExpression(expr, incoming, outgoing, ctxt) {
  const callee = expr.callee;
  switch (callee.type) {
    case "MemberExpression":
      if (callee.object.type === "Identifier" && callee.object.name === "Math") {
        const mathExpr = expr;
        return addCompNode(mathExpr.arguments, mathExpr.callee.property.name, ctxt);
      }
    default:
      throw new Error(`Unsupported callee type: ${callee.type}`);
  }
}
function fwdPass(ctxt) {
  if (Object.keys(ctxt.args).length === 0)
    throw new Error("Environment is empty");
  for (const node of ctxt.ordering) {
    _passNode(node, ctxt);
  }
  return ctxt;
}
function _passNode(node, ctxt) {
  if (node instanceof Variable) {
    node.gradientAcc = 0;
    if (node.name && node.name in ctxt.args) {
      node.value = ctxt.args[node.name];
      delete ctxt.args[node.name];
    }
  } else if (node instanceof CompNode) {
    const inputs = node.incoming.map(([v, _]) => v);
    const value = node.computeFn(inputs);
    const grads = node.gradFn(inputs);
    grads.forEach((grad, i) => {
      node.incoming[i][1] = grad;
    });
    if (node.outgoing)
      node.outgoing.value = value;
    else
      throw new Error("CompNode has no outgoing variable to set value for");
  } else {
    throw new Error(`Unsupported node type in forward pass: ${node.constructor.name}`);
  }
}
function bwdPass(ctxt) {
  const outputNode = ctxt.ordering[ctxt.ordering.length - 1];
  outputNode.gradientAcc = 1;
  _bwdPassInternal(outputNode);
  return ctxt;
}
function _bwdPassInternal(node) {
  if (node.incoming.length == 1 && node.incoming[0][0] instanceof CompNode) {
    const compNode = node.incoming[0][0];
    for (const [input, grad] of compNode.incoming) {
      const inputVariable = input;
      inputVariable.gradientAcc += node.gradientAcc * grad;
      _bwdPassInternal(inputVariable);
    }
  }
}
function parseGivenFunction(fn) {
  let funcExpr = parse(fn.toString(), { ecmaVersion: 7 }).body[0];
  let func;
  if (funcExpr.type === "FunctionDeclaration") {
    if (funcExpr.body instanceof Array)
      throw new Error("Function contains more than just return statement");
    if (funcExpr.body.body[0].type !== "ReturnStatement")
      throw new Error("Function contains more than just return statement");
    func = funcExpr;
    func.body = func.body.body[0].argument;
  } else if (funcExpr.expression.type === "ArrowFunctionExpression") {
    func = funcExpr.expression;
  } else {
    throw new Error("Invalid function expression");
  }
  const { body, params } = func;
  return { body, params };
}

// lib/forward.ts
import {
  parse as parse2
} from "acorn";
function fwdMakeGradFn_unstable(fn) {
  const { body, params } = _evalPassedFunction(fn);
  return (...args) => {
    let value = null;
    const gradients = [];
    const table = _initTable(params, args);
    params.forEach((p, _) => {
      p = p;
      const tableCopy = structuredClone(table);
      const origVal = table[p.name][0];
      tableCopy[p.name] = [origVal, 1];
      const [lastPrimalIdx] = fwdPass2(body, tableCopy, 0);
      console.log("last", lastPrimalIdx);
      console.log("table", tableCopy);
      if (value === null)
        value = tableCopy[lastPrimalIdx][0];
      gradients.push(tableCopy[lastPrimalIdx][1]);
    });
    if (value === null)
      throw new Error("Invalid value");
    return { value, gradients };
  };
}
function _evalPassedFunction(fn) {
  let funcExpr = parse2(fn.toString(), { ecmaVersion: 7 }).body[0];
  let func;
  if (funcExpr.type === "FunctionDeclaration") {
    if (funcExpr.body instanceof Array)
      throw new Error("Function contains more than just return statement");
    if (funcExpr.body.body[0].type !== "ReturnStatement")
      throw new Error("Function contains more than just return statement");
    func = funcExpr;
    func.body = func.body.body[0].argument;
  } else if (funcExpr.expression.type === "ArrowFunctionExpression") {
    func = funcExpr.expression;
  } else {
    throw new Error("Invalid function expression");
  }
  const { body, params } = func;
  return { body, params };
}
function _initTable(params, args) {
  const table = {};
  params.forEach((p, idx) => {
    p = p;
    table[p.name] = [args[idx], 0];
  });
  return table;
}
function fwdPass2(body, table, counter) {
  switch (body.type) {
    // every step: store primal values, return reference
    // new value: use counter as key, then increment counter
    case "CallExpression":
      return _evalCallExpr(body, table, counter);
    case "BinaryExpression":
      console.log("Binary Expression!");
      const first = fwdPass2(body.left, table, counter);
      counter = first[1];
      let firstVal = table[first[0]][0];
      let firstDer = table[first[0]][1];
      const second = fwdPass2(body.right, table, counter);
      counter = second[1];
      let secondVal = table[second[0]][0];
      let secondDer = table[second[0]][1];
      const [res, der] = _binCombine([firstVal, firstDer], body.operator, [secondVal, secondDer]);
      table[counter] = [res, der];
      return [counter, counter + 1];
    case "Literal":
      const val = body.value;
      table[counter] = [val, 0];
      return [counter, counter + 1];
    case "Identifier":
      return [body.name, counter];
  }
  throw new Error("Invalid construct");
}
function _evalCallExpr(expr, table, counter) {
  const callee = expr.callee;
  if (callee.type === "MemberExpression") {
    if (callee.object.type === "Identifier" && callee.object.name === "Math")
      return _evalMathExpr(expr, table, counter);
  }
  throw new Error("Call expression not supported");
}
function _evalMathExpr(expr, table, counter) {
  const args = expr.arguments;
  let key;
  [key, counter] = fwdPass2(args[0], table, counter);
  let [val, der] = [table[key][0], table[key][1]];
  switch (expr.callee.property.name) {
    case "log":
      table[counter] = [Math.log(val), 1 / val * der];
      break;
    case "sin":
      table[counter] = [Math.sin(val), Math.cos(val) * der];
      break;
    case "sqrt":
      table[counter] = _binCombine([val, der], "**", [1 / 2, 0]);
      break;
    case "pow":
      [key, counter] = fwdPass2(args[1], table, counter);
      let [rightVal, rightDer] = table[key];
      table[counter] = _binCombine([val, der], "**", [rightVal, rightDer]);
      break;
    default:
      throw new Error(`Unsupported math function: ${expr.callee.property.name.toString()}`);
  }
  console.log("table[counter]", table[counter]);
  console.log("table", table);
  return [counter, counter + 1];
}
function _binCombine(left, operator, right) {
  const [leftVal, leftDer] = left;
  const [rightVal, rightDer] = right;
  let [val, der] = [0, 0];
  switch (operator) {
    case "*":
      val = leftVal * rightVal;
      der = leftVal * rightDer + rightVal * leftDer;
      break;
    case "+":
      val = leftVal + rightVal;
      der = leftDer + rightDer;
      break;
    case "**":
      val = leftVal ** rightVal;
      der = rightVal * Math.pow(leftVal, rightVal - 1) * (leftDer + Math.pow(leftVal, rightVal) * Math.log(leftVal) * rightDer);
      break;
    case "-":
      val = leftVal - rightVal;
      der = leftDer - rightDer;
      break;
    default:
      throw new Error(`Unsupported binary operator: ${operator}`);
  }
  return [val, der];
}
export {
  makeGradFn as default,
  fwdMakeGradFn_unstable
};
