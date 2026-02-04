import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  googleSub: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export class UserService {
  /**
   * Find or create a user from Google OAuth info
   */
  async findOrCreateFromGoogle(googleUser: GoogleUserInfo): Promise<User> {
    // Try to find existing user by Google sub
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.googleSub, googleUser.sub));

    if (existing) {
      // Update last login and return
      const [updated] = await db
        .update(users)
        .set({
          lastLoginAt: new Date(),
          // Update profile info in case it changed
          name: googleUser.name || existing.name,
          pictureUrl: googleUser.picture || existing.pictureUrl,
        })
        .where(eq(users.id, existing.id))
        .returning();

      return this.toUser(updated);
    }

    // Create new user
    const [created] = await db
      .insert(users)
      .values({
        email: googleUser.email,
        name: googleUser.name,
        pictureUrl: googleUser.picture,
        googleSub: googleUser.sub,
        lastLoginAt: new Date(),
      })
      .returning();

    return this.toUser(created);
  }

  /**
   * Get user by ID
   */
  async getById(id: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));

    return user ? this.toUser(user) : null;
  }

  /**
   * Get user by email
   */
  async getByEmail(email: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    return user ? this.toUser(user) : null;
  }

  private toUser(row: typeof users.$inferSelect): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      pictureUrl: row.pictureUrl,
      googleSub: row.googleSub,
      createdAt: row.createdAt,
      lastLoginAt: row.lastLoginAt,
    };
  }
}

export const userService = new UserService();
