import { APIError, betterAuth } from 'better-auth'
import { MongoClient } from 'mongodb'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { getPayload } from 'payload'
import config from '@payload-config'

const client = new MongoClient(process.env.DATABASE_URI || '')
const db = client.db()

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user, _ctx) => {
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

          // Custom logic before creating a user
          return { data: user }
        },
      },
    },
  },
  database: mongodbAdapter(db, {
    // Optional: if you don't provide a client, database transactions won't be enabled.
    client,
  }),
})
