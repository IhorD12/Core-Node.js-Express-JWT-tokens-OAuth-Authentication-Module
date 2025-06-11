// src/adapters/mongoUserModel.ts
import mongoose, { Schema, Document, Model } from 'mongoose';
import { UserProfile } from './userStoreAdapter'; // Using UserProfile from adapter

// Interface for Mongoose document that includes methods if any (currently none needed beyond Document's)
// This combines UserProfile with Mongoose's Document properties.
export interface IUserModel extends Omit<UserProfile, 'id'>, Document<string> { // Exclude 'id' if using Mongoose _id and virtual 'id'
  _id: string; // Ensure _id is string to match custom id
}

const userSchemaOptions = {
  timestamps: true,
  _id: false, // We use a custom string _id
  id: false,  // Disable Mongoose's default 'id' virtual getter if we define our own or use _id as id
  toJSON: { virtuals: true, getters: true }, // Ensure virtuals like 'id' are included
  toObject: { virtuals: true, getters: true }
};

const userSchema = new Schema<IUserModel>({
  _id: { type: String, required: true },
  provider: { type: String, required: true },
  providerId: { type: String, required: true },
  displayName: { type: String },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    // unique and sparse are tricky with nulls if not handled carefully by all find/create logic
    // For now, userService layer would need to ensure email uniqueness if required before saving.
  },
  photo: { type: String },
  roles: { type: [String], default: ['user'] },
  refreshTokens: { type: [String], default: [] },
  // 2FA Fields
  isTwoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null }, // Store securely
  // twoFactorRecoveryCodes: { type: [String], default: [] }, // If implementing recovery codes
}, userSchemaOptions);

userSchema.index({ provider: 1, providerId: 1 }, { unique: true });
// Consider adding index for email if it's frequently used in queries and meant to be unique.
// userSchema.index({ email: 1 }, { unique: true, sparse: true }); // Only if email is truly unique and not null often

userSchema.pre<IUserModel>('save', function(next) {
  if (this.isNew && !this._id) { // Should always have _id now if generated before new UserModel()
    this._id = `${this.provider}-${this.providerId}`;
  }
  // If email is empty string, convert to null for sparse index or cleaner data
  if (this.email === '') {
      this.email = null;
  }
  next();
});

// Virtual 'id' getter to map Mongoose '_id' to 'id'
userSchema.virtual('id').get(function(this: IUserModel) {
  return this._id;
});

// The UserModel type should be Model<IUserModel>
const UserModel: Model<IUserModel> = mongoose.model<IUserModel>('User', userSchema);
export default UserModel;
