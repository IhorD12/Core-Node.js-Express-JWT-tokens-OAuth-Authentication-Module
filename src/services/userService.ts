// src/services/userService.ts
/**
 * @fileoverview User Service for managing user data and lifecycle.
 * Interacts with a user data layer that implements the UserStoreAdapter interface.
 */

import config from '@config/index'; // Path alias
import MockUserStore from '@src/auth/mockUserStore'; // Path alias, assuming mockUserStore is in src/auth
import MongoUserAdapter from '@adapters/mongoUserAdapter';
import PostgresUserAdapter from '@adapters/postgresUserAdapter';
import UserStoreAdapter, { UserProfile, ProviderUserProfile } from '@adapters/userStoreAdapter';
import { Profile as PassportProfile } from 'passport'; // For typing passportProfile

let userStore: UserStoreAdapter;

// Initialize the store based on configuration
// This is a simple factory pattern. Could be more advanced in a larger app.
switch (config.userStoreType) {
  case 'mongodb':
    userStore = new MongoUserAdapter();
    break;
  case 'postgres':
    userStore = new PostgresUserAdapter();
    break;
  case 'mock':
  default:
    userStore = new MockUserStore();
    break;
}

/**
 * Finds a user by their internal ID.
 * @param {string} id - The internal user ID.
 * @returns {Promise<UserProfile|null>} The user object if found, otherwise null.
 */
const findUserById = async (id: string): Promise<UserProfile | null> => {
  return userStore.findUserById(id);
};

/**
 * Finds a user by their OAuth profile ID.
 * @param {string} profileId - The profile ID from the OAuth provider.
 * @param {string} provider - The name of the OAuth provider (e.g., 'google', 'facebook').
 * @returns {Promise<UserProfile|null>} The user object if found, otherwise null.
 */
const findUserByProfileId = async (profileId: string, provider: string): Promise<UserProfile | null> => {
  return userStore.findUserByProfileId(profileId, provider);
};

/**
 * Creates a new user or updates an existing one based on OAuth profile information.
 * @param {PassportProfile} passportProfile - The profile object from Passport.
 * @param {string} providerName - The name of the OAuth provider (e.g., 'google').
 * @returns {Promise<UserProfile>} The created or updated user object.
 */
const findOrCreateUser = async (passportProfile: PassportProfile, providerName: string): Promise<UserProfile> => {
  // Adapt the Passport profile to the ProviderUserProfile structure
  let email: string | null = null;
  if (passportProfile.emails && passportProfile.emails.length > 0) {
    email = passportProfile.emails[0].value;
  }

  let photo: string | null = null;
  if (passportProfile.photos && passportProfile.photos.length > 0) {
    photo = passportProfile.photos[0].value;
  }

  const profileDetails: ProviderUserProfile = {
    providerId: passportProfile.id,
    provider: providerName,
    displayName: passportProfile.displayName || (passportProfile as any).username || `${providerName}User-${passportProfile.id}`, // Fallback for username or generic
    email: email,
    photo: photo,
    _json: passportProfile._json, // Pass raw json if needed by adapter
  };
  return userStore.findOrCreateUser(profileDetails);
};

export default {
  findUserByProfileId,
  findUserById,
  findOrCreateUser,
  // Export userStore instance if direct access needed for tests, e.g. clearAllUsers
  // This is not ideal for production but can be pragmatic for mock store testing.
  _userStoreInstanceForTests: process.env.NODE_ENV === 'test' ? userStore : undefined,
};
