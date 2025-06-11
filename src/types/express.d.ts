// src/types/express.d.ts
import { Request } from 'express';
import { UserProfile } from '@adapters/userStoreAdapter'; // Adjust path alias as necessary

// Define a new interface that extends express.Request
export interface AuthenticatedRequest extends Request {
  user?: UserProfile; // UserProfile is the type for your user object
}

// Alternatively, to augment the global Express namespace (less preferred for local types):
// declare global {
//   namespace Express {
//     export interface Request {
//       user?: UserProfile;
//     }
//   }
// }
