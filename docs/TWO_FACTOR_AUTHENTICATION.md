# Two-Factor Authentication (2FA) Design

This document outlines the design for implementing Time-based One-Time Password (TOTP) Two-Factor Authentication for the Modular Node.js Authentication API.

## 1. Overview

Two-Factor Authentication adds an extra layer of security to user accounts. This design focuses on using TOTP, where users use an authenticator app (like Google Authenticator, Authy, etc.) to generate a time-sensitive code that they must provide in addition to their primary authentication method (e.g., OAuth login).

## 2. Chosen Method: TOTP

-   **Time-based One-Time Passwords (TOTP)**: Standardized algorithm (RFC 6238).
-   **User Experience**: Users scan a QR code or manually enter a secret key into their authenticator app. The app then generates 6-8 digit codes that change every 30-60 seconds.
-   **Libraries**: Backend implementation will rely on libraries like `otplib` or `speakeasy` for generating secrets, creating `otpauth://` URLs, and verifying tokens. `qrcode` can be used to generate QR code images/data URLs.

## 3. User Model Changes

The following fields will be added to the user model/profile (e.g., `UserProfile` interface and corresponding database schemas):

-   **`isTwoFactorEnabled: boolean`**:
    -   Indicates if 2FA is currently active for the user.
    -   Defaults to `false`.
    -   Set to `true` only after the user successfully verifies their first TOTP token during setup.
-   **`twoFactorSecret: string | null`**:
    -   The shared secret key (usually Base32 encoded) used by the TOTP algorithm.
    -   This secret must be stored securely on the server. **Encryption at rest is highly recommended for this field.**
    -   Set to `null` when 2FA is not enabled or is disabled.
-   **`twoFactorRecoveryCodes: string[] | null`**: (Optional, Recommended for future enhancement)
    -   An array of single-use backup codes that allow the user to regain access if they lose their authenticator device.
    -   These codes should be **hashed** if stored in the database.
    -   Users should be prompted to save these codes in a safe place during 2FA setup.
    -   For the initial stub implementation, this field might be omitted but is noted for completeness.

### Database Schema Notes:

-   **MongoDB (`mongoUserModel.ts`)**:
    -   `isTwoFactorEnabled: { type: Boolean, default: false }`
    -   `twoFactorSecret: { type: String, default: null }`
    -   `twoFactorRecoveryCodes: { type: [String], default: [] }` (if implemented)
-   **PostgreSQL (`postgresUserAdapter.ts` - conceptual schema for `users` table)**:
    -   `is_two_factor_enabled BOOLEAN DEFAULT FALSE`
    -   `two_factor_secret TEXT DEFAULT NULL`
    -   `two_factor_recovery_codes TEXT[] DEFAULT ARRAY[]::TEXT[]` (if implemented)

## 4. API Endpoints for 2FA Management

All 2FA management endpoints require prior authentication (e.g., a valid access token from primary login).

### A. `POST /auth/2fa/setup`
-   **Description**: Initiates the 2FA setup process for the authenticated user.
-   **Access**: Private (Requires valid access token).
-   **Request Body**: None.
-   **Process**:
    1.  Verify the user is authenticated.
    2.  If the user already has 2FA enabled and is trying to re-setup, decide on policy (e.g., require current TOTP/password, or overwrite). For simplicity, current design might allow overwriting if user is authenticated.
    3.  Generate a new unique TOTP secret for the user (e.g., using `speakeasy.generateSecret()`).
    4.  Store this secret temporarily (e.g., in user's session or a temporary store) or directly associate with the user but mark as unverified. The `twoFactorSecret` field on the user model should be updated. `isTwoFactorEnabled` remains `false` until verification.
    5.  Generate an `otpauth://` URL (e.g., `otpauth://totp/AppName:user@example.com?secret=BASE32SECRET&issuer=AppName`).
    6.  Optionally, generate a QR code data URL from the `otpauth://` URL using `qrcode.toDataURL()`.
-   **Response (Success - 200 OK)**:
    ```json
    {
      "otpAuthUrl": "otpauth://totp/AppName:user@example.com?secret=BASE32SECRET&issuer=AppName",
      "base32Secret": "BASE32SECRET" // For manual entry
      // "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..." // Optional
    }
    ```
-   **Response (Error)**: Standard error responses (401, 500).

### B. `POST /auth/2fa/verify`
-   **Description**: Verifies a TOTP token provided by the user. If this is the first successful verification after `setup`, it enables 2FA for the user. Can also be used as the second factor step during a login flow if 2FA is already enabled.
-   **Access**: Private (Requires valid access token, or could be a special state after primary login).
-   **Request Body**:
    ```json
    {
      "token": "123456" // The 6-8 digit code from the authenticator app
    }
    ```
-   **Process**:
    1.  Verify user authentication.
    2.  Retrieve the user's stored `twoFactorSecret`.
    3.  Verify the provided `token` against the secret and current time window (e.g., using `speakeasy.totp.verify()`).
    4.  If verification is successful:
        *   If `user.isTwoFactorEnabled` was `false`, set it to `true`. Update the user record.
        *   If this endpoint is part of a login flow, grant the session/issue final tokens.
        *   (Optional) If recovery codes were generated at setup but not yet shown, this might be the point to display them.
-   **Response (Success - 200 OK)**:
    ```json
    {
      "message": "2FA token verified successfully." // Or "2FA enabled successfully."
      // "recoveryCodes": ["code1", "code2", ...] // If enabling 2FA and showing recovery codes now
    }
    ```
-   **Response (Error - 400 Bad Request)**: If token is invalid or missing.
    ```json
    { "message": "Invalid 2FA token." }
    ```
-   **Response (Error - 401 Unauthorized)**: If not authenticated.

### C. `POST /auth/2fa/disable`
-   **Description**: Disables 2FA for the authenticated user.
-   **Access**: Private (Requires valid access token).
-   **Request Body**: (Optional, for enhanced security)
    ```json
    {
      // "token": "123456" // Optionally require a current TOTP token to disable
      // "password": "user_current_password" // Optionally require current password
    }
    ```
    For the initial stub, no body is required, just being authenticated is enough.
-   **Process**:
    1.  Verify user authentication (and optionally current TOTP/password if required by policy).
    2.  Clear/nullify `user.twoFactorSecret`.
    3.  Set `user.isTwoFactorEnabled = false`.
    4.  (Optional) Remove any active recovery codes.
    5.  Update the user record.
-   **Response (Success - 200 OK)**:
    ```json
    { "message": "2FA disabled successfully." }
    ```
-   **Response (Error)**: Standard error responses (400, 401, 403, 500).

### D. `POST /auth/2fa/generate-recovery-codes` (Optional Future Enhancement)
-   **Description**: Generates a new set of recovery codes for a user who already has 2FA enabled. This invalidates any previous recovery codes.
-   **Access**: Private (Requires valid access token, 2FA must be enabled).
-   **Process**:
    1.  Generate new recovery codes (e.g., 10 codes, 8-10 digits each).
    2.  Hash these codes.
    3.  Store the hashed codes, replacing any old ones.
    4.  Return the plain text codes to the user *one time*.
-   **Response (Success - 200 OK)**:
    ```json
    {
      "recoveryCodes": ["newcode1", "newcode2", ...]
    }
    ```

## 5. Security Considerations

-   **TOTP Secret Storage**: The `twoFactorSecret` must be stored securely. Encryption at rest is highly recommended. Avoid logging this secret.
-   **Rate Limiting**: Apply rate limiting to the `/auth/2fa/verify` endpoint to prevent brute-force attacks on TOTP codes. Also consider rate limiting `/auth/2fa/setup` if it's resource-intensive or could be abused.
-   **Recovery Codes**: If implemented, recovery codes must be stored hashed. They should be single-use.
-   **Transport Security**: All endpoints must be served over HTTPS.
-   **Token Expiry and Window**: Carefully configure the time step (e.g., 30 seconds) and validation window (e.g., allow current, previous, and next token) for TOTP verification to account for clock drift.
-   **User Education**: Clearly instruct users on how to use 2FA, the importance of saving recovery codes, and what to do if they lose access to their authenticator device.

## 6. Recommended Libraries (for full implementation)

-   **`otplib`**: A robust library for TOTP/HOTP generation and verification.
-   **`speakeasy`**: Another popular library for 2FA, including TOTP.
-   **`qrcode`**: For generating QR code images or data URLs from the `otpauth://` string.

This design provides a foundation for adding TOTP-based 2FA to the application. The initial implementation will focus on creating stubs for the service and API endpoints.
