# Modular Node.js Authentication API (TypeScript Edition)

## Overview

This project provides a robust and modular authentication API built with **TypeScript**, Node.js, Express, and Passport.js. It supports JWT (JSON Web Token) based authentication, including **access and refresh tokens**, for protecting API endpoints. It features OAuth 2.0 integration for providers like Google, Facebook, and GitHub, made easily extensible. The primary goal is to offer a secure, maintainable, type-safe, and extensible authentication solution.

The API allows users to authenticate via third-party OAuth providers. Upon successful authentication, an **access token (short-lived) and a refresh token (long-lived)** are issued. The access token is used to access protected resources (e.g., `/auth/profile`). The refresh token can be used to obtain a new access token without requiring the user to log in again. A logout endpoint is provided to invalidate refresh tokens.

## Features

-   **TypeScript Codebase**: Entirely written in TypeScript for type safety, improved DX, and scalability.
-   **JWT-based Authentication**:
    -   Secure API endpoints using JSON Web Tokens.
    -   **Access Tokens**: Short-lived tokens for accessing protected resources (`type: 'access'`).
    -   **Refresh Tokens**: Long-lived tokens for obtaining new access tokens (`type: 'refresh'`), with server-side validation and rolling mechanism.
    -   **Logout**: Endpoint (`POST /auth/logout`) to invalidate refresh tokens.
-   **OAuth 2.0 Integration**:
    -   Google Sign-In
    -   Facebook Login
    -   GitHub Login
    -   **Pluggable OAuth Providers**: Easily add new OAuth providers with minimal code changes through configuration.
-   **Architectural Enhancements**:
    -   **Service Layer**: Business logic separated into `authService.ts` and `userService.ts`.
    -   **User Store Abstraction**: `UserStoreAdapter.ts` interface allows for different database backends.
        -   Current Implementations: In-Memory (`MockUserStore.ts`), MongoDB (`MongoUserAdapter.ts` with Mongoose), PostgreSQL (`PostgresUserAdapter.ts` with pg driver).
        -   Easily switchable via `USER_STORE_TYPE` environment variable.
    -   **Role-Based Access Control (RBAC)**: Basic foundation for role checking via `checkRoles` middleware. Default role 'user' assigned on creation. Example admin-only route.
    -   **Two-Factor Authentication (2FA) Design**: Design and stubs for TOTP-based 2FA are in place (see `docs/TWO_FACTOR_AUTHENTICATION.md`). Full implementation is pending.
-   **Security Enhancements**:
    -   **Helmet**: Protection against common web vulnerabilities by setting various HTTP headers.
    -   **CORS**: Configurable Cross-Origin Resource Sharing policy via `CORS_ALLOWED_ORIGINS`.
    -   **Rate Limiting**: Protection against brute-force attacks on authentication routes (`/auth/*`).
    -   **Environment Variable Validation**: Ensures critical configurations are present and valid at startup using Joi.
-   **Production Readiness & Observability**:
    *   **Logging**: Structured and configurable logging using Winston (dev: pretty console, prod: JSON; level configurable via `LOG_LEVEL`).
    *   **Health Endpoint**: `GET /health` for uptime and basic status monitoring.
    *   **Graceful Shutdown**: Handles `SIGINT` and `SIGTERM` signals to shut down the server and database connections gracefully.
-   **API Documentation**:
    *   **Swagger UI**: Interactive API documentation served at `/api-docs` from `docs/openapi.yaml`.
    *   **OpenAPI Specification**: `docs/openapi.yaml` updated with new endpoints and refined schemas.
-   **Developer Experience**:
    *   **TypeScript**: Strong typing and modern JavaScript features.
    *   **Path Aliases**: For cleaner imports (e.g., `@src`, `@config`, `@services`).
    *   **Comprehensive `README.md` and `CHANGELOG.md`**.
    *   **Initial `TYPESCRIPT_MIGRATION_GUIDE.md`** (now completed).
    *   **Postman Collection**: `docs/AuthModule-PostmanCollection.json` provided.
-   **Testing**:
    *   Unit and integration tests using Jest and Supertest, written in TypeScript.
    *   Mock OAuth servers (`Google`, `Facebook`, `GitHub`) for isolated end-to-end testing of OAuth flows.
    *   Code coverage reporting configured (though execution may face issues in some specific sandbox environments).
-   **Code Quality**:
    *   Prettier for code formatting.
    *   ESLint for linting with TypeScript support (configured, though execution may face issues in some specific sandbox environments).
    *   Husky and lint-staged for pre-commit hooks (currently focused on Prettier).

## Prerequisites

-   [Node.js](https://nodejs.org/) (version 18.x or later recommended).
-   [npm](https://www.npmjs.com/) (usually comes with Node.js).
-   **TypeScript**: Project is written in TypeScript. `ts-node` is used for development.
-   [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) (Optional, for containerized deployment).
-   Database: MongoDB or PostgreSQL server if using respective adapters.
-   Access to OAuth provider developer consoles (Google, Facebook, GitHub) for client credentials.

## Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd <repository_name>
    ```

2.  **Initial Setup (Recommended):**
    Use the setup script to install dependencies and create your initial `.env` file.
    ```bash
    npm run setup
    ```
    This script will:
    *   Install all necessary npm dependencies.
    *   Copy `.env.example` to `.env` if `.env` doesn't already exist.

3.  **Configure Environment Variables:**
    Open `.env` and fill in required values. Key variables include `JWT_SECRET`, OAuth credentials for enabled providers, `USER_STORE_TYPE`, and database URIs if not using 'mock' store. See "Environment Variables Configuration" below.

4.  **Build (for production or if not using `ts-node` for dev):**
    The project uses TypeScript and needs to be compiled to JavaScript for production.
    ```bash
    npm run build
    ```
    This compiles TypeScript files from `src/` and `config/` to the `dist/` directory.

## Environment Variables Configuration

Refer to `.env.example` for a full list. Key variables:

-   `NODE_ENV`: `development`, `production`, `test`. Default: `development`.
-   `PORT`: Server port. Default: `3000`.
-   `LOG_LEVEL`: Logging level (e.g., `info`, `debug`). Default: `info`.
-   `JWT_SECRET`: **Required (min 32 chars)**. For signing JWTs.
-   `REFRESH_TOKEN_EXPIRATION_SECONDS`: For refresh tokens. Default: `604800` (7 days).
-   `CORS_ALLOWED_ORIGINS`: Comma-separated origins. Default: `http://localhost:3001`.
-   `USER_STORE_TYPE`: Storage adapter (`mock`, `mongodb`, `postgres`). Default: `mock`.
-   `MONGO_URI`: Required if `USER_STORE_TYPE=mongodb`.
-   `POSTGRES_URI`: Required if `USER_STORE_TYPE=postgres`.
-   `APP_NAME`: Application name (e.g., for User-Agent headers). Default: `Node.js Auth Module`.

**OAuth Provider Credentials & URLs (Required if provider is enabled):**
-   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
-   `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`
-   `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
-   Provider-specific OAuth endpoint URLs (e.g., `GOOGLE_AUTHORIZATION_URL`, etc.) can be overridden for testing or special configurations (defaults provided).

**Important**: Joi validation at startup checks for required variables based on `NODE_ENV` and `USER_STORE_TYPE`.

## How the OAuth Flow Works

(This section remains largely the same but implies the system is more robust and configurable now.)
... The API uses Passport.js, with strategies dynamically configured from `config/index.ts`. User data is handled by `userService.ts` (via a `UserStoreAdapter`), and tokens by `authService.ts`. ...

## Running the Application

### Locally
-   **Development (with `ts-node` and `nodemon` for live reloading):**
    ```bash
    npm run dev
    ```
    This runs `src/server.ts` directly.
-   **Production (after building with `npm run build`):**
    ```bash
    npm start
    ```
    This runs `node dist/server.js`.

### With Docker (Optional)
... (Docker instructions remain similar, ensure `Dockerfile` copies `dist/` or builds TS code) ...

## Running Tests

Tests are written in TypeScript and located in `tests/`. They use Jest with `ts-jest`.
```bash
npm test
```
This command now includes coverage generation. Mock OAuth servers are used for testing OAuth flows.
**Note on Testing Environment**: Refer to "Important Note on Testing in Specific Sandbox Environments" below if you encounter "Cannot find module" errors.

## API Endpoints Overview

Interactive API documentation via Swagger UI at `GET /api-docs`.

-   **`GET /`**: Welcome message.
-   **`GET /health`**: Health check.
-   **`GET /api-docs`**: Swagger UI.

**Authentication Endpoints (`/auth` prefix):**
-   **`GET /auth/:providerName`** (e.g., `/google`, `/facebook`, `/github`): Initiate OAuth flow.
-   **`GET /auth/:providerName/callback`**: Handles OAuth callback.
-   **`POST /auth/refresh`**: Renews tokens. Body: `{ "refreshToken": "..." }`.
-   **`POST /auth/logout`**: Invalidates refresh token. Body: `{ "refreshToken": "..." }`.
-   **`GET /auth/profile`**: Protected. Gets user profile. Requires Bearer `accessToken`.
-   **`GET /auth/admin/dashboard`**: Example admin route. Requires 'admin' role.
-   **`GET /auth/login-failure`**: OAuth failure redirect.
-   **2FA Endpoints (Stubs - Not Fully Implemented):**
    -   `POST /auth/2fa/setup`: Initiates 2FA setup for the authenticated user.
    -   `POST /auth/2fa/verify`: Verifies a TOTP token.
    -   `POST /auth/2fa/disable`: Disables 2FA for the authenticated user.

## Generating and Using Tokens
(This section remains largely the same.)
...

## Code Quality & Linting

-   **TypeScript**: Core language, type checking via `tsc`.
-   **Prettier**: Code formatting (`.prettierrc.js`).
-   **ESLint**: Static analysis (`.eslintrc.js` with TypeScript plugins).
-   **Husky & lint-staged**: Pre-commit hooks (currently primarily for Prettier).
-   **Manual Scripts**:
    ```bash
    npm run build     # Compile TypeScript & check types
    npm run format    # Apply Prettier
    npm run lint      # Run ESLint (see note on testing environment - currently may fail)
    ```

## Extensibility
(This section remains largely the same but updated for TypeScript context.)
... `myNewProviderStrategy.ts` ... `configureStrategy(options: ProviderOptions, services: AppServices)` ...
... `myDbAdapter.ts` ... extends `UserStoreAdapter` ...
    ```typescript
    // Example in a service file (or ideally a central DI setup):
    // import MyDbAdapter from '../adapters/myDbAdapter';
    // const userStore: UserStoreAdapter = new MyDbAdapter();
    ```

---
This README provides a comprehensive guide...

---

## Important Note on Testing in Specific Sandbox Environments
(This section remains the same.)
...

---

## Important Note on Testing and Linting in Specific Sandbox Environments
(Title slightly adjusted for clarity)
(This section remains the same.)
...
