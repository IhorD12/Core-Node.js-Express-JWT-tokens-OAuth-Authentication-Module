// src/adapters/postgresUserAdapter.js
/**
 * @fileoverview PostgreSQL User Store Adapter (Stub).
 * Placeholder for a future PostgreSQL implementation.
 */
const UserStoreAdapter = require('./userStoreAdapter');

class PostgresUserAdapter extends UserStoreAdapter {
  constructor() {
    super();
    // TODO: Initialize PostgreSQL connection, models (e.g., Sequelize, Knex)
    // Example: this.db = require('../models/sequelizeModels'); // if using Sequelize
    console.warn("PostgreSQL adapter (PostgresUserAdapter) is a stub and not implemented.");
  }

  async findUserById(id) {
    // TODO: Implement PostgreSQL logic
    console.warn(`PostgresUserAdapter.findUserById called with ${id}, but is not implemented.`);
    throw new Error('PostgresUserAdapter.findUserById not implemented.');
  }

  async findUserByProfileId(profileId, provider) {
    // TODO: Implement PostgreSQL logic
    console.warn(`PostgresUserAdapter.findUserByProfileId called with ${profileId}, ${provider}, but is not implemented.`);
    throw new Error('PostgresUserAdapter.findUserByProfileId not implemented.');
  }

  async findOrCreateUser(profileDetails) {
    // TODO: Implement PostgreSQL logic
    console.warn(`PostgresUserAdapter.findOrCreateUser called with profile, but is not implemented.`);
    throw new Error('PostgresUserAdapter.findOrCreateUser not implemented.');
  }

  async addRefreshToken(userId, refreshToken) {
    // TODO: Implement PostgreSQL logic
    console.warn(`PostgresUserAdapter.addRefreshToken called for user ${userId}, but is not implemented.`);
    throw new Error('PostgresUserAdapter.addRefreshToken not implemented.');
  }

  async validateRefreshToken(userId, refreshToken) {
    // TODO: Implement PostgreSQL logic
    console.warn(`PostgresUserAdapter.validateRefreshToken called for user ${userId}, but is not implemented.`);
    throw new Error('PostgresUserAdapter.validateRefreshToken not implemented.');
  }

  async removeRefreshToken(userId, refreshToken) {
    // TODO: Implement PostgreSQL logic
    console.warn(`PostgresUserAdapter.removeRefreshToken called for user ${userId}, but is not implemented.`);
    throw new Error('PostgresUserAdapter.removeRefreshToken not implemented.');
  }

  async clearAllUsers() {
    // TODO: Implement PostgreSQL logic (e.g., for testing environment)
    console.warn(`PostgresUserAdapter.clearAllUsers called, but is not implemented.`);
    throw new Error('PostgresUserAdapter.clearAllUsers not implemented.');
  }
}

module.exports = PostgresUserAdapter;
