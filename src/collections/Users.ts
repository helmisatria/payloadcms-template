import { canAccessAdminPanel, canSetUserRole, ownerOr, readAccess, updateAccess } from '@/access'
import { withRBAC } from '@/access/withRBAC'
import { auth } from '@/auth'
import type { User } from '@/payload-types'
import type { CollectionConfig, Payload } from 'payload'

interface BetterAuthUser {
  email?: string | null
  id: string
  image?: string | null
  name?: string | null
}

const getDefaultRoleId = async (payload: Payload): Promise<number> => {
  const defaultRoleSlug = process.env.DEFAULT_ROLE_SLUG || 'viewer'
  const roles = await payload.find({
    collection: 'roles',
    depth: 0,
    limit: 1,
    where: {
      slug: {
        equals: defaultRoleSlug,
      },
    },
  })

  const role = roles.docs[0]
  if (!role) {
    throw new Error(
      `Default role "${defaultRoleSlug}" does not exist. Run the database setup and seeds first.`,
    )
  }

  return role.id
}

const UsersConfig: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role', 'updatedAt'],
  },
  hooks: {
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (operation !== 'create' || data?.role) {
          return data
        }

        return {
          ...data,
          role: await getDefaultRoleId(req.payload),
        }
      },
    ],
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

            return { responseHeaders, user: null }
          }

          const session = sessionData as null | { user?: BetterAuthUser }

          if (!session?.user) {
            return { responseHeaders, user: null }
          }

          const betterAuthUser = session.user

          if (!betterAuthUser.email) {
            payload.logger.warn?.('Better Auth session is missing an email address.')
            return { responseHeaders, user: null }
          }

          let payloadUser: User | null = null

          try {
            const { docs } = await payload.find({
              collection: 'users',
              depth: 1,
              limit: 1,
              where: {
                email: {
                  equals: betterAuthUser.email,
                },
              },
            })

            payloadUser = docs[0]

            if (!payloadUser) {
              payload.logger.warn?.({
                msg: 'Better Auth user does not have a matching Payload user',
                email: betterAuthUser.email,
              })

              return { responseHeaders, user: null }
            }

            const baseUserData: Pick<User, 'betterAuthUserId' | 'email' | 'name' | 'image'> = {
              betterAuthUserId: betterAuthUser.id,
              email: betterAuthUser.email,
              name: betterAuthUser.name,
              image: betterAuthUser.image,
            }

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
                depth: 1,
                id: payloadUser.id,
              })

              payload.logger.info?.(`Updated Payload user for ${betterAuthUser.email}`)
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            payload.logger.error?.({
              msg: 'Better Auth strategy failed to synchronize Payload user',
              email: betterAuthUser.email,
              error: errorMessage,
            })

            return { responseHeaders, user: null }
          }

          if (!payloadUser) {
            return { responseHeaders, user: null }
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
      unique: true,
      admin: {
        readOnly: true,
        hidden: true,
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      access: {
        update: () => false,
      },
    },
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'image',
      type: 'text',
      admin: {
        description: 'User profile image URL',
      },
    },
    {
      name: 'role',
      type: 'relationship',
      relationTo: 'roles',
      required: true,
      index: true,
      access: {
        create: ({ req }) => canSetUserRole({ req }),
        update: canSetUserRole,
      },
      admin: {
        description: 'One custom role controls this user’s collection permissions.',
      },
    },
  ],
}

const RBACUsers = withRBAC(UsersConfig)

export const Users: CollectionConfig = {
  ...RBACUsers,
  access: {
    ...RBACUsers.access,
    admin: ({ req }) => canAccessAdminPanel({ req }),
    read: ownerOr(readAccess('users')),
    update: ownerOr(updateAccess('users')),
  },
}
