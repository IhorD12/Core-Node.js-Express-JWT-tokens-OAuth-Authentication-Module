# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-08-01
### Added
- **Project Foundation & Setup:**
    - Restructured project into `src/`, `config/`, `tests/`, `docs/`, `docker/`, `scripts/`, `adapters/`, `services/`.
    - `npm run setup` script for easy initialization (dependencies, `.env` copy).
    - Docker support (`Dockerfile`, `docker-compose.yml`, `.dockerignore`).
    - Code quality tools: Prettier, ESLint (configured, with known environment issues for ESLint execution), Husky, lint-staged.
- **Core Security Enhancements:**
    - Helmet for security-related HTTP headers.
    - Configurable CORS policy (`CORS_ALLOWED_ORIGINS`).
    - Rate limiting on authentication routes (`/auth/*`).
    - Startup validation for critical environment variables using Joi.
- **Refresh Token System:**
    - Generation of both access tokens (short-lived, `type: 'access'`) and refresh tokens (long-lived, `type: 'refresh'`).
    - Configurable refresh token expiration (`REFRESH_TOKEN_EXPIRATION_SECONDS`).
    - Storage of active refresh tokens (in-memory mock store).
    - `POST /auth/refresh` endpoint with rolling refresh token mechanism.
    - `POST /auth/logout` endpoint to invalidate refresh tokens.
    - JWT strategy updated to only accept 'access' tokens for resource protection.
- **Architectural Improvements:**
    - Service Layer: `authService.js` and `userService.js` to encapsulate business logic.
    - User Store Abstraction: `UserStoreAdapter` interface defined; `MockUserStore` implements it. Stubs for `MongoUserAdapter` and `PostgresUserAdapter` created.
    - Pluggable OAuth Providers: Refactored configuration and Passport setup to dynamically load and configure OAuth strategies (Google, Facebook as initial providers).
- **Production Readiness & Developer Experience:**
    - Logging: Integrated Winston for structured, configurable logging (dev/prod formats, `LOG_LEVEL`).
    - Monitoring: `GET /health` endpoint for uptime and basic status checks.
    - Graceful Shutdown: Implemented handlers for `SIGINT` and `SIGTERM` for safer server termination.
    - API Documentation: Served interactive Swagger UI at `/api-docs` from `docs/openapi.yaml`.
    - Updated `README.md` with comprehensive details on all new features and usage.
- **Initial OAuth Implementation (Implicit Baseline before this version 1.0.0):**
    - Basic Google and Facebook OAuth2 login.
    - JWT generation upon successful login.
    - Protected `/auth/profile` route.
    - Unit and integration tests for core OAuth and JWT functionality.
    - Initial `openapi.yaml` and JSDoc comments.

### Changed
- Major refactoring of project structure and internal logic to support new features and improve modularity (e.g., introduction of `src/` directory, service layer, adapter pattern).
- OAuth strategies now use a common configuration pattern and are dynamically loaded.
- Business logic moved from route handlers and Passport callbacks to the service layer.
- Token generation utilities moved into `authService.js`.
- `mockUserStore.js` refactored to implement `UserStoreAdapter` and focus on data storage simulation.
    - **Entire Codebase**: Migrated from JavaScript to TypeScript for enhanced type safety, maintainability, and developer experience. This includes all source files in `src/`, `config/`, and `tests/`.
    - Updated build process, Jest configuration (`ts-jest`), ESLint configuration, and npm scripts to support the TypeScript workflow.
    - **2FA Design & Stubs**: Added design document (`docs/TWO_FACTOR_AUTHENTICATION.md`), stubbed `TwoFactorAuthService`, and placeholder API endpoints for TOTP-based Two-Factor Authentication. Updated user models/interfaces to include 2FA fields.

### Deprecated
- `src/auth/tokenUtils.js` (functionality absorbed into `authService.js`).
- Original `generateToken(user)` function (now part of `authService.js`, kept for backward compatibility during transition, marked deprecated with a console warning).

### Removed
- `src/auth/tokenUtils.js` file (its functionalities were integrated into `authService.js`).

### Fixed
- (No specific bugs from a prior version were targeted as this is the first formal versioning of the enhanced module. Improvements focused on new features and robustness).

### Security
- Added multiple security layers: Helmet, CORS, rate limiting, refresh tokens with server-side validation and rotation, environment variable validation at startup.
- JWT strategy now strictly checks for `type: 'access'` in tokens to differentiate from refresh tokens.
- Sensitive operations (token verification, user lookup, token storage) are centralized in services.
