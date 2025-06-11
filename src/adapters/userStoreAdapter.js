// src/adapters/userStoreAdapter.js

/**
 * @fileoverview Defines the interface for a user store adapter.
 * Any concrete user store implementation should adhere to this interface.
 */

class UserStoreAdapter {
  constructor() {
    if (this.constructor === UserStoreAdapter) {
      throw new Error("Abstract classes can't be instantiated.");
    }
  }

  /**
   * Finds a user by their internal ID.
   * @param {string} id - The internal user ID.
   * @returns {Promise<object|null>} The user object if found, otherwise null.
   * @abstract
   */
  async findUserById(id) {
    throw new Error("Method 'findUserById()' must be implemented.");
  }

  /**
   * Finds a user by their OAuth profile ID.
   * @param {string} profileId - The profile ID from the OAuth provider.
   * @param {string} provider - The name of the OAuth provider (e.g., 'google', 'facebook').
   * @returns {Promise<object|null>} The user object if found, otherwise null.
   * @abstract
   */
  async findUserByProfileId(profileId, provider) {
    throw new Error("Method 'findUserByProfileId()' must be implemented.");
  }

  /**
   * Creates a new user or updates an existing one.
   * The implementation will determine the final user object structure, including its internal 'id' and `refreshTokens` array.
   * @param {object} profileDetails - Object containing user profile data.
   * @param {string} profileDetails.providerId - User's ID from the OAuth provider.
   * @param {string} profileDetails.provider - Name of the OAuth provider (e.g., 'google', 'facebook').
   * @param {string} profileDetails.displayName - User's display name.
   * @param {string|null} [profileDetails.email] - User's email address (optional).
   * @param {string|null} [profileDetails.photo] - URL to user's profile picture (optional).
   * @returns {Promise<object>} The created or updated user object.
   * @abstract
   */
  async findOrCreateUser(profileDetails) {
    throw new Error("Method 'findOrCreateUser()' must be implemented.");
  }

  /**
   * Adds a refresh token to a user's list of active tokens.
   * @param {string} userId - The ID of the user.
   * @param {string} refreshToken - The refresh token to add.
   * @returns {Promise<boolean>} True if added, false if user not found or operation failed.
   * @abstract
   */
  async addRefreshToken(userId, refreshToken) {
    throw new Error("Method 'addRefreshToken()' must be implemented.");
  }

  /**
   * Checks if a given refresh token is valid for a user.
   * @param {string} userId - The ID of the user.
   * @param {string} refreshToken - The refresh token to validate.
   * @returns {Promise<boolean>} True if the token is valid and exists for the user.
   * @abstract
   */
  async validateRefreshToken(userId, refreshToken) {
    throw new Error("Method 'validateRefreshToken()' must be implemented.");
  }

  /**
   * Removes a refresh token from a user's list.
   * @param {string} userId - The ID of the user.
   * @param {string} refreshToken - The refresh token to remove.
   * @returns {Promise<boolean>} True if removed, false if user or token not found.
   * @abstract
   */
  async removeRefreshToken(userId, refreshToken) {
    throw new Error("Method 'removeRefreshToken()' must be implemented.");
  }

  /**
   * Clears all users and their associated data from the store. (Mainly for testing)
   * @returns {Promise<void>}
   * @abstract
   */
  async clearAllUsers() {
    throw new Error("Method 'clearAllUsers()' must be implemented.");
  }
}

module.exports = UserStoreAdapter;
