import { Identifier, MemberExpression, CallExpression } from 'acorn';

// Contains initial args and subsequent primal values.
export type Table = { [key: string | number]: [number, number] }

// export type Environment = {
//   variables: { [key: string]: [number, number] }
//   table: Table
// }

export type MathFunction = Omit<Identifier, 'name'> & {
  name: keyof Math
}

export type MathExpression = Omit<CallExpression, 'callee'> & {
  callee: Omit<MemberExpression, 'property'> & {
    property: MathFunction
  }
}
