import React from 'react'
import config from '@/payload.config'
import { getPayload } from 'payload'
import { headers as getHeaders } from 'next/headers'

interface BetterAuthAvatarProps {
  user: {
    image?: string
  }
}

export const BetterAuthAvatar = async () => {
  const headers = await getHeaders()

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user) {
    return <div>No user logged in</div>
  }

  if (!user.image) {
    return <div>No avatar available</div>
  }

  return (
    <img
      src={user.image}
      alt={user.name || 'User Avatar'}
      style={{ width: 32, height: 32, borderRadius: '50%' }}
    />
  )
}
