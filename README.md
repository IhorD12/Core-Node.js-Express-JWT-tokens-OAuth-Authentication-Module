# Modular Node.js Authentication API

## Overview

This project provides a robust and modular authentication API built with Node.js, Express, and Passport.js. It supports JWT (JSON Web Token) based authentication for protecting API endpoints and includes OAuth 2.0 integration for Google and Facebook login. The primary goal is to offer a secure and extensible authentication solution that can be easily integrated into various applications.

The API allows users to authenticate via third-party providers (Google, Facebook). Upon successful authentication, a JWT is issued to the client. This token can then be used to access protected resources (e.g., a user profile endpoint).

## Features

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

## Prerequisites

- [Node.js](https://nodejs.org/) (version 14.x or later recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)
- Access to Google Cloud Console and Facebook for Developers to obtain OAuth credentials.

## Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd <repository_directory_name>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Copy the example environment file and populate it with your credentials:
    ```bash
    cp .env.example .env
    ```
    Now, open `.env` and fill in the required values (see "Environment Variables Configuration" below).

## Environment Variables Configuration

The `.env` file is used to configure the application. The following variables are required:

-   `NODE_ENV`: The application environment.
    -   Example: `development`, `production`, `test`
    -   Used to enable/disable certain features like detailed error messages.
-   `PORT`: The port on which the server will run.
    -   Example: `3000`
-   `JWT_SECRET`: A secret key used to sign and verify JWTs. This should be a long, random, and strong string.
    -   Example: `your_super_secret_jwt_key_here_at_least_32_chars`
-   `GOOGLE_CLIENT_ID`: Your Google OAuth 2.0 Client ID.
    -   Obtain from [Google Cloud Console](https://console.cloud.google.com/).
    -   Example: `your_google_client_id.apps.googleusercontent.com`
-   `GOOGLE_CLIENT_SECRET`: Your Google OAuth 2.0 Client Secret.
    -   Obtain from [Google Cloud Console](https://console.cloud.google.com/).
    -   Example: `GOCSPX-your_google_client_secret`
-   `FACEBOOK_CLIENT_ID`: Your Facebook App ID.
    -   Obtain from [Facebook for Developers](https://developers.facebook.com/).
    -   Example: `your_facebook_app_id`
-   `FACEBOOK_CLIENT_SECRET`: Your Facebook App Secret.
    -   Obtain from [Facebook for Developers](https://developers.facebook.com/).
    -   Example: `your_facebook_app_secret`

**Important**: Keep your `.env` file secure and do not commit it to version control (it's already in `.gitignore`).

## How the OAuth Flow Works

The application uses Passport.js to handle OAuth 2.0 authentication with Google and Facebook.

1.  **Initiation**: The client (e.g., a user's browser) makes a GET request to an initiation endpoint (`/auth/google` or `/auth/facebook`).
2.  **Redirect to Provider**: The API redirects the client to the respective OAuth provider's authentication screen (Google or Facebook).
3.  **User Consent**: The user logs in with their provider credentials and grants permission to the application.
4.  **Provider Callback**: After successful authentication, the provider redirects the user back to a pre-configured callback URL on our API (`/auth/google/callback` or `/auth/facebook/callback`). This request includes an authorization code (or profile information directly, depending on the flow).
5.  **Token Exchange & User Handling**:
    -   The Passport strategy on the API server handles this callback.
    -   It exchanges the authorization code for an access token from the provider (if applicable) and fetches the user's profile.
    -   The API then uses the `findOrCreateUser` function (from `auth/mockUserStore.js`) to either find an existing user associated with this OAuth profile or create a new one in its local store.
6.  **JWT Issuance**: A JWT is generated for the user using `generateToken` (from `auth/tokenUtils.js`).
7.  **Response to Client**: The API responds to the client (at the callback URL) with the generated JWT, typically in a JSON object.

**Callback URLs to configure with providers:**
-   Google: `http://localhost:PORT/auth/google/callback` (replace `PORT` with your actual port, e.g., 3000)
-   Facebook: `http://localhost:PORT/auth/facebook/callback`

## Running the Application

-   **To start the server for development (with potential live-reloading if `nodemon` is installed globally or as a dev dependency):**
    ```bash
    npm run dev
    ```
    If you don't have `nodemon`, you can install it (`npm install -g nodemon` or `npm install --save-dev nodemon`) or use `npm start`.

-   **To start the server for production/standard mode:**
    ```bash
    npm start
    ```
    The server will run on the port specified in your `.env` file (default is 3000). You should see console output indicating the server has started and which environment variables are loaded.

## Running Tests

The project uses Jest for unit and integration testing.
To run all tests:
```bash
npm test
```
Ensure your `NODE_ENV` is set to `test` or that the tests override it (which `tests/setup.js` does). The tests use a separate configuration for `JWT_SECRET` if needed and mock external OAuth calls.

## Generating New Tokens

JWTs are automatically generated and returned by the API upon a successful OAuth login via the callback routes (`/auth/google/callback` or `/auth/facebook/callback`).

To trigger the flow and get a new token:
1.  Open your web browser and navigate to:
    -   For Google: `http://localhost:PORT/auth/google`
    -   For Facebook: `http://localhost:PORT/auth/facebook`
    (Replace `PORT` with the port your application is running on).
2.  You will be redirected to the respective provider's login page.
3.  Log in and authorize the application.
4.  You will be redirected back to the callback URL, and the API will respond with a JSON object containing the JWT and user information.

Example response from `/auth/google/callback` or `/auth/facebook/callback`:
```json
{
  "message": "Google authentication successful!", // or Facebook
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJnb29nbGUtMTIzNDU2Nzg5...",
  "user": {
    "id": "google-123456789",
    "provider": "google",
    "providerId": "123456789",
    "displayName": "Test User",
    "email": "testuser@example.com",
    "photo": "https://lh3.googleusercontent.com/a/ACLg..."
  }
}
```
You can then use this `token` in the `Authorization` header as a Bearer token to access protected endpoints.

## API Endpoints Overview

A more detailed specification will be available via an OpenAPI document (see `docs/` directory, planned).

-   **`GET /`**: Welcome message for the API.
-   **`GET /auth/google`**: Initiates Google OAuth 2.0 authentication.
-   **`GET /auth/google/callback`**: Handles callback from Google; returns JWT on success.
-   **`GET /auth/facebook`**: Initiates Facebook OAuth 2.0 authentication.
-   **`GET /auth/facebook/callback`**: Handles callback from Facebook; returns JWT on success.
-   **`GET /auth/login-failure`**: Endpoint for failed OAuth attempts (returns JSON error).
-   **`GET /auth/profile`**: Protected route. Retrieves the profile of the authenticated user. Requires a valid JWT in the `Authorization: Bearer <token>` header.

---
This README provides a comprehensive guide to understanding, setting up, and running the Modular Node.js Authentication API.
