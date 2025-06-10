// auth/googleStrategy.js
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { googleClientId, googleClientSecret } = require('../config');
const { findOrCreateUser } = require('./mockUserStore');
const { generateToken } = require('./tokenUtils');

/**
 * @fileoverview Passport Google OAuth 2.0 Strategy Configuration.
 * Handles user authentication via Google.
 */

if (!googleClientId || !googleClientSecret) {
  throw new Error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not defined. Google OAuth Strategy cannot be set up.');
}

const googleOptions = {
  clientID: googleClientId,
  clientSecret: googleClientSecret,
  callbackURL: '/auth/google/callback', // This will be the callback URL registered with Google
  scope: ['profile', 'email'], // Request access to profile and email
};

/**
 * Google OAuth Strategy.
 * This function is called after Google successfully authenticates the user.
 * It receives the user's profile and an access token from Google.
 * @param {string} accessToken - Google access token (can be used to call Google APIs).
 * @param {string} refreshToken - Google refresh token (if configured and granted).
 * @param {object} profile - User's Google profile information.
 * @param {function} done - Passport callback (err, user, info).
 */
const strategy = new GoogleStrategy(googleOptions, async (accessToken, refreshToken, profile, done) => {
  try {
    // Log profile to understand its structure during development
    // console.log('Google Profile:', JSON.stringify(profile, null, 2));

    if (!profile || !profile.id) {
         return done(new Error("Google profile is invalid or missing ID."), false);
    }

    // Find or create user in our system
    const user = await findOrCreateUser(profile, 'google');

    if (!user) {
        return done(new Error("Could not find or create user."), false);
    }

    // Generate JWT for our application
    const token = generateToken(user);

    // Pass user and token to the callback. The route handler will then decide what to do.
    // We pass an object containing both user and token.
    return done(null, { user, token });

  } catch (error) {
    return done(error, false);
  }
});

module.exports = (passportInstance) => {
  if (!passportInstance || typeof passportInstance.use !== 'function') {
     throw new Error("A valid Passport instance must be provided.");
  }
  passportInstance.use('google', strategy); // Use 'google' as the strategy name
};
