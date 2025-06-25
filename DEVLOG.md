## 24 Jun 2025 Part II
### Log
- Implemented reverse pass
- Use ordered pair [Variable, gradient] to represent incoming nodes for each compNode
- Use single reference for each input variable, implemented using a hash set which look for matching AST Identifier nodes and pointed to the correct value.

For creating graph
```ts
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
```

For forward pass
```ts
if (node.name && node.name in context.args) {
    node.value = context.args[node.name] // get value from environment
    delete context.args[node.name] // prevent repeated assignment
}
```

- Accumulating gradients on backward pass
  - We initialise each variable's gradientAcc at 0, except for output node. If two compute nodes/branches depend on the same variable, we sum into our gradientAcc.
  - Calculating the gradientAcc from computeNode edges to the variable, we multiply the elementary gradient by the previous gradient Acc (output of current computeNode)

`function _bwdPassInternal...`

```ts

// If node from compNode
if (node.incoming.length == 1 && node.incoming[0][0] instanceof CompNode) {
  const compNode = node.incoming[0][0];

  for (const [input, grad] of compNode.incoming) {
    const inputVariable = input as Variable
    inputVariable.gradientAcc += node.gradientAcc * grad // accumulate gradients backward

    _bwdPassInternal(inputVariable) // recursively for each input
  }
}
```

## 24 Jun 2025
### Log
- Implemented forward pass, calculating node values and individual gradients.
- Added backward pass, computing gradients for each node.
  - Missing features: doesn't use same variable node, so we end up with two separate gradients for the same variable.
    - i.e. there are two outgoing branches of the same variable node.
    - When we get this scenario, we combine the gradients by summing them (related to chain rule)

### Issues
  - TODO: Fix this by using the same variable node for both forward and backward passes. Use edges to store gradients, so that we can reuse the same variable node.
    - we can initialise the environment as variable names to references to actual initialised nodes.

  - ALT: Add tuple pairs for the incoming variables and their respective gradients. Store in compnode incoming
