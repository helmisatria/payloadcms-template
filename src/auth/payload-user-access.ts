import type { Payload } from 'payload'

type PayloadUserReader = Pick<Payload, 'find'>

export async function payloadUserExists(
  payload: PayloadUserReader,
  email: string,
): Promise<boolean> {
  const users = await payload.find({
    collection: 'users',
    limit: 1,
    where: {
      email: { equals: email },
    },
  })

  return users.docs.length > 0
}
