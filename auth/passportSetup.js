// auth/passportSetup.js
const passport = require('passport');
const configureJwtStrategy = require('./jwtStrategy');
const configureGoogleStrategy = require('./googleStrategy');
const configureFacebookStrategy = require('./facebookStrategy');
// const { findUserById } = require('./mockUserStore'); // Not strictly needed here but often in serializer/deserializer

/**
 * @fileoverview Initializes and configures Passport.js with all authentication strategies.
 */

/**
 * Configures and initializes Passport.
 * This function should be called once when the application starts.
 * @param {object} app - The Express application instance (optional, can be used if session support is needed, but we're using JWTs so session:false).
 */
const initializePassport = (app) => {
  // Initialize Passport middleware if Express app is provided
  // For stateless JWT authentication, session support via Express is not strictly necessary
  // if all routes use passport.authenticate with session: false.
  // However, it's common practice to initialize it.
  if (app) {
    app.use(passport.initialize());
    // app.use(passport.session()); // Not needed for JWT stateless auth
  }

  // Configure strategies
  configureJwtStrategy(passport);
  configureGoogleStrategy(passport);
  configureFacebookStrategy(passport);

  // NO Passport session serialization/deserialization needed for JWT-based stateless auth.
  // When using JWTs, each request is authenticated independently based on the token.
  // passport.serializeUser((user, done) => {
  //   done(null, user.id);
  // });
  //
  // passport.deserializeUser(async (id, done) => {
  //   try {
  //     const user = await findUserById(id);
  //     done(null, user);
  //   } catch (error) {
  //     done(error, null);
  //   }
  // });

  console.log('Passport initialized with JWT, Google, and Facebook strategies.');
};

module.exports = initializePassport;
