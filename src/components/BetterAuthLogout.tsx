'use client'

import { LogOut } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'

const SIGN_OUT_ENDPOINTS = ['/api/auth/sign-out', '/api/users/logout'] as const
const REDIRECT_PATH = '/auth/sign-in?redirect=/admin'

async function callSignOutEndpoints() {
  await Promise.allSettled(
    SIGN_OUT_ENDPOINTS.map((endpoint) =>
      fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
      }),
    ),
  )
}

export function BetterAuthLogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return

    setIsLoggingOut(true)

    try {
      await callSignOutEndpoints()
    } catch (error) {
      console.error('Failed to sign out via Better Auth', error)
    } finally {
      if (typeof window !== 'undefined') {
        window.location.href = REDIRECT_PATH
      }
    }
  }, [isLoggingOut])

  return (
    <Button
      type="button"
      variant={'secondary'}
      onClick={handleLogout}
      disabled={isLoggingOut}
      aria-busy={isLoggingOut}
    >
      <LogOut size={20} />
      {isLoggingOut ? 'Signing out…' : 'Log out'}
    </Button>
  )
}

export default BetterAuthLogoutButton
