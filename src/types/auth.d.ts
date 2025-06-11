// src/types/auth.d.ts
import { UserProfile } from "@adapters/userStoreAdapter"; // Using path alias

export interface AuthCallbackData {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenRequestBody {
  refreshToken: string;
}

export interface LogoutRequestBody {
  refreshToken: string;
}
