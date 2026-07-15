import { APIError, betterAuth } from 'better-auth'
import { getPayload } from 'payload'
import config from '@payload-config'
import { admin } from 'better-auth/plugins/admin'
import { BA_TABLES } from './db/better-auth-tables'
import { postgresPool } from './db/postgres'
import { getIsSeedingUsers } from './seeds/state'

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
  user: {
    modelName: BA_TABLES.user,
  },
  verification: {
    modelName: BA_TABLES.verification,
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  account: {
    modelName: BA_TABLES.account,
    accountLinking: {
      updateUserInfoOnLink: true,
    },
  },
  session: {
    modelName: BA_TABLES.session,
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (refresh session expiration daily)
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache session in cookie for 5 minutes
      strategy: 'compact', // Use compact encoding for smallest cookie size
    },
  },
  plugins: [admin()],
  databaseHooks: {
    user: {
      create: {
        before: async (user, _ctx) => {
          if (getIsSeedingUsers()) {
            return { data: user }
          }

          const payload = await getPayload({ config })

          const userExists = await payload.find({
            collection: 'users',
            limit: 1,
            where: {
              email: { equals: user.email },
            },
          })

          if (!userExists.docs.length) {
            throw new APIError('BAD_REQUEST', {
              message: 'Registration is restricted.',
            })
          }

          return { data: user }
        },
      },
    },
  },
  database: postgresPool,
})
