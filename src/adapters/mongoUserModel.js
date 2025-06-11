// src/adapters/mongoUserModel.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  _id: { type: String }, // Custom ID: provider-providerId
  provider: { type: String, required: true },
  providerId: { type: String, required: true },
  displayName: { type: String },
  email: {
    type: String,
    // Not strictly unique because a user might log in with ProviderA (no email)
    // and then ProviderB (with email). Or multiple accounts might not have email.
    // However, if an email IS provided, it should ideally be unique.
    // For now, removing unique constraint to avoid complexity with multiple nulls/identities.
    // unique: true,
    // sparse: true, // Use sparse if unique is true, to allow multiple nulls
    trim: true,
    lowercase: true,
  },
  photo: { type: String },
  roles: { type: [String], default: ['user'] },
  refreshTokens: { type: [String], default: [] }, // Storing as an array of strings
}, {
  timestamps: true, // Adds createdAt and updatedAt
  _id: false, // Disable default _id generation, we use a custom one
  id: false,    // Ensure 'id' virtual is not automatically created by Mongoose in a conflicting way
});

// Index for common lookups
userSchema.index({ provider: 1, providerId: 1 }, { unique: true });
// Optional: Index on email if frequently queried and if it were constrained as unique.
// userSchema.index({ email: 1 }, { unique: true, sparse: true });

// Custom ID generation pre-save
userSchema.pre('save', function(next) {
  if (this.isNew && !this._id) {
    this._id = `${this.provider}-${this.providerId}`;
  }
  next();
});

// Virtual 'id' getter to match adapter interface if necessary (returns _id)
userSchema.virtual('id').get(function() {
  return this._id;
});

// Ensure virtuals are included when converting to JSON or Object
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });


// Instance method to add a refresh token (matches UserStoreAdapter)
// Note: These methods on the Mongoose model are helpers;
// the adapter will call them but could also implement logic directly.
userSchema.methods.addMongoRefreshToken = async function(tokenString) {
  if (!this.refreshTokens.includes(tokenString)) {
    this.refreshTokens.push(tokenString);
    // Note: The adapter will be responsible for calling save() on the document.
  }
};

// Instance method to validate a refresh token
userSchema.methods.validateMongoRefreshToken = function(tokenString) {
  return this.refreshTokens.includes(tokenString);
};

// Instance method to remove a refresh token
userSchema.methods.removeMongoRefreshToken = async function(tokenString) {
  const initialCount = this.refreshTokens.length;
  this.refreshTokens = this.refreshTokens.filter(rt => rt !== tokenString);
  return this.refreshTokens.length < initialCount;
  // Note: The adapter will be responsible for calling save() on the document if changes occurred.
};


const UserModel = mongoose.model('User', userSchema);
module.exports = UserModel;
