# autodiff-ts 📈

## Overview
autodiff-ts is a TypeScript library for automatic differentiation. It provides a set of functions for computing the derivative of a mathematical expression with respect to a variable.

Automatic differentiation (TODO: add citation) is a technique for computationally determining the gradient of a function with respect to its inputs, for a certain point. It strikes a balance between the precision of symbolic differentiation and the efficiency of numerical differentiation.

## Installation and Usage

```
npm install https://github.com/seanl01/autodiff-ts.git#public
```

```js
import { makeGradFn } from "autodiff-ts"

const grad = makeGradFn((x, y) => x + y ** 2)

```

## Limitations and future work.
- Currently it only supports functions that accept scalars and not vectors
- Currently no memoisation on the primals calculated is being done. These optimisations are central to the appeal of automatic differentiation.
