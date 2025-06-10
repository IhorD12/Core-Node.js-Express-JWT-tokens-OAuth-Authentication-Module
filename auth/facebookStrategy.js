// auth/facebookStrategy.js
const { Strategy: FacebookStrategy } = require('passport-facebook');
const { facebookClientId, facebookClientSecret } = require('../config');
const { findOrCreateUser } = require('./mockUserStore');
const { generateToken } = require('./tokenUtils');

/**
 * @fileoverview Passport Facebook OAuth 2.0 Strategy Configuration.
 * Handles user authentication via Facebook.
 */

if (!facebookClientId || !facebookClientSecret) {
  throw new Error('FACEBOOK_CLIENT_ID or FACEBOOK_CLIENT_SECRET is not defined. Facebook OAuth Strategy cannot be set up.');
}

const facebookOptions = {
  clientID: facebookClientId,
  clientSecret: facebookClientSecret,
  callbackURL: '/auth/facebook/callback', // This will be the callback URL registered with Facebook
  profileFields: ['id', 'displayName', 'emails', 'photos'], // Request specific fields
};

/**
 * Facebook OAuth Strategy.
 * This function is called after Facebook successfully authenticates the user.
 * @param {string} accessToken - Facebook access token.
 * @param {string} refreshToken - Facebook refresh token (if configured and granted).
 * @param {object} profile - User's Facebook profile information.
 * @param {function} done - Passport callback (err, user, info).
 */
const strategy = new FacebookStrategy(facebookOptions, async (accessToken, refreshToken, profile, done) => {
  try {
    // Log profile to understand its structure during development
    // console.log('Facebook Profile:', JSON.stringify(profile, null, 2));

    if (!profile || !profile.id) {
         return done(new Error("Facebook profile is invalid or missing ID."), false);
    }

    // Facebook sometimes returns email differently or not at all if user hasn't verified
    // We've requested 'emails' in profileFields.
    // The findOrCreateUser function is designed to handle this.

    // Find or create user in our system
    const user = await findOrCreateUser(profile, 'facebook');

    if (!user) {
        return done(new Error("Could not find or create user."), false);
    }

    // Generate JWT for our application
    const token = generateToken(user);

    // Pass user and token to the callback
    return done(null, { user, token });

  } catch (error) {
    return done(error, false);
  }
});

module.exports = (passportInstance) => {
  if (!passportInstance || typeof passportInstance.use !== 'function') {
     throw new Error("A valid Passport instance must be provided.");
  }
  passportInstance.use('facebook', strategy); // Use 'facebook' as the strategy name
};
