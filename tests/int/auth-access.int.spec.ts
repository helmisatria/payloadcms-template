import { payloadUserExists } from '@/auth/payload-user-access'
import { auth } from '@/auth'
import { Users } from '@/collections/Users'
import type { Payload } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

const getBetterAuthStrategy = () => {
  if (!Users.auth || typeof Users.auth === 'boolean') {
    throw new Error('Users collection is missing its auth configuration.')
  }

  const strategy = Users.auth.strategies?.find(({ name }) => name === 'better-auth')
  if (!strategy) {
    throw new Error('Users collection is missing the Better Auth strategy.')
  }

  return strategy
}

describe('Better Auth Payload access', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('checks whether an email has a pre-provisioned Payload user', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [{ id: 1 }] })
      .mockResolvedValueOnce({ docs: [] })
    const payload = { find } as unknown as Pick<Payload, 'find'>

    await expect(payloadUserExists(payload, 'allowed@example.com')).resolves.toBe(true)
    await expect(payloadUserExists(payload, 'blocked@example.com')).resolves.toBe(false)
  })

  it('does not create a missing Payload user while resolving a session', async () => {
    vi.spyOn(auth.api, 'getSession').mockResolvedValue({
      user: {
        email: 'blocked@example.com',
        id: 'better-auth-user-id',
        image: null,
        name: 'Blocked User',
      },
    } as never)

    const find = vi.fn().mockResolvedValue({ docs: [] })
    const create = vi.fn()
    const warn = vi.fn()
    const strategy = getBetterAuthStrategy()

    const result = await strategy.authenticate({
      headers: new Headers(),
      payload: {
        create,
        find,
        logger: { warn },
      } as unknown as Payload,
      strategyName: strategy.name,
    })

    expect(result.user).toBeNull()
    expect(create).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith({
      msg: 'Better Auth user does not have a matching Payload user',
      email: 'blocked@example.com',
    })
  })
})
