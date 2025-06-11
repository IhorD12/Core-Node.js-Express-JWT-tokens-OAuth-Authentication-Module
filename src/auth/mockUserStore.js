// auth/mockUserStore.js
/**
 * @fileoverview A simple in-memory user store for demonstration and testing.
 * In a production environment, this would be replaced by a database.
 * Manages user profiles and their active refresh tokens.
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
 * Initializes `refreshTokens` array for new users and ensures it exists for existing users.
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
    // Ensure existing users also have the refreshTokens array if store is evolving
    if (!Array.isArray(user.refreshTokens)) {
        user.refreshTokens = [];
    }
    return user;
  }

  const newUser = {
    id: `${provider}-${profile.id}`, // Simple unique ID combining provider and profile.id
    provider: provider,
    providerId: profile.id,
    displayName: profile.displayName,
    email: profile.emails && profile.emails[0] ? profile.emails[0].value : (profile.email || null),
    photo: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
    refreshTokens: [], // Initialize with an empty array for new users
  };
  users.push(newUser);
  return newUser;
};

/**
 * Adds a refresh token to a user's list of active tokens.
 * @param {string} userId - The ID of the user.
 * @param {string} refreshToken - The refresh token to add.
 * @returns {Promise<boolean>} True if added, false if user not found.
 */
const addRefreshTokenToUser = async (userId, refreshToken) => {
  const user = await findUserById(userId);
  if (user) {
    if (!Array.isArray(user.refreshTokens)) { // Defensive: ensure array exists and is an array
      user.refreshTokens = [];
    }
    user.refreshTokens.push(refreshToken);
    return true;
  }
  return false;
};

/**
 * Checks if a given refresh token is valid for a user (i.e., exists in their list).
 * @param {string} userId - The ID of the user.
 * @param {string} refreshToken - The refresh token to validate.
 * @returns {Promise<boolean>} True if the token is valid and exists for the user, false otherwise.
 */
const isRefreshTokenValid = async (userId, refreshToken) => {
  const user = await findUserById(userId);
  if (user && Array.isArray(user.refreshTokens)) {
    return user.refreshTokens.includes(refreshToken);
  }
  return false;
};

/**
 * Removes a refresh token from a user's list (e.g., during logout or token rotation).
 * @param {string} userId - The ID of the user.
 * @param {string} refreshToken - The refresh token to remove.
 * @returns {Promise<boolean>} True if removed, false if user or token not found, or if token was not in the list.
 */
const removeRefreshToken = async (userId, refreshToken) => {
  const user = await findUserById(userId);
  if (user && Array.isArray(user.refreshTokens)) {
    const initialLength = user.refreshTokens.length;
    user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
    return user.refreshTokens.length < initialLength; // True if an element was removed
  }
  return false;
};

/**
 * Clears all users from the store. Useful for testing.
 * This also clears all associated refresh tokens.
 */
const clearUsers = () => {
    users.length = 0;
};


module.exports = {
  findUserByProfileId,
  findUserById,
  findOrCreateUser,
  addRefreshTokenToUser,
  isRefreshTokenValid,
  removeRefreshToken,
  clearUsers, // Export for testing purposes
  users // Export for debugging or specific test scenarios if needed
};
