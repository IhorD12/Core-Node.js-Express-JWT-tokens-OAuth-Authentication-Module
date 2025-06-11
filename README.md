# Modular Node.js Authentication API

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Installation & Setup](#installation--setup)
- [Environment Variables Configuration](#environment-variables-configuration)
- [How the OAuth Flow Works](#how-the-oauth-flow-works)
- [Running the Application](#running-the-application)
- [Running Tests](#running-tests)
- [Generating New Tokens](#generating-new-tokens)
- [API Endpoints Overview](#api-endpoints-overview)
- [OpenAPI Specification](#openapi-specification)
- [Error Handling](#error-handling)
- [Mock User Store](#mock-user-store)
- [Contributing](#contributing)
- [License](#license)

## Overview

This project provides a robust and modular authentication API built with Node.js, Express, and Passport.js. It supports JWT (JSON Web Token) based authentication, including **access and refresh tokens**, for protecting API endpoints. It features OAuth 2.0 integration for providers like Google and Facebook, made easily extensible. The primary goal is to offer a secure, maintainable, and extensible authentication solution.

The API allows users to authenticate via third-party OAuth providers. Upon successful authentication, an **access token (short-lived) and a refresh token (long-lived)** are issued. The access token is used to access protected resources (e.g., `/auth/profile`). The refresh token can be used to obtain a new access token without requiring the user to log in again. A logout endpoint is provided to invalidate refresh tokens.

## Features

 feat/initial-auth-system
-   **JWT-based Authentication**:
    -   Secure API endpoints using JSON Web Tokens.
    -   **Access Tokens**: Short-lived tokens for accessing protected resources.
    -   **Refresh Tokens**: Long-lived tokens for obtaining new access tokens, with server-side validation and rolling mechanism.
    -   **Logout**: Endpoint to invalidate refresh tokens.
-   **OAuth 2.0 Integration**:
    -   Google Sign-In
    -   Facebook Login
    -   **Pluggable OAuth Providers**: Easily add new OAuth providers with minimal code changes.
-   **Architectural Enhancements**:
    -   **Service Layer**: Business logic separated into `authService.js` and `userService.js`.
    -   **User Store Abstraction**: `UserStoreAdapter` interface allows for different database backends (current implementation: In-Memory Mock Store).
-   **Security Enhancements**:
    -   **Helmet**: Basic protection against common web vulnerabilities by setting various HTTP headers.
    -   **CORS**: Configurable Cross-Origin Resource Sharing policy.
    -   **Rate Limiting**: Protection against brute-force attacks on authentication routes.
    -   **Environment Variable Validation**: Ensures critical configurations are present and valid at startup using Joi.
-   **Production Readiness & Observability**:
    *   **Logging**: Structured and configurable logging using Winston (different formats for dev/prod, level configurable).
    *   **Health Endpoint**: `GET /health` for basic uptime and status monitoring.
    *   **Graceful Shutdown**: Handles `SIGINT` and `SIGTERM` signals to shut down the server gracefully.
-   **API Documentation**:
    *   **Swagger UI**: Interactive API documentation served at `/api-docs` from an OpenAPI 3.0 specification.
-   **Modular Design**: Authentication strategies, services, and routes are organized for clarity and maintainability.
-   **Configuration Management**: Environment-based configuration using `.env` files.
-   **Testing**: Comprehensive test suite using Jest and Supertest (though ESLint has execution challenges in the current test environment).
-   **Code Quality**:
    *   Prettier for code formatting.
    *   ESLint for linting (setup exists, but execution issues in provided test environment).
    *   Husky and lint-staged for pre-commit hooks (currently focused on Prettier due to ESLint issues).

- **JWT-based Authentication**: Secure API endpoints using JSON Web Tokens.
- **OAuth 2.0 Integration**:
    - Google Sign-In
    - Facebook Login
- **Modular Design**: Authentication strategies, token utilities, and routes are organized into separate modules for clarity and maintainability.
- **Configuration Management**: Environment-based configuration using `.env` files.
- **Mock User Store**: Simple in-memory user store for development and testing (easily replaceable with a database).
- **Protected Routes**: Example of a protected `/auth/profile` endpoint.
- **Unit and Integration Tests**: Comprehensive test suite using Jest and Supertest.
- **Clear Error Handling**: Standardized JSON error responses.
- **OpenAPI Specification**: API documented using OpenAPI (Swagger) in the `docs/` directory.
- **JSDoc Comments**: All major modules and functions are documented with JSDoc.
 main

## Prerequisites

-   [Node.js](https://nodejs.org/) (version 18.x or later recommended for full compatibility with all dev tools, though core app may run on 14.x+)
-   [npm](https://www.npmjs.com/) (usually comes with Node.js)
-   [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) (Optional, for containerized deployment)
-   Access to Google Cloud Console and Facebook for Developers to obtain OAuth credentials if using these providers.

## Quick Start

```bash
git clone <repository_url>
cd <repository_directory_name>
cp .env.example .env
npm install
npm run dev
```

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
    Open the newly created `.env` file (or your existing one) and fill in all required values, especially your OAuth Client IDs/Secrets and a strong `JWT_SECRET`. See the "Environment Variables Configuration" section below for details.

## Environment Variables Configuration

The `.env` file is used to configure the application. Joi validation at startup will check for required variables.

-   `NODE_ENV`: The application environment (e.g., `development`, `production`, `test`). Default: `development`.
-   `PORT`: The port for the server. Default: `3000`.
-   `LOG_LEVEL`: Logging level for Winston (e.g., `error`, `warn`, `info`, `http`, `debug`, `silly`). Default: `info`.
-   `JWT_SECRET`: **Required**. A strong, random secret key (min 32 characters) for signing JWTs.
-   `REFRESH_TOKEN_EXPIRATION_SECONDS`: Expiration time for refresh tokens in seconds. Default: `604800` (7 days).
-   `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS. Example: `http://localhost:3001,https://yourfrontend.com`. Default (if not set in `.env` but `app.js` needs one): `http://localhost:3001`.

**OAuth Provider Credentials (Required for development/production if provider is enabled):**
-   `GOOGLE_CLIENT_ID`: Google OAuth Client ID.
-   `GOOGLE_CLIENT_SECRET`: Google OAuth Client Secret.
-   `FACEBOOK_CLIENT_ID`: Facebook App ID.
-   `FACEBOOK_CLIENT_SECRET`: Facebook App Secret.
    *(Add similar variables for other OAuth providers if you extend the system).*

**Important**:
-   Keep your `.env` file secure and do not commit it. It's listed in `.gitignore`.
-   The application will fail to start if `JWT_SECRET` is missing or too short, or if required OAuth credentials for enabled providers are missing in non-test environments.

## How the OAuth Flow Works

The application uses Passport.js to handle OAuth 2.0 authentication. The flow is now pluggable via configurations in `config/index.js`.

1.  **Initiation**: Client requests `GET /auth/<providerName>` (e.g., `/auth/google`).
2.  **Redirect**: API redirects to the OAuth provider's consent screen.
3.  **User Consent**: User logs in with provider and grants permissions.
4.  **Callback**: Provider redirects to `GET /auth/<providerName>/callback` on our API.
5.  **Token Exchange & User Handling**: The corresponding Passport strategy (from `src/auth/strategies/`) handles the callback, fetches the user's profile, and uses `userService.findOrCreateUser` to manage the user in the store.
6.  **JWT Issuance**: `authService.generateAndStoreAuthTokens` generates both an access token and a refresh token. The refresh token is stored server-side (currently in-memory).
7.  **Response**: The API responds with JSON containing `accessToken`, `refreshToken`, and user details.

**Callback URLs to configure with providers (examples for local development):**
-   Google: `http://localhost:3000/auth/google/callback` (assuming PORT=3000)
-   Facebook: `http://localhost:3000/auth/facebook/callback`
    *(Adjust host and port as per your deployment.)*

## Running the Application

### Locally

-   **Start in development mode (with nodemon for live reloading):**
    ```bash
    npm run dev
    ```
-   **Start in production mode:**
    ```bash
    npm start
    ```
    The server will run on the port specified in `.env` (default 3000). Logs (via Winston) will show startup status.

### With Docker (Optional)

The project includes a `Dockerfile` and `docker-compose.yml` for containerization.

1.  **Ensure your `.env` file is configured**, especially for `PORT` and any OAuth credentials you intend to use. Docker Compose will pass this file to the container.
2.  **Build and run the container using Docker Compose:**
    ```bash
    docker-compose build
    docker-compose up
    ```
    (Or `docker-compose up --build` to force a rebuild).
3.  The application will be accessible at `http://localhost:PORT` (where `PORT` is from your `.env` file, mapped to the host).
4.  To run with `nodemon` inside Docker for development live reload, you can uncomment the `command: npm run dev` line in `docker-compose.yml`.

## Running Tests

The project uses Jest for unit and integration testing.
```bash
npm test
```
Tests are located in the `tests/` directory. The goal is to maintain high test coverage.
Current test environment has known issues with fully running ESLint.

### Example: Accessing a Protected Route

```bash
curl -H "Authorization: Bearer <your_jwt_token>" http://localhost:3000/auth/profile
```

## API Endpoints Overview

 feat/initial-auth-system
Interactive API documentation is available via Swagger UI when the application is running.

A more detailed specification is available via an OpenAPI document (see [docs/openapi.yaml](docs/openapi.yaml)).
 main

-   **`GET /`**: Welcome message.
-   **`GET /health`**: Health check endpoint. Returns uptime, status message, and timestamp.
-   **`GET /api-docs`**: Serves Swagger UI for interactive API documentation.

**Authentication Endpoints (prefixed with `/auth`):**
-   **`GET /auth/:providerName`** (e.g., `/auth/google`, `/auth/facebook`): Initiates OAuth 2.0 flow for the specified provider.
-   **`GET /auth/:providerName/callback`**: Handles OAuth callback. Returns `accessToken`, `refreshToken`, and user info on success.
-   **`POST /auth/refresh`**: Renews access and refresh tokens using a valid refresh token.
    -   Body: `{ "refreshToken": "your_refresh_token_here" }`
-   **`POST /auth/logout`**: Invalidates the provided refresh token on the server-side.
    -   Body: `{ "refreshToken": "your_refresh_token_here" }`
-   **`GET /auth/profile`**: Protected. Retrieves profile of the authenticated user. Requires Bearer `accessToken`.
-   **`GET /auth/login-failure`**: Generic endpoint for OAuth failures.

## Generating and Using Tokens

-   **Initial Tokens**: `accessToken` and `refreshToken` are provided upon successful OAuth login (via callback routes).
-   **Access Token**: Use as a Bearer token in the `Authorization` header for protected routes like `/auth/profile`.
    `Authorization: Bearer <your_access_token>`
-   **Refresh Token**: When an access token expires, send the `refreshToken` to `POST /auth/refresh` to get a new pair of access and refresh tokens. This implements a rolling refresh token strategy.
-   **Logout**: To logout, the client should discard its tokens. Additionally, call `POST /auth/logout` with the `refreshToken` to invalidate it on the server.

## Code Quality & Linting

-   **Prettier**: Used for consistent code formatting. Configured in `.prettierrc.js`.
-   **ESLint**: Used for static code analysis. Configured in `.eslintrc.js` (for ESLint v8 compatibility).
-   **Husky & lint-staged**: Set up for pre-commit hooks. Currently, only Prettier is run automatically on commit due to ESLint execution issues in some test environments.
-   **Manual Formatting/Linting**:
    ```bash
    npm run format  # Apply Prettier formatting
    npm run lint    # Run ESLint (may have issues in some CI/test environments)
    ```

## Extensibility

### Adding New OAuth Providers

The system is designed to be pluggable for new OAuth providers:
1.  **Add Credentials**: Add the new provider's Client ID and Secret to your `.env` file and to the Joi validation schema in `config/index.js`.
2.  **Configure Provider**: Add a new configuration object to the `oauthProviders` array in `config/index.js`. This object should specify the provider's `name`, `strategyModulePath` (path to its strategy file), `options` (clientID, clientSecret, callbackURL, scope, etc.), and `isEnabled` logic.
3.  **Create Strategy File**: Create a new strategy file (e.g., `myNewProviderStrategy.js`) in the `src/auth/strategies/` directory. This file must export a `configureStrategy(options, services)` function that returns a configured Passport strategy instance for the new provider.
    -   `options` will be passed from the config.
    -   `services` (like `userService`, `authService`) will be passed for user handling and token generation.
The Passport setup (`src/auth/passportSetup.js`) and route generation (`src/routes/authRoutes.js`) should automatically pick up and initialize the new provider.

### Changing User Store Backend

The application uses a User Store Abstraction (`src/adapters/userStoreAdapter.js`) to decouple business logic from the data storage implementation.
1.  **Create New Adapter**: Create a new adapter class in `src/adapters/` (e.g., `myDbAdapter.js`) that extends `UserStoreAdapter` and implements all its required methods (e.g., `findUserById`, `findOrCreateUser`, `addRefreshToken`, etc.) for your chosen database.
    -   Stub files for MongoDB (`mongoUserAdapter.js`) and PostgreSQL (`postgresUserAdapter.js`) are provided as examples.
2.  **Update Store Instantiation**: Modify where the user store is instantiated (currently hardcoded in `src/services/userService.js` and `src/services/authService.js` to use `MockUserStore`). In a more advanced setup, this would be managed by a configuration setting or a dependency injection container to specify which adapter to use.
    ```javascript
    // Example in a service file:
    // const MyDbAdapter = require('../adapters/myDbAdapter');
    // const userStore = new MyDbAdapter();
    ```

feat/initial-auth-system

This README provides a comprehensive guide to understanding, setting up, running, and extending the Modular Node.js Authentication API.

## OpenAPI Specification

See [`docs/openapi.yaml`](docs/openapi.yaml) for a full API specification compatible with Swagger UI.

## Error Handling

All errors are returned as JSON objects with a consistent structure:

```json
{
  "error": "Invalid token",
  "details": "JWT expired"
}
```

Common error cases include:
- Invalid or missing JWT token
- Expired token
- OAuth callback errors
- Unauthorized access to protected routes

## Mock User Store

This project uses a simple in-memory user store for development and testing.  
**To use a real database:**  
Replace the logic in `auth/mockUserStore.js` with your preferred database implementation (e.g., MongoDB, PostgreSQL).

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License.
main
