// src/adapters/postgresUserAdapter.ts
/**
 * @fileoverview PostgreSQL User Store Adapter.
 * Implements UserStoreAdapter for PostgreSQL using the 'pg' driver.
 */
import { Pool, PoolClient, QueryResult } from 'pg';
import UserStoreAdapter, { UserProfile, ProviderUserProfile } from './userStoreAdapter';
import config from '@config/index';
import logger from '@config/logger';

let pool: Pool | null = null; // Module-level pool, initialized on first use or constructor

// Helper to map DB row (snake_case) to UserProfile (camelCase)
// This is important if your DB columns are snake_case (e.g., display_name, provider_id)
// For this example, we'll assume DB columns match UserProfile properties or are quoted if mixed case.
// If they don't, this function would do the mapping.
const mapRowToUserProfile = (row: any): UserProfile => {
  if (!row) return null as any; // Should not happen if row exists
  return {
    id: row.id, // Assumes 'id' is the PK in DB
    provider: row.provider,
    providerId: row.providerId, // Or row.provider_id if snake_case
    displayName: row.displayName, // Or row.display_name
    email: row.email,
    photo: row.photo,
    roles: Array.isArray(row.roles) ? row.roles : ['user'], // Ensure roles is an array
    refreshTokens: Array.isArray(row.refreshTokens) ? row.refreshTokens : [], // Ensure refreshTokens is an array
    createdAt: row.createdAt || row.created_at, // Adjust for snake_case if used
    updatedAt: row.updatedAt || row.updated_at,
  };
};


class PostgresUserAdapter extends UserStoreAdapter {
  constructor() {
    super();
    this.connect();
  }

  private async connect(): Promise<void> {
    if (!pool) {
      try {
        logger.info('Connecting to PostgreSQL...');
        if (!config.postgresUri) {
          throw new Error('POSTGRES_URI is not defined in configuration.');
        }
        pool = new Pool({
          connectionString: config.postgresUri,
        });

        pool.on('connect', (client: PoolClient) => {
          logger.info('PostgreSQL client connected.');
        });

        pool.on('error', (err: Error, client: PoolClient) => {
          logger.error('Unexpected error on idle PostgreSQL client', { error: err.message, stack: err.stack });
        });

        const client = await pool.connect();
        logger.info('PostgreSQL connected successfully via pool.');
        client.release();

      } catch (error: any) {
        logger.error('Initial PostgreSQL connection pool error:', { message: error.message, stack: error.stack });
        pool = null; // Ensure pool is null if connection failed
      }
    }
  }

  static async shutdownPool(): Promise<void> { // Made static for server.js to call
    if (pool) {
      await pool.end();
      logger.info('PostgreSQL pool shut down successfully.');
      pool = null;
    } else {
      logger.info('No active PostgreSQL pool to shut down.');
    }
  }

  async findUserById(id: string): Promise<UserProfile | null> {
    if (!pool) throw new Error('PostgreSQL pool not initialized.');
    const query = 'SELECT * FROM users WHERE id = $1';
    try {
      const result: QueryResult = await pool.query(query, [id]);
      return result.rows.length > 0 ? mapRowToUserProfile(result.rows[0]) : null;
    } catch (error: any) {
      logger.error('Error in findUserById (Postgres):', { message: error.message, stack: error.stack });
      throw error;
    }
  }

  async findUserByProfileId(profileId: string, provider: string): Promise<UserProfile | null> {
    if (!pool) throw new Error('PostgreSQL pool not initialized.');
    // Assuming column names are "providerId" and "provider" (case-sensitive if not quoted)
    // If your DB uses snake_case, quote them: "provider_id"
    const query = 'SELECT * FROM users WHERE "providerId" = $1 AND provider = $2';
    try {
      const result: QueryResult = await pool.query(query, [profileId, provider]);
      return result.rows.length > 0 ? mapRowToUserProfile(result.rows[0]) : null;
    } catch (error: any) {
      logger.error('Error in findUserByProfileId (Postgres):', { message: error.message, stack: error.stack });
      throw error;
    }
  }

  async findOrCreateUser(profileDetails: ProviderUserProfile): Promise<UserProfile> {
    if (!pool) throw new Error('PostgreSQL pool not initialized.');

    const existingUser = await this.findUserByProfileId(profileDetails.providerId, profileDetails.provider);

    if (existingUser) {
      let needsUpdate = false;
      const updates: Partial<UserProfile> = {};
      if (profileDetails.displayName && existingUser.displayName !== profileDetails.displayName) {
        updates.displayName = profileDetails.displayName;
        needsUpdate = true;
      }
      const newEmail = (profileDetails.email || '').toLowerCase() || null;
      if (existingUser.email !== newEmail) {
        updates.email = newEmail;
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
          const result: QueryResult = await pool.query(updateQuery, [...updateValues, existingUser.id]);
          return mapRowToUserProfile(result.rows[0]);
        } catch (error: any) {
          logger.error('Error updating user (Postgres):', { message: error.message, stack: error.stack });
          throw error;
        }
      }
      return existingUser;
    }

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
      const result: QueryResult = await pool.query(insertQuery, values);
      return mapRowToUserProfile(result.rows[0]);
    } catch (error: any) {
      logger.error('Error creating user (Postgres):', { message: error.message, stack: error.stack });
      throw error;
    }
  }

  async addRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    if (!pool) throw new Error('PostgreSQL pool not initialized.');
    const query = `
      UPDATE users
      SET "refreshTokens" = array_append(COALESCE("refreshTokens", '{}'), $2), "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1 AND NOT ($2 = ANY(COALESCE("refreshTokens", '{}')));
    `;
    try {
      const result: QueryResult = await pool.query(query, [userId, refreshToken]);
      return result.rowCount > 0;
    } catch (error: any) {
      logger.error('Error in addRefreshToken (Postgres):', { message: error.message, stack: error.stack });
      throw error;
    }
  }

  async validateRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    if (!pool) throw new Error('PostgreSQL pool not initialized.');
    const query = 'SELECT 1 FROM users WHERE id = $1 AND $2 = ANY(COALESCE("refreshTokens", \'{}\'))';
    try {
      const result: QueryResult = await pool.query(query, [userId, refreshToken]);
      return result.rows.length > 0;
    } catch (error: any) {
      logger.error('Error in validateRefreshToken (Postgres):', { message: error.message, stack: error.stack });
      throw error;
    }
  }

  async removeRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    if (!pool) throw new Error('PostgreSQL pool not initialized.');
    // Check if token exists first to determine if an update actually removed something
    const user = await this.findUserById(userId);
    if (!user || !user.refreshTokens || !user.refreshTokens.includes(refreshToken)) {
        return false; // Token wasn't there to remove or user not found
    }

    const query = 'UPDATE users SET "refreshTokens" = array_remove("refreshTokens", $2), "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1';
    try {
      const result: QueryResult = await pool.query(query, [userId, refreshToken]);
      return result.rowCount > 0;
    } catch (error: any) {
      logger.error('Error in removeRefreshToken (Postgres):', { message: error.message, stack: error.stack });
      throw error;
    }
  }

  async clearAllUsers(): Promise<void> {
    if (!pool) throw new Error('PostgreSQL pool not initialized.');
    if (config.nodeEnv === 'test') {
      const query = 'TRUNCATE TABLE users RESTART IDENTITY CASCADE;';
      try {
        await pool.query(query);
        logger.info('PostgresUserAdapter: All users cleared.');
      } catch (error: any) {
        logger.error('Error in clearAllUsers (Postgres):', { message: error.message, stack: error.stack });
        throw error;
      }
    } else {
      logger.warn('clearAllUsers called outside of test environment for Postgres. Operation aborted.');
      throw new Error('clearAllUsers is only permitted in test environment for Postgres.');
    }
  }
}

export default PostgresUserAdapter;
