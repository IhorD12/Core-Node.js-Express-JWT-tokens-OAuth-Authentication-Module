// src/adapters/postgresUserAdapter.js
/**
 * @fileoverview PostgreSQL User Store Adapter.
 * Implements UserStoreAdapter for PostgreSQL using the 'pg' driver.
 */
const { Pool } = require('pg');
const UserStoreAdapter = require('./userStoreAdapter');
const { postgresUri } = require('../../config'); // Get URI from main config
const logger = require('../../config/logger');

let pool; // Module-level pool

class PostgresUserAdapter extends UserStoreAdapter {
  constructor() {
    super();
    this.connect();
    // Note: Table creation logic is not included here.
    // Assumes tables (users) are already created or managed externally.
    // A setup script or migration tool would typically handle schema.
  }

  async connect() {
    if (!pool) {
      try {
        logger.info('Connecting to PostgreSQL...');
        pool = new Pool({
          connectionString: postgresUri,
          // Other pool options if needed: max, connectionTimeoutMillis, idleTimeoutMillis
        });

        pool.on('connect', (client) => {
          logger.info('PostgreSQL client connected.');
          // You can set client-level settings here if needed, e.g., client.query('SET search_path TO my_schema');
        });

        pool.on('error', (err, client) => {
          logger.error('Unexpected error on idle PostgreSQL client', { error: err.message, stack: err.stack });
          // process.exit(-1); // Or handle more gracefully
        });

        // Test the connection
        const client = await pool.connect();
        logger.info('PostgreSQL connected successfully via pool.');
        client.release();

      } catch (error) {
        logger.error('Initial PostgreSQL connection pool error:', { error: error.message, stack: error.stack });
        // process.exit(1); // Critical for startup if this is the selected store
      }
    }
  }

  async disconnect() { // For graceful shutdown
    if (pool) {
      await pool.end();
      logger.info('PostgreSQL pool disconnected due to app shutdown.');
      pool = null; // Reset pool
    }
  }

  async findUserById(id) {
    if (!pool) throw new Error('PostgreSQL pool not initialized.');
    const query = 'SELECT * FROM users WHERE id = $1';
    try {
      const { rows } = await pool.query(query, [id]);
      if (rows.length > 0) {
        // Map database row to user object (e.g., snake_case to camelCase if needed)
        // For now, assume column names match object properties or are handled by pg driver.
        return rows[0];
      }
      return null;
    } catch (error) {
      logger.error('Error in findUserById (Postgres):', { error: error.message, stack: error.stack });
      throw error; // Re-throw or handle as per error policy
    }
  }

  async findUserByProfileId(profileId, provider) {
    if (!pool) throw new Error('PostgreSQL pool not initialized.');
    const query = 'SELECT * FROM users WHERE "providerId" = $1 AND provider = $2';
    try {
      const { rows } = await pool.query(query, [profileId, provider]);
      if (rows.length > 0) {
        return rows[0];
      }
      return null;
    } catch (error) {
      logger.error('Error in findUserByProfileId (Postgres):', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async findOrCreateUser(profileDetails) {
    if (!pool) throw new Error('PostgreSQL pool not initialized.');
    // profileDetails: { providerId, provider, displayName, email, photo }

    const existingUser = await this.findUserByProfileId(profileDetails.providerId, profileDetails.provider);

    if (existingUser) {
      // Check if an update is needed
      let needsUpdate = false;
      const updates = {};
      if (profileDetails.displayName && existingUser.displayName !== profileDetails.displayName) {
        updates.displayName = profileDetails.displayName;
        needsUpdate = true;
      }
      if (profileDetails.email && existingUser.email !== (profileDetails.email || '').toLowerCase()) {
        updates.email = (profileDetails.email || '').toLowerCase();
        needsUpdate = true;
      }
      if (profileDetails.photo && existingUser.photo !== profileDetails.photo) {
        updates.photo = profileDetails.photo;
        needsUpdate = true;
      }

      if (needsUpdate) {
        const updateFields = Object.keys(updates);
        const updateValues = Object.values(updates);
        const setClauses = updateFields.map((field, index) => `"${field}" = $${index + 1}`).join(', ');

        const updateQuery = `
          UPDATE users
          SET ${setClauses}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $${updateFields.length + 1}
          RETURNING *;
        `;
        try {
          const { rows } = await pool.query(updateQuery, [...updateValues, existingUser.id]);
          return rows[0];
        } catch (error) {
          logger.error('Error updating user (Postgres):', { error: error.message, stack: error.stack });
          throw error;
        }
      }
      return existingUser;
    }

    // Create new user
    const newUserId = `${profileDetails.provider}-${profileDetails.providerId}`;
    const insertQuery = `
      INSERT INTO users (id, provider, "providerId", "displayName", email, photo, roles, "refreshTokens", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const values = [
      newUserId,
      profileDetails.provider,
      profileDetails.providerId,
      profileDetails.displayName,
      profileDetails.email ? profileDetails.email.toLowerCase() : null,
      profileDetails.photo,
      ['user'], // Default roles
      [],       // Default empty refreshTokens
    ];

    try {
      const { rows } = await pool.query(insertQuery, values);
      return rows[0];
    } catch (error) {
      logger.error('Error creating user (Postgres):', { error: error.message, stack: error.stack });
      // Could be unique constraint violation if trying to re-insert, etc.
      throw error;
    }
  }

  async addRefreshToken(userId, refreshToken) {
    if (!pool) throw new Error('PostgreSQL pool not initialized.');
    // Assumes refreshTokens is TEXT[] in PostgreSQL
    // Use array_append to add if not already present (to avoid duplicates)
    const query = `
      UPDATE users
      SET "refreshTokens" = array_append(COALESCE("refreshTokens", '{}'), $2)
      WHERE id = $1 AND NOT ($2 = ANY(COALESCE("refreshTokens", '{}')));
    `;
    // For just appending without check: "refreshTokens" = array_append("refreshTokens", $2)
    // If using array_append, it's idempotent for adding existing elements if it's a SET.
    // If it's an array, it will append duplicates.
    // The `NOT ($2 = ANY(...))` ensures we only add if not already there.
    // A simpler approach if duplicates are okay or handled by other logic:
    // const query = 'UPDATE users SET "refreshTokens" = array_append("refreshTokens", $2) WHERE id = $1';
    try {
      const result = await pool.query(query, [userId, refreshToken]);
      return result.rowCount > 0; // True if a row was updated
    } catch (error) {
      logger.error('Error in addRefreshToken (Postgres):', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async validateRefreshToken(userId, refreshToken) {
    if (!pool) throw new Error('PostgreSQL pool not initialized.');
    const query = 'SELECT 1 FROM users WHERE id = $1 AND $2 = ANY(COALESCE("refreshTokens", \'{}\'))';
    try {
      const { rows } = await pool.query(query, [userId, refreshToken]);
      return rows.length > 0;
    } catch (error) {
      logger.error('Error in validateRefreshToken (Postgres):', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async removeRefreshToken(userId, refreshToken) {
    if (!pool) throw new Error('PostgreSQL pool not initialized.');
    const query = 'UPDATE users SET "refreshTokens" = array_remove("refreshTokens", $2) WHERE id = $1';
    try {
      const result = await pool.query(query, [userId, refreshToken]);
      // rowCount indicates if the UPDATE statement affected a row.
      // It doesn't tell if the token was actually in the array.
      // To check if it was truly removed, one might need to compare array lengths before/after,
      // or check if the token was present before. For simplicity, assume success if user exists.
      // A more accurate check would be:
      // const user = await this.findUserById(userId);
      // if (!user || !user.refreshTokens || !user.refreshTokens.includes(refreshToken)) return false;
      // // then perform update
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Error in removeRefreshToken (Postgres):', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async clearAllUsers() {
    if (!pool) throw new Error('PostgreSQL pool not initialized.');
    if (process.env.NODE_ENV === 'test') {
      const query = 'TRUNCATE TABLE users RESTART IDENTITY CASCADE;'; // Or DELETE FROM users;
      try {
        await pool.query(query);
        logger.info('PostgresUserAdapter: All users cleared.');
      } catch (error) {
        logger.error('Error in clearAllUsers (Postgres):', { error: error.message, stack: error.stack });
        throw error;
      }
    } else {
      logger.warn('clearAllUsers called outside of test environment for Postgres. Operation aborted.');
      throw new Error('clearAllUsers is only permitted in test environment for Postgres.');
    }
  }
}

PostgresUserAdapter.shutdownPool = async () => {
  if (pool) {
    await pool.end();
    logger.info('PostgreSQL pool shut down successfully via static method.');
    pool = null;
  } else {
    logger.info('No active PostgreSQL pool to shut down via static method.');
  }
};

module.exports = PostgresUserAdapter;
