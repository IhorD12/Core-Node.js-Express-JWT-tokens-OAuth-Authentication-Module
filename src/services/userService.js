// src/services/userService.js
/**
 * @fileoverview User Service for managing user data and lifecycle.
 * Interacts with a user data layer that implements the UserStoreAdapter interface.
 */

const MockUserStore = require('../auth/mockUserStore'); // Import the concrete implementation for current use
// In a real app, the store instance might be injected or resolved via a DI container.
// For this iteration, we instantiate it directly.
const userStore = new MockUserStore();

/**
 * Finds a user by their internal ID.
 * @param {string} id - The internal user ID.
 * @returns {Promise<object|null>} The user object if found, otherwise null.
 */
const findUserById = async (id) => {
  return userStore.findUserById(id);
};

/**
 * Finds a user by their OAuth profile ID.
 * @param {string} profileId - The profile ID from the OAuth provider.
 * @param {string} provider - The name of the OAuth provider (e.g., 'google', 'facebook').
 * @returns {Promise<object|null>} The user object if found, otherwise null.
 */
const findUserByProfileId = async (profileId, provider) => {
  return userStore.findUserByProfileId(profileId, provider);
};

/**
 * Creates a new user or updates an existing one based on OAuth profile information.
 * @param {object} passportProfile - The profile object from Passport (e.g., Google profile, Facebook profile).
 * @param {string} providerName - The name of the OAuth provider (e.g., 'google').
 * @returns {Promise<object>} The created or updated user object.
 */
const findOrCreateUser = async (passportProfile, providerName) => {
  // Adapt the Passport profile to the structure expected by userStore.findOrCreateUser
  const profileDetails = {
    providerId: passportProfile.id,
    provider: providerName,
    displayName: passportProfile.displayName,
    email: passportProfile.emails && passportProfile.emails[0] ? passportProfile.emails[0].value : (passportProfile.email || null),
    photo: passportProfile.photos && passportProfile.photos[0] ? passportProfile.photos[0].value : null,
  };
  return userStore.findOrCreateUser(profileDetails);
};

module.exports = {
  findUserByProfileId,
  findUserById,
  findOrCreateUser,
};
