import type { Access, Where } from 'payload'

export const andAccess = (...rules: Access[]): Access => {
  return async (args) => {
    const filters: Where[] = []

    for (const rule of rules) {
      const result = await rule(args)

      if (result === false) {
        return false
      }

      if (result !== true) {
        filters.push(result)
      }
    }

    if (filters.length === 0) {
      return true
    }

    if (filters.length === 1) {
      return filters[0]
    }

    return { and: filters }
  }
}
