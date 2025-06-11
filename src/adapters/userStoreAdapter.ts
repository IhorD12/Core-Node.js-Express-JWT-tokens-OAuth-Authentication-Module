// src/adapters/userStoreAdapter.ts

/**
 * @fileoverview Defines the interface for a user store adapter.
 * Any concrete user store implementation should adhere to this interface.
 */

// Define a more structured User type for clarity
export interface UserProfile {
  id: string; // Internal unique ID (e.g., provider-providerId)
  provider: string;
  providerId: string;
  displayName: string;
  email: string | null;
  photo?: string | null;
  roles: string[];
  refreshTokens: string[];
  // 2FA Fields
  isTwoFactorEnabled?: boolean;
  twoFactorSecret?: string | null; // Store securely (encrypted if possible)
  // twoFactorRecoveryCodes?: string[]; // Optional: Hashed recovery codes

  // Timestamps from Mongoose/DB
  createdAt?: Date;
  updatedAt?: Date;
}

// For findOrCreateUser input
export interface ProviderUserProfile {
  providerId: string;
  provider: string;
  displayName: string;
  email?: string | null;
  photo?: string | null;
  // Any other fields from passport profile that might be useful
  _json?: any; // Raw profile from provider
  // emails?: Array<{ value: string; type?: string; primary?: boolean; verified?: boolean }>; // More detailed email structure if needed
}


abstract class UserStoreAdapter {
  constructor() {
    if (this.constructor === UserStoreAdapter) {
      throw new Error("Abstract classes can't be instantiated.");
    }
  }

  /**
   * Finds a user by their internal ID.
   * @param {string} id - The internal user ID.
   * @returns {Promise<UserProfile|null>} The user object (including `roles` array) if found, otherwise null.
   * @abstract
   */
  abstract findUserById(id: string): Promise<UserProfile | null>;

  /**
   * Finds a user by their OAuth profile ID.
   * @param {string} profileId - The profile ID from the OAuth provider.
   * @param {string} provider - The name of the OAuth provider (e.g., 'google', 'facebook').
   * @returns {Promise<UserProfile|null>} The user object if found, otherwise null.
   * @abstract
   */
  abstract findUserByProfileId(profileId: string, provider: string): Promise<UserProfile | null>;

  /**
   * Creates a new user or updates an existing one.
   * The implementation will determine the final user object structure, including its internal 'id' and `refreshTokens` array.
   * @param {ProviderUserProfile} profileDetails - Object containing user profile data from the OAuth provider.
   * @returns {Promise<UserProfile>} The created or updated user object.
   * @abstract
   */
  abstract findOrCreateUser(profileDetails: ProviderUserProfile): Promise<UserProfile>;

  /**
   * Adds a refresh token to a user's list of active tokens.
   * @param {string} userId - The ID of the user.
   * @param {string} refreshToken - The refresh token to add.
   * @returns {Promise<boolean>} True if added, false if user not found or operation failed.
   * @abstract
   */
  abstract addRefreshToken(userId: string, refreshToken: string): Promise<boolean>;

  /**
   * Checks if a given refresh token is valid for a user.
   * @param {string} userId - The ID of the user.
   * @param {string} refreshToken - The refresh token to validate.
   * @returns {Promise<boolean>} True if the token is valid and exists for the user.
   * @abstract
   */
  abstract validateRefreshToken(userId: string, refreshToken: string): Promise<boolean>;

  /**
   * Removes a refresh token from a user's list.
   * @param {string} userId - The ID of the user.
   * @param {string} refreshToken - The refresh token to remove.
   * @returns {Promise<boolean>} True if removed, false if user or token not found.
   * @abstract
   */
  abstract removeRefreshToken(userId: string, refreshToken: string): Promise<boolean>;

  /**
   * Clears all users and their associated data from the store. (Mainly for testing)
   * @returns {Promise<void>}
   * @abstract
   */
  abstract clearAllUsers(): Promise<void>;
}

export default UserStoreAdapter;
