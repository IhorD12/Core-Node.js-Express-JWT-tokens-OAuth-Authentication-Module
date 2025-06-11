// src/adapters/mongoUserAdapter.js
/**
 * @fileoverview MongoDB User Store Adapter (Stub).
 * Placeholder for a future MongoDB implementation.
 */
const UserStoreAdapter = require('./userStoreAdapter');

class MongoUserAdapter extends UserStoreAdapter {
  constructor() {
    super();
    // TODO: Initialize MongoDB connection, models, etc.
    // Example: this.User = require('../models/userModel'); // if using Mongoose
    console.warn("MongoDB adapter (MongoUserAdapter) is a stub and not implemented.");
  }

  async findUserById(id) {
    // TODO: Implement MongoDB logic
    console.warn(`MongoUserAdapter.findUserById called with ${id}, but is not implemented.`);
    throw new Error('MongoUserAdapter.findUserById not implemented.');
  }

  async findUserByProfileId(profileId, provider) {
    // TODO: Implement MongoDB logic
    console.warn(`MongoUserAdapter.findUserByProfileId called with ${profileId}, ${provider}, but is not implemented.`);
    throw new Error('MongoUserAdapter.findUserByProfileId not implemented.');
  }

  async findOrCreateUser(profileDetails) {
    // TODO: Implement MongoDB logic
    console.warn(`MongoUserAdapter.findOrCreateUser called with profile, but is not implemented.`);
    throw new Error('MongoUserAdapter.findOrCreateUser not implemented.');
  }

  async addRefreshToken(userId, refreshToken) {
    // TODO: Implement MongoDB logic
    console.warn(`MongoUserAdapter.addRefreshToken called for user ${userId}, but is not implemented.`);
    throw new Error('MongoUserAdapter.addRefreshToken not implemented.');
  }

  async validateRefreshToken(userId, refreshToken) {
    // TODO: Implement MongoDB logic
    console.warn(`MongoUserAdapter.validateRefreshToken called for user ${userId}, but is not implemented.`);
    throw new Error('MongoUserAdapter.validateRefreshToken not implemented.');
  }

  async removeRefreshToken(userId, refreshToken) {
    // TODO: Implement MongoDB logic
    console.warn(`MongoUserAdapter.removeRefreshToken called for user ${userId}, but is not implemented.`);
    throw new Error('MongoUserAdapter.removeRefreshToken not implemented.');
  }

  async clearAllUsers() {
    // TODO: Implement MongoDB logic (e.g., for testing environment)
    console.warn(`MongoUserAdapter.clearAllUsers called, but is not implemented.`);
    throw new Error('MongoUserAdapter.clearAllUsers not implemented.');
  }
}

module.exports = MongoUserAdapter;
