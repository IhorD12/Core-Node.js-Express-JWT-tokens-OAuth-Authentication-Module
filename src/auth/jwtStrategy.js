// auth/jwtStrategy.js
const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { jwtSecret } = require('../../config');
const { findUserById } = require('./mockUserStore'); // Using the mock store

/**
 * @fileoverview Passport JWT Strategy Configuration.
 * Verifies JWTs sent in the Authorization header.
 */

if (!jwtSecret) {
  throw new Error(
    'JWT_SECRET is not defined in the environment variables. Passport JWT Strategy cannot be set up.'
  );
}

const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Extracts token from "Bearer <token>"
  secretOrKey: jwtSecret,
  // algorithms: ['HS256'] // Optional: Specify algorithms if needed
};

/**
 * Passport JWT Strategy.
 * This function is called when a route is protected by `passport.authenticate('jwt', ...)`.
 * It extracts the JWT from the request, verifies it, and then loads the user associated with the token.
 * @param {object} jwt_payload - The decoded JWT payload.
 * @param {function} done - Passport callback (err, user, info).
 */
const strategy = new JwtStrategy(options, async (jwt_payload, done) => {
  try {
    // Check if the token is specifically an access token
    if (jwt_payload.type !== 'access') {
      return done(null, false, { message: 'Invalid token type. Expected access token.' });
    }

    // jwt_payload.sub contains the user ID stored during token generation
    const user = await findUserById(jwt_payload.sub);

    if (user) {
      // User found, authentication successful
      return done(null, user);
    } else {
      // User not found (e.g., user deleted after token issuance)
      return done(null, false, { message: 'User not found.' });
    }
  } catch (error) {
    // Error during verification or user lookup
    return done(error, false);
  }
});

/**
 * Configures and registers the JWT authentication strategy with a Passport instance.
 * @param {import('passport').PassportStatic} passportInstance - The Passport instance to which the strategy will be added.
 * @throws {Error} If an invalid Passport instance is provided.
 */
module.exports = (passportInstance) => {
  if (!passportInstance || typeof passportInstance.use !== 'function') {
    throw new Error('A valid Passport instance must be provided.');
  }
  passportInstance.use('jwt', strategy); // Use 'jwt' as the strategy name
};
