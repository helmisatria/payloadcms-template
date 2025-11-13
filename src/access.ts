import { User } from './payload-types'

export const hasRole = (user: User | null, roleName: string): boolean => {
  if (!user || !user.role) {
    return false
  }

  const role = user.role as User['role']
  return role === roleName
}
