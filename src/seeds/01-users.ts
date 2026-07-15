import type { Payload } from 'payload'
import type { Role, User } from '@/payload-types'
import { auth } from '@/auth'
import { USER_SEED_DATA, type UserSeed } from './seed-data'

type SeedUsersResult = {
  created: User[]
  failed: string[]
  existing: string[]
}

async function findPayloadUserByEmail(payload: Payload, email: string): Promise<null | User> {
  const result = await payload.find({
    collection: 'users',
    limit: 1,
    where: {
      email: {
        equals: email,
      },
    },
  })

  return result.docs[0] ?? null
}

async function createOrUpdatePayloadUser(
  payload: Payload,
  userData: UserSeed,
  rolesBySlug: Map<string, Role>,
): Promise<{ user: User; alreadyExisted: boolean }> {
  const existingUser = await findPayloadUserByEmail(payload, userData.email)
  const role = rolesBySlug.get(userData.roleSlug)

  if (!role) {
    throw new Error(`Missing seeded role: ${userData.roleSlug}`)
  }

  if (!existingUser) {
    const createdUser = await payload.create({
      collection: 'users',
      data: {
        email: userData.email,
        name: userData.name,
        role: role.id,
      },
    })

    payload.logger.info(`✅ Created Payload user: ${userData.email}`)
    return { user: createdUser, alreadyExisted: false }
  }

  const existingRoleId =
    typeof existingUser.role === 'object' ? existingUser.role.id : existingUser.role
  const needsUpdate = existingUser.name !== userData.name || existingRoleId !== role.id

  if (!needsUpdate) {
    payload.logger.info(`ℹ️ Payload user is up to date: ${userData.email}`)
    return { user: existingUser, alreadyExisted: true }
  }

  const updatedUser = await payload.update({
    collection: 'users',
    id: existingUser.id,
    data: {
      name: userData.name,
      role: role.id,
    },
  })

  payload.logger.info(`♻️ Updated Payload user: ${userData.email}`)
  return { user: updatedUser, alreadyExisted: true }
}

function isExistingUserError(message: string): boolean {
  return message.includes('User already exists')
}

function isMissingTableError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '42P01'
  )
}

async function createBetterAuthUser(payload: Payload, userData: UserSeed): Promise<void> {
  const result = await auth.api.signUpEmail({
    body: {
      email: userData.email,
      password: userData.password,
      name: userData.name,
    },
  })

  if (result instanceof Response) {
    const errorText = await result.text()

    if (result.status === 422 && isExistingUserError(errorText)) {
      payload.logger.info(`ℹ️ Better Auth user exists: ${userData.email}`)
      return
    }

    throw new Error(`Better Auth signup failed with ${result.status}: ${errorText}`)
  }

  if (!result?.user?.id) {
    throw new Error(`Better Auth signup did not return a user for ${userData.email}`)
  }

  payload.logger.info(`✅ Created Better Auth user: ${userData.email}`)
}

export const seedUsers = async (
  payload: Payload,
  rolesBySlug: Map<string, Role>,
): Promise<SeedUsersResult> => {
  payload.logger.info('👤 Seeding users...')

  const created: User[] = []
  const existing: string[] = []
  const failed: string[] = []

  for (const userData of USER_SEED_DATA) {
    try {
      const { user: payloadUser, alreadyExisted } = await createOrUpdatePayloadUser(
        payload,
        userData,
        rolesBySlug,
      )

      await createBetterAuthUser(payload, userData)

      created.push(payloadUser)

      if (alreadyExisted) {
        existing.push(userData.email)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (isExistingUserError(message)) {
        payload.logger.info(`ℹ️ Better Auth user exists: ${userData.email}`)
        continue
      }

      if (isMissingTableError(error)) {
        payload.logger.warn(
          `⚠️ Better Auth tables not found. Run "pnpm auth:migrate" to create them.`,
        )
        break
      }

      failed.push(userData.email)
      payload.logger.error(`❌ Error seeding user ${userData.email}: ${message}`)
    }
  }

  return {
    created,
    existing,
    failed,
  }
}
