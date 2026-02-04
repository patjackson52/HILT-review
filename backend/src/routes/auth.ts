import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { userService, GoogleUserInfo } from '../services/user.service.js';
import { config } from '../config/index.js';
import { UnauthorizedError } from '../domain/errors.js';

// Extend session type
declare module '@fastify/session' {
  interface FastifySessionObject {
    userId?: string;
    user?: {
      id: string;
      email: string;
      name: string | null;
      picture: string | null;
    };
  }
}

export async function authRoutes(app: FastifyInstance) {
  // Check if OAuth is configured
  const oauthEnabled = !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);

  if (oauthEnabled) {
    // Register OAuth2 plugin for Google
    await app.register(import('@fastify/oauth2'), {
      name: 'googleOAuth2',
      scope: ['profile', 'email'],
      credentials: {
        client: {
          id: config.GOOGLE_CLIENT_ID!,
          secret: config.GOOGLE_CLIENT_SECRET!,
        },
        auth: {
          authorizeHost: 'https://accounts.google.com',
          authorizePath: '/o/oauth2/v2/auth',
          tokenHost: 'https://oauth2.googleapis.com',
          tokenPath: '/token',
        },
      },
      startRedirectPath: '/api/v1/auth/google',
      callbackUri: config.OAUTH_REDIRECT_URI || 'http://localhost:3001/api/v1/auth/google/callback',
    });

    // Google OAuth callback
    app.get('/auth/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Get access token from OAuth2
        const { token } = await (app as any).googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

        // Fetch user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
          },
        });

        if (!userInfoResponse.ok) {
          throw new Error('Failed to fetch user info from Google');
        }

        const googleUser: GoogleUserInfo = await userInfoResponse.json();

        // Check domain restriction if configured
        if (config.ALLOWED_DOMAINS && config.ALLOWED_DOMAINS.length > 0) {
          const emailDomain = googleUser.email.split('@')[1];
          if (!config.ALLOWED_DOMAINS.includes(emailDomain)) {
            return reply.redirect(`${getFrontendUrl()}/login?error=domain_not_allowed`);
          }
        }

        // Find or create user
        const user = await userService.findOrCreateFromGoogle(googleUser);

        // Set session
        request.session.userId = user.id;
        request.session.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.pictureUrl,
        };

        // Redirect to frontend
        return reply.redirect(getFrontendUrl());
      } catch (error) {
        request.log.error(error, 'OAuth callback error');
        return reply.redirect(`${getFrontendUrl()}/login?error=oauth_failed`);
      }
    });
  } else {
    // OAuth not configured - return info endpoint
    app.get('/auth/google', async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(501).send({
        error: {
          code: 'OAUTH_NOT_CONFIGURED',
          message: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.',
        },
      });
    });
  }

  // Get current user
  app.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.session.userId) {
      throw new UnauthorizedError('Not authenticated');
    }

    const user = await userService.getById(request.session.userId);
    if (!user) {
      // Session references a deleted user
      request.session.destroy();
      throw new UnauthorizedError('Not authenticated');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.pictureUrl,
      },
    };
  });

  // Logout
  app.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    request.session.destroy();
    return reply.status(204).send();
  });

  // Auth status (for checking if OAuth is configured)
  app.get('/auth/status', async () => {
    return {
      oauth_enabled: oauthEnabled,
      provider: oauthEnabled ? 'google' : null,
    };
  });
}

function getFrontendUrl(): string {
  // In production, use the configured CORS origin or default to relative path
  if (config.NODE_ENV === 'production' && config.CORS_ORIGIN) {
    return config.CORS_ORIGIN;
  }
  // In development, assume frontend is on port 5173
  return 'http://localhost:5173';
}
