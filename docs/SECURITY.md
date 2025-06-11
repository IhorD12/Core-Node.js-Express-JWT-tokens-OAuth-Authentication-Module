# Security Policy

## 1. Introduction

The security of the Modular Node.js Authentication API is a top priority. This document provides an overview of the security features implemented within the module, best practices for its secure deployment, and information on how to report vulnerabilities. We are committed to ensuring a robust and secure authentication experience.

## 2. Security Features & Mitigations

This module incorporates several features and strategies to protect against common web vulnerabilities and secure the authentication process.

### Authentication Core
-   **OAuth 2.0**: Primary authentication is delegated to trusted OAuth 2.0 providers (e.g., Google, Facebook, GitHub). This means the module does not handle user passwords directly, reducing risk. The list of providers is configurable and extensible.
-   **JSON Web Tokens (JWTs)**: Used for stateless API authorization. Once a user authenticates via OAuth, the module issues JWTs (access and refresh tokens) to the client.

### Token Security
-   **Signing Algorithms**: Supports HS256 (shared secret) and RS256 (RSA public/private key pair) for signing JWTs, configurable via the `JWT_ALGORITHM` environment variable. RS256 is recommended for higher security assurance in production.
-   **Access Tokens**:
    -   Short-lived (default 15 minutes, 5 minutes in test).
    -   Stored by the client (e.g., in memory).
    -   Contain necessary claims for API authorization, including user ID (`sub`), email, and type (`type: 'access'`).
    -   The JWT validation strategy strictly checks for `type: 'access'`.
-   **Refresh Tokens**:
    -   Long-lived (default 7 days, configurable via `REFRESH_TOKEN_EXPIRATION_SECONDS`).
    -   Used to obtain new access tokens without requiring re-authentication.
    -   Contain minimal claims: user ID (`sub`) and type (`type: 'refresh'`).
    -   **Storage (Browser Clients)**: Delivered via HTTP-only, Secure (in production), and SameSite (`Lax` by default) cookies. This mitigates XSS risks by preventing client-side JavaScript access.
    -   **Storage (Non-Browser Clients)**: Also available in the response body for API clients that do not manage cookies.
    -   **Rotation**: A new refresh token is issued each time a refresh token is used (rolling refresh tokens), invalidating the used one. This helps mitigate the impact of refresh token theft.
    -   **Server-Side Validation**: Active refresh tokens are stored (currently in-memory mock store, but designed for DB via UserStoreAdapter) and validated on the server during refresh attempts. This allows for server-side invalidation (e.g., on logout) and prevents replay of compromised tokens.
-   **Secrets Management**: All sensitive secrets (JWT shared secret for HS256, RSA private/public keys for RS256, OAuth client secrets, database URIs) are configured exclusively via environment variables, loaded by `dotenv` and validated by Joi at startup.

### Transport Security
-   **HTTPS Enforcement**: In production (`NODE_ENV=production`), built-in middleware automatically redirects all HTTP requests to HTTPS (301 redirect). This relies on the `X-Forwarded-Proto` header if behind a reverse proxy.
-   **HTTP Strict Transport Security (HSTS)**: Enabled via Helmet in production. This instructs browsers to only communicate with the server using HTTPS for the configured `maxAge` (default 1 year). `includeSubDomains` is enabled; `preload` is disabled by default but can be configured.

### HTTP Security Headers (Helmet)
The `helmet` middleware is used to set various HTTP headers that help protect against common attacks:
-   `Content-Security-Policy`: (Default Helmet settings might not set a restrictive CSP. Further configuration is recommended based on application needs.)
-   `Cross-Origin-Embedder-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`: Help mitigate cross-origin attacks.
-   `DNS-Prefetch-Control`: Controls browser DNS prefetching.
-   `Frameguard`: Protects against clickjacking via `X-Frame-Options`.
-   `HSTS`: As described above.
-   `HidePoweredBy`: Removes the `X-Powered-By` header.
-   `IENoOpen`: Sets `X-Download-Options` for IE8+.
-   `NoSniff`: Sets `X-Content-Type-Options` to prevent MIME-sniffing.
-   `OriginAgentCluster`: Provides new mechanisms to isolate origins.
-   `PermittedCrossDomainPolicies`: Restricts Adobe Flash and PDF access.
-   `ReferrerPolicy`: Controls information sent in the `Referer` header.
-   `XSSFilter`: Sets `X-XSS-Protection` (though largely superseded by CSP, Helmet sets it for older browser compatibility).

### Cross-Origin Resource Sharing (CORS)
-   The `cors` middleware is used with a configurable policy.
-   Allowed origins are specified via the `CORS_ALLOWED_ORIGINS` environment variable (comma-separated list).
-   Supports `credentials: true` for passing cookies/auth headers from whitelisted origins.

### Input Validation
-   **Environment Variables**: Validated at application startup using `Joi`. The application will refuse to start if critical variables (like `JWT_SECRET` or required OAuth credentials in production) are missing or invalid.
-   **Request Payloads**: Payloads for critical POST endpoints like `/auth/refresh`, `/auth/logout`, and `/auth/2fa/verify` are validated using Joi schemas via `validationMiddleware.ts`.

### Rate Limiting & Brute-Force Protection
-   Uses `rate-limiter-flexible` for robust rate limiting.
-   A general rate limiter is applied to all authentication routes (`/auth/*`).
-   Stricter, separate rate limiters are applied to sensitive operations like token refresh (`/auth/refresh`) and 2FA verification (`/auth/2fa/verify`).
-   These limiters impose temporary IP-based blocking if limits are exceeded, returning a `429 Too Many Requests` status with a `Retry-After` header.

### Password Security
-   Not applicable for the core module, as it focuses on OAuth 2.0 and does not implement local password-based authentication. If a local strategy were added, strong password hashing (e.g., Argon2 or bcrypt) and salting would be essential.

### Audit Logging (Winston)
-   Comprehensive logging of critical authentication events is implemented using Winston.
-   Logs include successful logins (OAuth), token issuance, token refreshes, logouts, and failed attempts for these operations.
-   Contextual information such as user IDs, OAuth provider names, client IP addresses (where appropriate and available), and error details are logged.
-   Sensitive data like raw tokens, secrets, or passwords are **not** logged.
-   Log format is human-readable in development and JSON structured in production for easier parsing by log management systems. Log level is configurable.

## 3. Simplified Threat Model & Mitigations

-   **Cross-Site Scripting (XSS):**
    -   **Mitigation**: Refresh tokens are primarily handled via HTTP-only cookies when the client is a browser, significantly reducing their accessibility to client-side JavaScript. Content Security Policy (CSP), if configured further via Helmet, can provide additional defense. Input validation on API endpoints also helps.
-   **Cross-Site Request Forgery (CSRF):**
    -   **Mitigation**: The `SameSite=Lax` (default) or `Strict` attribute on refresh token cookies provides substantial protection against CSRF for supporting browsers. For highly sensitive state-changing operations not covered by this (if any were added outside typical API token use), traditional anti-CSRF tokens might be considered. API endpoints primarily expect JSON payloads, which can also help mitigate some forms of CSRF.
-   **Token Theft (Access/Refresh Tokens):**
    -   **Access Tokens**: Short lifespan (e.g., 15 minutes) limits the window of opportunity if stolen. HTTPS (enforced in production) protects them in transit.
    -   **Refresh Tokens**:
        -   HTTP-only cookies protect against XSS theft in browsers.
        -   HTTPS protects in transit.
        -   Rolling refresh tokens (a new token is issued, old one invalidated on use) help detect and mitigate use of stolen tokens.
        -   Server-side validation against a store of active tokens means they can be individually invalidated (e.g., on logout or if a breach is suspected).
-   **Man-in-the-Middle (MitM) Attacks:**
    -   **Mitigation**: Enforced HTTPS via redirection and HSTS header in production environments.
-   **Brute-Force Attacks:**
    -   **Mitigation**: Rate limiting applied to all authentication endpoints, with stricter limits on sensitive operations like token refresh or 2FA verification. Temporary IP blocking is implemented.
-   **Insecure Configuration:**
    -   **Mitigation**: Startup validation of environment variables using Joi ensures critical settings (secrets, URIs) are present and correctly formatted. Default settings aim for security. Documentation highlights secure setup practices.
-   **Denial of Service (DoS):**
    -   **Mitigation**: Basic protection via rate limiting. More advanced DoS/DDoS protection is typically handled at the infrastructure level (e.g., WAF, CDN, load balancers).

## 4. Security Configuration & Best Practices

-   **Environment Variables**:
    -   All secrets (`JWT_SECRET`, `JWT_PRIVATE_KEY`, OAuth client secrets, database URIs) **must** be managed securely. Use a secrets manager in production (e.g., HashiCorp Vault, AWS Secrets Manager, Azure Key Vault).
    -   Do not commit `.env` files containing production secrets to version control.
-   **JWT Algorithm (`JWT_ALGORITHM`):**
    -   `RS256` is strongly recommended for production over `HS256` as it uses public/private key pairs, preventing the signing key from being present in services that only need to verify tokens.
    -   If using `HS256`, ensure `JWT_SECRET` is a long, strong, randomly generated string (min 32 characters, more is better).
-   **RSA Key Management (for RS256):**
    -   Generate strong RSA keys: `openssl genrsa -out private.pem 2048` (or 4096).
    -   Extract the public key: `openssl rsa -in private.pem -pubout -out public.pem`.
    -   Store `JWT_PRIVATE_KEY` with extreme care (e.g., in a secrets manager). Only the token signing service needs access to it.
    -   `JWT_PUBLIC_KEY` can be distributed more widely to services that need to verify tokens.
    -   Implement a key rotation strategy. This module currently supports a single private/public key pair via config. For rotation, you might need to support multiple public keys for verification during a transition period.
-   **Refresh Token Cookie Settings:**
    -   `secure: true`: Ensures the cookie is only sent over HTTPS. **Always use in production.**
    -   `httpOnly: true`: Prevents client-side JavaScript access, mitigating XSS.
    -   `sameSite`: Set to `'Lax'` (good default) or `'Strict'` to protect against CSRF. `'None'` should only be used for cross-site requests if absolutely necessary and requires `secure: true`.
    -   `path`: Scope the cookie appropriately (e.g., to `/auth`).
-   **CORS (`CORS_ALLOWED_ORIGINS`):**
    -   Whitelist only specific, trusted frontend origins. Avoid using wildcard `*` in production.
-   **Rate Limiting:**
    -   Tune the `points`, `duration`, and `blockDuration` for `generalAuthLimiter` and `sensitiveOperationLimiter` based on your application's expected traffic patterns and risk assessment.
    -   For distributed systems, consider using a persistent store for `rate-limiter-flexible` (e.g., Redis) instead of `RateLimiterMemory`.
-   **HTTPS & HSTS:**
    -   Ensure your production deployment uses a reverse proxy (e.g., Nginx, Caddy, Cloud Load Balancer) to handle SSL/TLS termination and forwards requests to the Node.js application via HTTP.
    -   Configure the reverse proxy to set the `X-Forwarded-Proto: https` header.
    -   Understand the implications of HSTS `maxAge` and `preload` before enabling `preload: true`. Start with a shorter `maxAge` if unsure, then increase.
-   **Dependency Management:**
    -   Regularly update dependencies (`npm update`) and monitor for vulnerabilities (e.g., using `npm audit` or tools like Snyk/Dependabot).
-   **Logging (`LOG_LEVEL`):**
    -   In production, set `LOG_LEVEL` to `info` or `warn`. Avoid verbose levels like `debug` unless actively troubleshooting.
    -   Ensure logs are collected, stored securely, and monitored in a centralized logging system (e.g., ELK stack, Splunk, Datadog).
-   **Two-Factor Authentication (2FA):**
    -   The current project includes design and stubs for TOTP-based 2FA. When fully implemented, encourage users to enable it. Ensure secure storage of 2FA secrets and robust verification logic.

## 5. Reporting Security Vulnerabilities

We take security seriously. If you discover a security vulnerability within this module, please report it responsibly.

-   **Email**: Send details to `security@example.com` (Replace with a real security contact email). Please use a clear subject line, like "Security Vulnerability Report: Modular Node.js Auth API".
-   **Information to Include**: Provide a detailed description of the vulnerability, steps to reproduce it, potential impact, and any suggested mitigations if you have them.
-   **Our Commitment**: We will acknowledge receipt of your report, investigate the issue promptly, and work to address it in a timely manner. We appreciate your efforts in helping us maintain the security of this project. (If this were a public open-source project, details about a bug bounty program or public acknowledgments could be included here).

Please **do not** report security vulnerabilities through public GitHub issues.
