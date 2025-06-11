// src/auth/mockUserStore.js
/**
 * @fileoverview In-memory implementation of the UserStoreAdapter.
 * Suitable for development, testing, and demonstration purposes.
 * This version uses a module-level array to simulate a singleton DB / shared data source.
 */
const UserStoreAdapter = require('../adapters/userStoreAdapter');

const users = []; // Module-level store for user objects

class MockUserStore extends UserStoreAdapter {
  constructor() {
    super();
    // users array is module-level, constructor can be empty or log
    console.log('MockUserStore initialized (using module-level users array).');
  }

  async findUserById(id) {
    const user = users.find(u => u.id === id);
    return user || null;
  }

  async findUserByProfileId(profileId, provider) {
    const user = users.find(u => u.provider === provider && u.providerId === profileId);
    return user || null;
  }

  async findOrCreateUser(profileDetails) {
    let user = await this.findUserByProfileId(profileDetails.providerId, profileDetails.provider);

    if (user) {
      user.displayName = profileDetails.displayName;
      user.email = profileDetails.email || null;
      user.photo = profileDetails.photo || null;
      if (!Array.isArray(user.refreshTokens)) {
        user.refreshTokens = [];
      }
      if (!Array.isArray(user.roles)) { // Ensure roles array exists for existing users
        user.roles = ['user'];
      }
    } else {
      user = {
        id: `${profileDetails.provider}-${profileDetails.providerId}`,
        provider: profileDetails.provider,
        providerId: profileDetails.providerId,
        displayName: profileDetails.displayName,
        email: profileDetails.email || null,
        photo: profileDetails.photo || null,
        roles: ['user'], // Default role for new users
        refreshTokens: [],
      };
      users.push(user); // Add to module-level users array
    }
    return user;
  }

  async addRefreshToken(userId, refreshToken) {
    const user = await this.findUserById(userId); // Uses module-level users via findUserById
    if (user) {
      if (!Array.isArray(user.refreshTokens)) {
        user.refreshTokens = [];
      }
      user.refreshTokens.push(refreshToken);
      return true;
    }
    return false;
  }

  async validateRefreshToken(userId, refreshToken) {
    const user = await this.findUserById(userId);
    if (user && Array.isArray(user.refreshTokens)) {
      return user.refreshTokens.includes(refreshToken);
    }
    return false;
  }

  async removeRefreshToken(userId, refreshToken) {
    const user = await this.findUserById(userId);
    if (user && Array.isArray(user.refreshTokens)) {
      const initialLength = user.refreshTokens.length;
      user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
      return user.refreshTokens.length < initialLength;
    }
    return false;
  }

  async clearAllUsers() {
    users.length = 0; // Clears the module-level array
  }

  // Helper for tests or debugging if needed to access users directly
  // Not part of UserStoreAdapter interface
  getUsers() {
      return users;
  }
}

module.exports = MockUserStore;
