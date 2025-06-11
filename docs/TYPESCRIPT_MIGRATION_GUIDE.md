# TypeScript Migration Guide for Modular Node.js Auth API

## 1. Introduction

This guide outlines the process, benefits, and considerations for migrating the existing JavaScript-based Modular Node.js Authentication API to TypeScript.

### Benefits of TypeScript

Migrating to TypeScript can bring several advantages to this project:

-   **Type Safety**: Catch errors during development and compilation rather than at runtime. This is crucial for an authentication module where security and reliability are paramount.
-   **Improved Developer Experience (DX)**: Better autocompletion, refactoring capabilities, and understanding of data structures through explicit types.
-   **Enhanced Code Quality and Maintainability**: Clearer contracts for functions and modules, making the codebase easier to understand, maintain, and extend.
-   **Scalability**: As the project grows, TypeScript helps manage complexity by enforcing structure and preventing common JavaScript pitfalls.
-   **Better Team Collaboration**: Types serve as a form of documentation, making it easier for developers to understand each other's code.

### Overall Strategy Options

1.  **Full Conversion (Big Bang)**:
    *   Convert the entire existing JavaScript codebase to TypeScript in one go.
    *   **Pros**: Consistent codebase from the start of the TS version.
    *   **Cons**: Can be time-consuming and disruptive for a larger project. Higher upfront effort.
2.  **Gradual Adoption (Incremental)**:
    *   Introduce TypeScript incrementally, converting module by module.
    *   **Pros**: Less disruptive, allows the team to learn and adapt gradually. Can start seeing benefits sooner in parts of the codebase.
    *   **Cons**: Mixed codebase (JS/TS) during transition, requires careful configuration to allow interoperability.
3.  **Parallel TypeScript Version**:
    *   Maintain the existing JS version and develop a new, separate TS version.
    *   **Pros**: No disruption to the existing JS version.
    *   **Cons**: Duplicates effort, maintenance overhead for two versions. Likely not suitable for this project unless it's a complete rewrite.

For this project, a **Gradual Adoption** strategy, potentially starting with new modules or by converting core services and utility modules first, is often recommended. However, this guide will primarily outline the steps for a **Full Conversion** as it covers all necessary aspects, which can then be adapted for a gradual approach.

## 2. Prerequisites & Setup

### A. Install Dependencies

Install TypeScript and necessary type definitions for existing libraries.

```bash
# Install TypeScript as a dev dependency
npm install --save-dev typescript

# Install type definitions for Node.js and core libraries
npm install --save-dev @types/node @types/express @types/passport @types/jsonwebtoken @types/js-yaml @types/supertest @types/jest @types/cors @types/helmet @types/express-rate-limit

# For specific Passport strategies (examples)
npm install --save-dev @types/passport-google-oauth20 @types/passport-facebook @types/passport-jwt

# For other dependencies like Joi (Joi has built-in types, but sometimes community types exist or are needed for specific uses)
# @types/joi might not be needed if Joi's own typings are sufficient.
```

### B. `tsconfig.json` Configuration

Create a `tsconfig.json` file in the project root. This file specifies compiler options.

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020", // Or newer, aligns with modern Node.js versions
    "module": "commonjs", // Matches current project structure
    "lib": ["ES2020", "DOM"], // Include DOM if any browser-like environments are ever targeted by utils, else minimal
    "rootDir": "./src", // Source directory for .ts files
    "outDir": "./dist", // Output directory for compiled .js files
    "esModuleInterop": true, // Enables compatibility with CommonJS modules
    "forceConsistentCasingInFileNames": true, // Best practice
    "strict": true, // Enables all strict type-checking options (recommended)
    "skipLibCheck": true, // Skip type checking of declaration files (speeds up compilation)
    "resolveJsonModule": true, // Allows importing JSON files
    "sourceMap": true, // Generate source maps for debugging
    "baseUrl": ".", // Base directory for module resolution
    "paths": { // Optional: for defining path aliases
      "@/*": ["src/*"]
    },
    // For gradual adoption, you might also use:
    // "allowJs": true, // Allow JavaScript files to be compiled
    // "checkJs": true, // Type-check JavaScript files using JSDoc
  },
  "include": [
    "src/**/*.ts" // Which files to include for compilation
  ],
  "exclude": [
    "node_modules",
    "tests", // Test files are typically handled by ts-jest or similar
    "dist"
  ]
}
```

### C. Build Process

TypeScript code needs to be compiled into JavaScript using the TypeScript compiler (`tsc`).

-   Add a build script to `package.json`:
    ```json
    "scripts": {
      // ...
      "build": "tsc",
      "build:watch": "tsc --watch"
      // ...
    }
    ```
-   Run `npm run build` to compile.

### D. Update `package.json` Scripts

Scripts for running the application will need to point to the compiled JavaScript files in `dist/`.

```json
// package.json
{
  "main": "dist/server.js", // Point to compiled server file
  "scripts": {
    "start": "node dist/server.js", // Run compiled code for production-like start
    "dev": "nodemon --watch src --exec ts-node src/server.ts", // Use ts-node for development (compiles on the fly)
    "build": "tsc",
    "lint": "eslint \"src/**/*.ts\"", // Update lint script for .ts files
    "format": "prettier --write \"src/**/*.{ts,js,json,md,yaml,yml}\"",
    "test": "jest --coverage --runInBand" // Jest will need ts-jest
    // ...
  }
}
```
-   **Development**: Using `ts-node` (install with `npm install --save-dev ts-node nodemon`) allows running TypeScript directly without explicit pre-compilation, which is convenient for development.
-   **Production**: `npm run build` first, then `npm start` runs the compiled JavaScript.

## 3. Key Migration Steps & Considerations (Full Conversion)

### A. File Renaming

-   Rename all `.js` files in `src/` to `.ts`.
-   Test files in `tests/` would also be renamed to `.ts`.

### B. Basic Typing

-   Start by adding explicit types to function parameters, return values, and variable declarations.
    -   Example: `function greet(name: string): string { return \`Hello, \${name}\`; }`
-   Use basic types: `string`, `number`, `boolean`, `Array<T>`, `object`.
-   Use `any` as a temporary escape hatch if a type is complex or unknown, but aim to replace it with a more specific type later.

### C. Interfaces and Types

-   Define `interface` or `type` aliases for all significant objects and data structures.
    -   **User Profile**: `interface UserProfile { id: string; email?: string | null; ... }`
    -   **JWT Payloads**: `interface AccessTokenPayload { sub: string; type: 'access'; ... }`
    -   **Configuration Objects**: `interface AppConfig { port: number; jwtSecret: string; ... }`
    -   **Service Method Signatures**: Clearly type parameters and return values of service methods.
    -   **Adapter Interface**: The `UserStoreAdapter` should be fully typed.

### D. Express Middleware & Route Handlers

-   Use types from `@types/express`:
    ```typescript
    import { Request, Response, NextFunction, Application } from 'express';

    app.get('/somepath', (req: Request, res: Response, next: NextFunction) => {
      // ...
    });
    ```
-   For more precise typing of `req.user`, `req.body`, `req.params`, `req.query`, you can use generics or extend Express's Request type.
    -   Example: `interface AuthenticatedRequest extends Request { user?: UserProfile; }`

### E. Passport Strategies

-   **Strategy Options**: Define an interface for the options passed to `configureStrategy` functions.
-   **Strategy Callbacks**: Type the parameters passed to Passport strategy callbacks:
    -   `accessToken: string`, `refreshToken: string | undefined`
    -   `profile: passport.Profile` (or more specific types from `@types/passport-google-oauth20`, etc.)
    -   `done: (error: any, user?: any, info?: any) => void`
-   Ensure the `configureStrategy` functions return `passport.Strategy`.

### F. Error Handling

-   Custom error classes can extend `Error` and include additional properties (e.g., `statusCode`).
-   Express error handling middleware parameters: `(err: any, req: Request, res: Response, next: NextFunction)` - type `err` more specifically if possible.

### G. Configuration Files (`config/index.js` -> `config/index.ts`)

-   Define an interface for the exported configuration object.
-   Joi validation can still be used. Joi's `validate` method can be typed to return a value conforming to your config interface.
    ```typescript
    interface AppConfig { /* ... */ }
    const { value: envVars, error } = envVarsSchema.validate(process.env);
    if (error) { /* ... */ }
    const config: AppConfig = { /* map from envVars */ };
    export default config;
    ```

### H. Mock User Store & Adapters

-   The `UserStoreAdapter` interface should be defined in TypeScript with fully typed methods.
-   `MockUserStore` and other adapter implementations (e.g., `MongoUserAdapter`) must implement this typed interface.
-   Internal data structures (like the `users` array in `MockUserStore`) should be typed.

### I. Services (`authService.ts`, `userService.ts`)

-   All service methods should have typed parameters and return types.
-   Interactions with the user store adapter will benefit from the typed interface.

### J. Environment Variables

-   Access to `process.env` variables should ideally go through the typed configuration object generated from `config/index.ts` to ensure type safety.

### K. Test Files

-   Rename test files to `.test.ts`.
-   Install and configure `ts-jest`: `npm install --save-dev ts-jest`.
-   Create or update `jest.config.js` (or use `package.json` `jest` section):
    ```javascript
    // jest.config.js
    module.exports = {
      preset: 'ts-jest',
      testEnvironment: 'node',
      // ... other Jest configurations ...
      collectCoverageFrom: [
        "src/**/*.ts", // Update glob patterns
        // ... exclusions ...
      ],
    };
    ```
-   Update mocks and test logic to align with TypeScript types.

## 4. Gradual Adoption Strategy (Alternative)

If a full conversion is too much at once:

-   **Enable `allowJs: true` and `checkJs: true` in `tsconfig.json`.**
    -   `allowJs`: Allows TypeScript to compile JavaScript files.
    -   `checkJs`: Enables type checking for JavaScript files based on JSDoc annotations or inference.
-   **Convert Module by Module**:
    -   Start with utility modules, then services, then adapters, then strategies/routes.
    -   Prioritize modules that would benefit most from type safety or are undergoing active development.
-   **Use JSDoc Type Annotations**:
    -   Add JSDoc comments with type information to existing `.js` files. TypeScript can understand these.
        ```javascript
        /**
         * @param {string} name
         * @returns {string}
         */
        function greet(name) {
          return `Hello, ${name}`;
        }
        ```
-   **Interoperability**: TypeScript and JavaScript modules can import each other if `esModuleInterop` and `allowJs` are correctly configured.

## 5. Folder Structure

-   **For Full Conversion or Gradual with `.ts` files:**
    -   Keep `.ts` files in `src/` (e.g., `src/app.ts`, `src/services/userService.ts`).
    -   Compiled output goes to `dist/` (e.g., `dist/app.js`, `dist/services/userService.js`).
    -   `rootDir: "./src"` and `outDir: "./dist"` in `tsconfig.json` manage this.
-   **Parallel Version (Not Recommended Here):**
    -   Could use `src-js/` and `src-ts/`, but this increases complexity significantly.

## 6. Challenges & Tips

-   **Third-Party Libraries**:
    -   Some JavaScript libraries might not have official or up-to-date type definitions (`@types/...`).
    -   You might need to create custom declaration files (`.d.ts`) for such libraries or use `any` judiciously.
-   **The `any` Trap**:
    -   While `any` is a useful escape hatch, overuse defeats the purpose of TypeScript. Aim to replace `any` with specific types as you understand the data structures better.
-   **Strict Mode (`"strict": true`)**:
    -   Enables options like `strictNullChecks`, `noImplicitAny`, etc. Highly recommended for new TS projects and beneficial for migrations if tackled systematically.
    -   Can be challenging initially, especially `strictNullChecks` (handling `null` and `undefined` explicitly).
-   **Build Times**: TypeScript compilation adds a build step, which can increase build times, especially for larger projects. Incremental builds (`tsc --watch`) and tools like `ts-node` for development help mitigate this.
-   **Learning Curve**: If the team is new to TypeScript, there will be a learning curve. Start with simpler modules and gradually increase complexity.
-   **ESLint and Prettier with TypeScript**:
    -   Use `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` for ESLint to understand TypeScript syntax.
    -   Update ESLint configuration (`.eslintrc.js` or `eslint.config.js`) accordingly.
    -   Prettier generally works well with TypeScript out of the box.

---

*Note: The Modular Node.js Authentication API project successfully underwent a TypeScript migration based on the principles outlined in this guide during its development leading up to version 1.0.0. This document remains a general reference for understanding the process and considerations involved in such a migration.*
