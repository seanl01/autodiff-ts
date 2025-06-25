import { Identifier } from "acorn";
import { Fn } from "./types";

export class GraphNode {
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
  ) {
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
  public computeFn: Fn<number>; // forward
  public gradFn: Fn<number[]>; // backward

  constructor(
  ) {
    super();
    this.computeFn = () => 0;
    this.gradFn = () => [1, 1];
  }

}
