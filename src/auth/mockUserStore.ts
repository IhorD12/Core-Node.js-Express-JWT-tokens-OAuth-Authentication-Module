// src/auth/mockUserStore.ts
/**
 * @fileoverview In-memory implementation of the UserStoreAdapter.
 * Suitable for development, testing, and demonstration purposes.
 * This version uses a module-level array to simulate a singleton DB / shared data source.
 */
import UserStoreAdapter, { UserProfile, ProviderUserProfile } from '@adapters/userStoreAdapter'; // Use path alias
import logger from '@config/logger'; // Use path alias

const users: UserProfile[] = []; // Module-level store for user objects, typed

class MockUserStore extends UserStoreAdapter {
  constructor() {
    super();
    logger.info('MockUserStore initialized (using module-level users array).');
  }

  async findUserById(id: string): Promise<UserProfile | null> {
    const user = users.find(u => u.id === id);
    return user || null;
  }

  async findUserByProfileId(profileId: string, provider: string): Promise<UserProfile | null> {
    const user = users.find(u => u.provider === provider && u.providerId === profileId);
    return user || null;
  }

  async findOrCreateUser(profileDetails: ProviderUserProfile): Promise<UserProfile> {
    let user = await this.findUserByProfileId(profileDetails.providerId, profileDetails.provider);

    if (user) {
      user.displayName = profileDetails.displayName;
      user.email = profileDetails.email || null;
      user.photo = profileDetails.photo || null;
      if (!Array.isArray(user.refreshTokens)) { // Should always be true due to UserProfile type
        user.refreshTokens = [];
      }
      if (!Array.isArray(user.roles)) {
        user.roles = ['user']; // Default role if somehow missing
      }
      // Ensure 2FA fields exist for existing users if this schema evolved
      if (typeof user.isTwoFactorEnabled === 'undefined') {
        user.isTwoFactorEnabled = false;
      }
      if (user.twoFactorSecret === undefined) { // Check for undefined specifically if null is a valid state
        user.twoFactorSecret = null;
      }
    } else {
      const newUserId = `${profileDetails.provider}-${profileDetails.providerId}`;
      user = {
        id: newUserId,
        provider: profileDetails.provider,
        providerId: profileDetails.providerId,
        displayName: profileDetails.displayName,
        email: profileDetails.email || null,
        photo: profileDetails.photo || null,
        roles: ['user'], // Default role for new users
        refreshTokens: [],
        isTwoFactorEnabled: false, // Default for new users
        twoFactorSecret: null,    // Default for new users
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      users.push(user);
    }
    return user;
  }

  async addRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    const user = await this.findUserById(userId);
    if (user) {
      // Ensure refreshTokens array exists (should by type, but defensive)
      if (!Array.isArray(user.refreshTokens)) {
        user.refreshTokens = [];
      }
      if (!user.refreshTokens.includes(refreshToken)) { // Avoid duplicates
          user.refreshTokens.push(refreshToken);
      }
      user.updatedAt = new Date();
      return true;
    }
    return false;
  }

  async validateRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    const user = await this.findUserById(userId);
    if (user && Array.isArray(user.refreshTokens)) {
      return user.refreshTokens.includes(refreshToken);
    }
    return false;
  }

  async removeRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    const user = await this.findUserById(userId);
    if (user && Array.isArray(user.refreshTokens)) {
      const initialLength = user.refreshTokens.length;
      user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
      if (user.refreshTokens.length < initialLength) {
        user.updatedAt = new Date();
        return true; // Token was removed
      }
    }
    return false; // Token was not found or not removed
  }

  async clearAllUsers(): Promise<void> {
    users.length = 0;
    logger.info('MockUserStore: All users cleared.');
  }

  // Helper for tests or debugging if needed to access users directly
  getUsers(): UserProfile[] {
      return users;
  }
}

export default MockUserStore;
