import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { auth } from '@/auth'
import { USER_SEED_DATA } from './seed-data'

export const seedUsers = async (payload: Payload) => {
  payload.logger.info('=d Seeding Users...')

  const created: User[] = []

  for (const userData of USER_SEED_DATA) {
    try {
      // Check if user already exists
      const existing = await payload.find({
        collection: 'users',
        where: { email: { equals: userData.email } },
      })

      if (existing.docs.length === 0) {
        // Create user using Better Auth
        await auth.api.signUpEmail({
          body: {
            email: userData.email,
            password: userData.password,
            name: userData.name,
          },
        })

        // Wait a bit for the user to be synced to Payload
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Find the created user and update their role
        const createdUsers = await payload.find({
          collection: 'users',
          where: { email: { equals: userData.email } },
        })

        if (createdUsers.docs.length > 0) {
          const user = createdUsers.docs[0]
          // Update with role
          const updatedUser = await payload.update({
            collection: 'users',
            id: user.id,
            data: {
              role: userData.role,
            },
          })

          created.push(updatedUser)
          payload.logger.info(`✅ Created user: ${userData.name} (${userData.role})`)
        } else {
          payload.logger.warn(
            `⚠️  User created in Better Auth but not found in Payload: ${userData.email}`,
          )
        }
      } else {
        created.push(existing.docs[0] as User)
        payload.logger.info(`ℹ️ User exists: ${userData.email}`)
      }
    } catch (error) {
      payload.logger.error(
        `L Error creating user ${userData.email}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return created
}
