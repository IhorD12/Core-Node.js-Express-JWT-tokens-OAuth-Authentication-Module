// auth/mockUserStore.js
/**
 * @fileoverview A simple in-memory user store for demonstration and testing.
 * In a production environment, this would be replaced by a database.
 */

const users = []; // Store users in memory

/**
 * Finds a user by their OAuth profile ID (e.g., Google ID, Facebook ID).
 * @param {string} profileId - The profile ID from the OAuth provider.
 * @param {string} provider - The name of the OAuth provider (e.g., 'google', 'facebook').
 * @returns {Promise<object|null>} The user object if found, otherwise null.
 */
const findUserByProfileId = async (profileId, provider) => {
  return users.find(user => user.provider === provider && user.providerId === profileId) || null;
};

/**
 * Finds a user by their internal ID.
 * @param {string} id - The internal user ID.
 * @returns {Promise<object|null>} The user object if found, otherwise null.
 */
const findUserById = async (id) => {
  return users.find(user => user.id === id) || null;
};

/**
 * Creates a new user or updates an existing one based on OAuth profile information.
 * This is a simplified version. A real application might handle merging accounts, etc.
 * @param {object} profile - The profile object from Passport (e.g., Google profile, Facebook profile).
 * @param {string} provider - The name of the OAuth provider.
 * @returns {Promise<object>} The created or updated user object.
 */
const findOrCreateUser = async (profile, provider) => {
  let user = await findUserByProfileId(profile.id, provider);

  if (user) {
    // Optionally update user details if they have changed
    user.displayName = profile.displayName;
    user.email = profile.emails && profile.emails[0] ? profile.emails[0].value : (profile.email || null); // Handle different email structures
    user.photo = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
    return user;
  }

  const newUser = {
    id: `${provider}-${profile.id}`, // Simple unique ID combining provider and profile.id
    provider: provider,
    providerId: profile.id,
    displayName: profile.displayName,
    email: profile.emails && profile.emails[0] ? profile.emails[0].value : (profile.email || null),
    photo: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
    // Add any other relevant fields from the profile
  };
  users.push(newUser);
  return newUser;
};

/**
 * Clears all users from the store. Useful for testing.
 */
const clearUsers = () => {
    users.length = 0;
};


module.exports = {
  findUserByProfileId,
  findUserById,
  findOrCreateUser,
  clearUsers, // Export for testing purposes
  users // Export for debugging or specific test scenarios if needed
};
