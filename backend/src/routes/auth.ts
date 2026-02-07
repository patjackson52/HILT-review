import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { userService, GoogleUserInfo } from '../services/user.service.js';
import { config } from '../config/index.js';
import { UnauthorizedError } from '../domain/errors.js';
import { createAuthToken, verifyAuthToken } from '../utils/auth-token.js';

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
      startRedirectPath: '/auth/google',
      callbackUri: config.OAUTH_REDIRECT_URI || `http://localhost:${config.PORT}/api/v1/auth/google/callback`,
    });

    // Google OAuth callback
    app.get('/auth/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Get access token from OAuth2
        const { token: oauthToken } = await (app as any).googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

        // Fetch user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${oauthToken.access_token}`,
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

        // Create auth token and redirect to frontend with it
        const authToken = createAuthToken(user);
        const frontendUrl = getFrontendUrl();
        return reply.redirect(`${frontendUrl}/?token=${encodeURIComponent(authToken)}`);
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
    // Check for Bearer token in Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Not authenticated');
    }

    const token = authHeader.slice(7);
    const payload = verifyAuthToken(token);
    if (!payload) {
      throw new UnauthorizedError('Not authenticated');
    }

    return {
      user: {
        id: payload.userId,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
    };
  });

  // Logout (token-based auth - frontend clears localStorage)
  app.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
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
