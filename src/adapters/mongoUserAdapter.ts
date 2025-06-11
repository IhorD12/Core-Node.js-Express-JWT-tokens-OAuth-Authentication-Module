// src/adapters/mongoUserAdapter.ts
/**
 * @fileoverview MongoDB User Store Adapter.
 * Implements UserStoreAdapter for MongoDB using Mongoose.
 */
import mongoose, { Model, Document } from 'mongoose';
import UserStoreAdapter, { UserProfile, ProviderUserProfile } from './userStoreAdapter'; // relative path for adapter
import UserModel from './mongoUserModel'; // Mongoose User model, to be typed
import config from '@config/index'; // Use path alias
import logger from '@config/logger'; // Use path alias

// Extend Mongoose Document with UserProfile structure and instance methods
// This assumes mongoUserModel.js defines these methods on the schema.
// If not, they should be part of the adapter logic, not model instance.
interface UserDocument extends UserProfile, Document<string> {
  // Mongoose instance methods from schema (if any, for type checking)
  // addMongoRefreshToken: (tokenString: string) => Promise<void>;
  // validateMongoRefreshToken: (tokenString: string) => boolean;
  // removeMongoRefreshToken: (tokenString: string) => Promise<boolean>;
  // Note: My mongoUserModel defined these, but adapter directly manipulates arrays.
  // For cleaner separation, adapter should do all data manipulation.
  // Let's remove these from UserDocument and have adapter do the work.
}


class MongoUserAdapter extends UserStoreAdapter {
  private UserModelTyped: Model<UserDocument>;

  constructor() {
    super();
    this.UserModelTyped = UserModel as Model<UserDocument>; // Cast to typed model
    this.connect();
  }

  private async connect(): Promise<void> {
    if (mongoose.connection.readyState === 0) { // 0 = disconnected
      try {
        logger.info('Connecting to MongoDB...');
        await mongoose.connect(config.mongoUri || ''); // mongoUri can be undefined if not using mongo
        logger.info('MongoDB connected successfully.');

        mongoose.connection.on('error', (err) => {
          logger.error('MongoDB connection error after initial connection:', err);
        });
        mongoose.connection.on('disconnected', () => {
          logger.warn('MongoDB disconnected.');
        });

      } catch (error: any) {
        logger.error('Initial MongoDB connection error:', { message: error.message, stack: error.stack });
        // process.exit(1); // Critical for startup if this is the selected store
      }
    }
  }

  async disconnect(): Promise<void> {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      logger.info('MongoDB disconnected due to app shutdown.');
    }
  }

  async findUserById(id: string): Promise<UserProfile | null> {
    const userDoc = await this.UserModelTyped.findById(id).exec();
    return userDoc ? userDoc.toObject() : null;
  }

  async findUserByProfileId(profileId: string, provider: string): Promise<UserProfile | null> {
    const userDoc = await this.UserModelTyped.findOne({ provider, providerId }).exec();
    return userDoc ? userDoc.toObject() : null;
  }

  async findOrCreateUser(profileDetails: ProviderUserProfile): Promise<UserProfile> {
    const existingUserDoc = await this.UserModelTyped.findOne({
      provider: profileDetails.provider,
      providerId: profileDetails.providerId
    }).exec();

    if (existingUserDoc) {
      let updated = false;
      if (profileDetails.displayName && existingUserDoc.displayName !== profileDetails.displayName) {
        existingUserDoc.displayName = profileDetails.displayName;
        updated = true;
      }
      if (profileDetails.email && existingUserDoc.email !== (profileDetails.email || '').toLowerCase()) {
        existingUserDoc.email = (profileDetails.email || '').toLowerCase();
        updated = true;
      }
      if (profileDetails.photo && existingUserDoc.photo !== profileDetails.photo) {
        existingUserDoc.photo = profileDetails.photo;
        updated = true;
      }
      if (!Array.isArray(existingUserDoc.refreshTokens)) {
        existingUserDoc.refreshTokens = [];
        updated = true;
      }
       if (!Array.isArray(existingUserDoc.roles)) { // Ensure roles array exists
        existingUserDoc.roles = ['user'];
        updated = true;
      }

      if (updated) {
        await existingUserDoc.save();
      }
      return existingUserDoc.toObject();
    }

    const newUserDoc = new this.UserModelTyped({
      provider: profileDetails.provider,
      providerId: profileDetails.providerId,
      displayName: profileDetails.displayName,
      email: profileDetails.email ? profileDetails.email.toLowerCase() : null,
      photo: profileDetails.photo,
      roles: ['user'], // Default role
      refreshTokens: [],
    });
    // _id is set by pre-save hook in mongoUserModel.ts
    await newUserDoc.save();
    return newUserDoc.toObject();
  }

  async addRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    const user = await this.UserModelTyped.findById(userId);
    if (user) {
      if (!user.refreshTokens.includes(refreshToken)) {
        user.refreshTokens.push(refreshToken);
        await user.save();
      }
      return true;
    }
    return false;
  }

  async validateRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    const user = await this.UserModelTyped.findById(userId);
    if (user) {
      return user.refreshTokens.includes(refreshToken);
    }
    return false;
  }

  async removeRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    const user = await this.UserModelTyped.findById(userId);
    if (user && user.refreshTokens) {
      const initialLength = user.refreshTokens.length;
      user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
      if (user.refreshTokens.length < initialLength) {
        await user.save();
        return true;
      }
    }
    return false;
  }

  async clearAllUsers(): Promise<void> {
    if (config.nodeEnv === 'test') {
      await this.UserModelTyped.deleteMany({});
      logger.info('MongoUserAdapter: All users cleared.');
    } else {
      logger.warn('clearAllUsers called outside of test environment for MongoDB. Operation aborted.');
      throw new Error('clearAllUsers is only permitted in test environment for MongoDB.');
    }
  }
}

export default MongoUserAdapter;
