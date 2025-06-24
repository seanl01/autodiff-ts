### 24 Jun 2025
- Implemented forward pass, calculating node values and individual gradients.
- Added backward pass, computing gradients for each node.
  - Missing features: doesn't use same variable node, so we end up with two separate gradients for the same variable.
    - i.e. there are two outgoing branches of the same variable node.
    - When we get this scenario, we combine the gradients by summing them (related to chain rule)
  - TODO: Fix this by using the same variable node for both forward and backward passes. Use edges to store gradients, so that we can reuse the same variable node.
  - ALT: Add tuple pairs for the incoming variables and their respective gradients.
    - we can initialise the environment as variable names to references to actual initialised nodes.
