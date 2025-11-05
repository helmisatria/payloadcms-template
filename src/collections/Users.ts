import { auth } from '@/auth'
import type { User } from '@/payload-types'
import type { CollectionConfig } from 'payload'

interface BetterAuthUser {
  email?: string | null
  id: string
  name?: string | null
  image?: string | null
}

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'updatedAt'],
  },
  auth: {
    disableLocalStrategy: true,
    strategies: [
      {
        name: 'better-auth',
        authenticate: async ({ headers, payload, canSetHeaders, strategyName }) => {
          let responseHeaders: Headers | undefined
          let sessionData: unknown

          try {
            // Normalize headers to Headers instance
            const requestHeaders = headers instanceof Headers ? headers : new Headers()

            const betterAuthResult = await auth.api.getSession({
              headers: requestHeaders,
              returnHeaders: Boolean(canSetHeaders),
            })

            if (betterAuthResult instanceof Response) {
              sessionData = null
            } else if (
              betterAuthResult &&
              typeof betterAuthResult === 'object' &&
              'response' in betterAuthResult
            ) {
              const resultWithHeaders = betterAuthResult as {
                headers: Headers
                response: unknown
              }
              responseHeaders = resultWithHeaders.headers
              sessionData = resultWithHeaders.response
            } else {
              sessionData = betterAuthResult
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            const isAuthError = error instanceof Error && error.name === 'AuthenticationError'

            payload.logger.error?.({
              msg: 'Better Auth strategy failed to resolve session',
              error: errorMessage,
              type: isAuthError ? 'auth_failure' : 'network_error',
            })

            return {
              responseHeaders,
              user: null,
            }
          }

          const session = sessionData as null | {
            user?: BetterAuthUser
          }

          if (!session?.user) {
            return {
              responseHeaders,
              user: null,
            }
          }

          const betterAuthUser = session.user

          if (!betterAuthUser.email) {
            payload.logger.warn?.('Better Auth session is missing an email address.')
            return {
              responseHeaders,
              user: null,
            }
          }

          let payloadUser: User | null = null
          try {
            const { docs } = await payload.find({
              collection: 'users',
              depth: 0,
              limit: 1,
              where: {
                email: {
                  equals: betterAuthUser.email,
                },
              },
            })

            payloadUser = docs[0]
            const baseUserData: Pick<User, 'betterAuthUserId' | 'email' | 'name' | 'image'> = {
              betterAuthUserId: betterAuthUser.id,
              email: betterAuthUser.email,
              name: betterAuthUser.name,
              image: betterAuthUser.image,
            }

            if (!payloadUser) {
              payloadUser = await payload.create({
                collection: 'users',
                data: baseUserData,
                depth: 0,
              })
              payload.logger.info?.(`Created Payload user for ${betterAuthUser.email}`)
            } else {
              const updates: Record<string, unknown> = {}

              if (payloadUser.email !== baseUserData.email) {
                updates.email = baseUserData.email
              }

              if (baseUserData.name && payloadUser.name !== baseUserData.name) {
                updates.name = baseUserData.name
              }

              if (payloadUser.betterAuthUserId !== baseUserData.betterAuthUserId) {
                updates.betterAuthUserId = baseUserData.betterAuthUserId
              }

              if (baseUserData.image && payloadUser.image !== baseUserData.image) {
                updates.image = baseUserData.image
              }

              if (Object.keys(updates).length > 0) {
                payloadUser = await payload.update({
                  collection: 'users',
                  data: updates,
                  depth: 0,
                  id: payloadUser.id,
                })

                payload.logger.info?.(`Updated Payload user for ${betterAuthUser.email}`)
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            const isDuplicateKeyError =
              error instanceof Error && 'code' in error && error.code === 11000

            payload.logger.error?.({
              msg: 'Better Auth strategy failed to synchronize Payload user',
              email: betterAuthUser.email,
              error: errorMessage,
              type: isDuplicateKeyError ? 'duplicate_user' : 'sync_error',
            })

            return {
              responseHeaders,
              user: null,
            }
          }

          if (!payloadUser) {
            return {
              responseHeaders,
              user: null,
            }
          }

          return {
            responseHeaders,
            user: {
              ...payloadUser,
              collection: 'users',
              _strategy: strategyName,
            },
          }
        },
      },
    ],
  },
  fields: [
    {
      name: 'betterAuthUserId',
      type: 'text',
      // required: true,
      unique: true,
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'name',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'image',
      type: 'text',
      admin: {
        description: 'User profile image URL',
        readOnly: true,
      },
    },
  ],
}
