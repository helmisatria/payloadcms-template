import React from 'react'
import config from '@/payload.config'
import { getPayload } from 'payload'
import { headers as getHeaders } from 'next/headers'
import { User } from 'lucide-react'

export const BetterAuthAvatar = async () => {
  const headers = await getHeaders()

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user) {
    return <div>No user logged in</div>
  }

  if (!user.image) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
        <User size={20} className="text-gray-500" />
      </div>
    )
  }

  return (
    <img
      src={user.image}
      alt={user.name || 'User Avatar'}
      style={{ width: 32, height: 32, borderRadius: '50%' }}
    />
  )
}
