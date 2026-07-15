import { USER_SEED_DATA, type UserRoleSlug, type UserSeed } from '@/seeds/seed-data'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const TEST_RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const TEST_MEDIA_ALT_PATTERNS = [
  /^E2E RBAC /,
  /^RBAC fixture \d+$/,
  /^Content admin \d+$/,
  /^Content admin UI \d+$/,
  /^Viewer UI fixture \d+$/,
  /^Updated by content admin$/,
]

const testMediaAlt = (name: string): string => `E2E RBAC ${TEST_RUN_ID} ${name}`

const getSeedUser = (roleSlug: UserRoleSlug): UserSeed => {
  const user = USER_SEED_DATA.find((candidate) => candidate.roleSlug === roleSlug)

  if (!user) {
    throw new Error(`Missing ${roleSlug} user in seed data.`)
  }

  return user
}

const signIn = async (request: APIRequestContext, user: UserSeed): Promise<void> => {
  const response = await request.post('/api/auth/sign-in/email', {
    data: {
      email: user.email,
      password: user.password,
    },
  })

  if (!response.ok()) {
    throw new Error(
      `Could not sign in seeded user ${user.email}. Run "corepack pnpm db:setup" first. ` +
        `The sign-in request returned ${response.status()}: ${await response.text()}`,
    )
  }
}

const signOut = async (request: APIRequestContext): Promise<void> => {
  const response = await request.post('/api/auth/sign-out', {
    data: {},
    headers: { Origin: BASE_URL },
  })

  if (!response.ok()) {
    throw new Error(`Sign-out failed with ${response.status()}: ${await response.text()}`)
  }
}

const disposeAuthenticatedRequest = async (request: APIRequestContext): Promise<void> => {
  try {
    await signOut(request)
  } finally {
    await request.dispose()
  }
}

const signInThroughUI = async (page: Page, roleSlug: UserRoleSlug): Promise<void> => {
  const user = getSeedUser(roleSlug)

  await page.goto('/auth/sign-in?redirect=/admin')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(user.email)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()

  await expect(page).toHaveURL(/\/admin$/)

  const dashboardHeading = page.getByRole('heading', { name: 'Collections', exact: true })
  const errorHeading = page.getByRole('heading', { name: 'This page couldn’t load', exact: true })

  await expect(dashboardHeading.or(errorHeading)).toBeVisible()

  if (await errorHeading.isVisible()) {
    await page.reload()
  }

  await expect(dashboardHeading).toBeVisible()
}

const mediaFileName = (alt: string): string => `${alt.toLowerCase().replaceAll(' ', '-')}.txt`

const mediaUpload = (alt: string) => ({
  _payload: JSON.stringify({ alt }),
  file: {
    name: mediaFileName(alt),
    mimeType: 'text/plain',
    buffer: Buffer.from(alt),
  },
})

const createMedia = async (request: APIRequestContext, alt: string): Promise<number | string> => {
  const response = await request.post('/api/media', {
    multipart: mediaUpload(alt),
  })

  expect(response.status()).toBe(201)

  const body = (await response.json()) as { doc: { id: number | string } }
  return body.doc.id
}

const deleteMedia = async (request: APIRequestContext, mediaId: number | string): Promise<void> => {
  const response = await request.delete(`/api/media/${mediaId}`)

  if (!response.ok()) {
    throw new Error(
      `Could not delete test media ${mediaId}. The request returned ` +
        `${response.status()}: ${await response.text()}`,
    )
  }
}

const deleteMediaByAlt = async (request: APIRequestContext, alt: string): Promise<void> => {
  const response = await request.get('/api/media', {
    params: { 'where[alt][equals]': alt },
  })

  if (!response.ok()) {
    throw new Error(
      `Could not find test media with alt "${alt}". The request returned ` +
        `${response.status()}: ${await response.text()}`,
    )
  }

  const body = (await response.json()) as { docs: Array<{ id: number | string }> }

  for (const media of body.docs) {
    await deleteMedia(request, media.id)
  }
}

type TestMedia = {
  alt?: null | string
  id: number | string
}

const isTestMedia = (media: TestMedia): boolean => {
  const alt = media.alt

  if (typeof alt !== 'string') {
    return false
  }

  return TEST_MEDIA_ALT_PATTERNS.some((pattern) => pattern.test(alt))
}

const findAllTestMedia = async (request: APIRequestContext): Promise<TestMedia[]> => {
  const response = await request.get('/api/media', {
    params: { depth: '0', limit: '1000' },
  })

  if (!response.ok()) {
    throw new Error(
      `Could not list media for cleanup. The request returned ` +
        `${response.status()}: ${await response.text()}`,
    )
  }

  const body = (await response.json()) as { docs: TestMedia[] }
  return body.docs.filter(isTestMedia)
}

const deleteAllTestMedia = async (request: APIRequestContext): Promise<void> => {
  const testMedia = await findAllTestMedia(request)

  for (const media of testMedia) {
    await deleteMedia(request, media.id)
  }

  const remainingTestMedia = await findAllTestMedia(request)

  if (remainingTestMedia.length > 0) {
    throw new Error(
      `Test media cleanup left these records behind: ` +
        remainingTestMedia.map((media) => media.id).join(', '),
    )
  }
}

test.describe('Seeded RBAC roles', () => {
  let sharedMediaId: number | string
  let superAdminRequest: APIRequestContext

  test.beforeAll(async ({ playwright }) => {
    superAdminRequest = await playwright.request.newContext({
      baseURL: BASE_URL,
    })
    await signIn(superAdminRequest, getSeedUser('super-admin'))
    await deleteAllTestMedia(superAdminRequest)
    sharedMediaId = await createMedia(superAdminRequest, testMediaAlt('API shared media'))
  })

  test.afterAll(async ({ playwright }) => {
    const cleanupRequest = await playwright.request.newContext({ baseURL: BASE_URL })

    try {
      await signIn(cleanupRequest, getSeedUser('super-admin'))
      await deleteAllTestMedia(cleanupRequest)
    } finally {
      await Promise.all([
        disposeAuthenticatedRequest(cleanupRequest),
        disposeAuthenticatedRequest(superAdminRequest),
      ])
    }
  })

  test('denies anonymous access to RBAC collections', async ({ page, request }) => {
    const mediaResponse = await request.get(`/api/media/${sharedMediaId}`)
    expect(mediaResponse.status()).toBe(403)

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/auth\/sign-in/)
  })

  test('lets super-admin bypass an empty permission matrix', async () => {
    const rolesResponse = await superAdminRequest.get('/api/roles')

    expect(rolesResponse.status()).toBe(200)
    await expect(rolesResponse.json()).resolves.toMatchObject({
      docs: expect.arrayContaining([expect.objectContaining({ slug: 'super-admin' })]),
    })
  })

  test('lets content-admin manage media but not roles', async ({ playwright }) => {
    const request = await playwright.request.newContext({
      baseURL: BASE_URL,
    })
    const alt = testMediaAlt('content-admin API media')
    let mediaId: number | string | undefined

    try {
      await signIn(request, getSeedUser('content-admin'))

      const rolesResponse = await request.get('/api/roles')
      expect(rolesResponse.status()).toBe(403)

      mediaId = await createMedia(request, alt)

      const readResponse = await request.get(`/api/media/${mediaId}`)
      expect(readResponse.status()).toBe(200)

      const updateResponse = await request.patch(`/api/media/${mediaId}`, {
        data: { alt: `${alt} updated` },
      })
      expect(updateResponse.status()).toBe(200)

      const deleteResponse = await request.delete(`/api/media/${mediaId}`)
      expect(deleteResponse.status()).toBe(200)
      mediaId = undefined
    } finally {
      if (mediaId) {
        await deleteMedia(superAdminRequest, mediaId)
      }

      await disposeAuthenticatedRequest(request)
    }
  })

  test('lets viewer read media but blocks every media write', async ({ playwright }) => {
    const request = await playwright.request.newContext({
      baseURL: BASE_URL,
    })

    try {
      await signIn(request, getSeedUser('viewer'))

      const rolesResponse = await request.get('/api/roles')
      expect(rolesResponse.status()).toBe(403)

      const readResponse = await request.get(`/api/media/${sharedMediaId}`)
      expect(readResponse.status()).toBe(200)

      const createResponse = await request.post('/api/media', {
        multipart: mediaUpload(`Viewer create ${Date.now()}`),
      })
      expect(createResponse.status()).toBe(403)

      const updateResponse = await request.patch(`/api/media/${sharedMediaId}`, {
        data: { alt: 'Viewer update attempt' },
      })
      expect(updateResponse.status()).toBe(403)

      const deleteResponse = await request.delete(`/api/media/${sharedMediaId}`)
      expect(deleteResponse.status()).toBe(403)
    } finally {
      await disposeAuthenticatedRequest(request)
    }
  })
})

test.describe('Seeded RBAC admin UI', () => {
  const viewerMediaAlt = testMediaAlt('viewer UI media')
  let superAdminRequest: APIRequestContext
  let viewerMediaId: number | string

  test.beforeAll(async ({ playwright }) => {
    superAdminRequest = await playwright.request.newContext({
      baseURL: BASE_URL,
    })
    await signIn(superAdminRequest, getSeedUser('super-admin'))
    await deleteAllTestMedia(superAdminRequest)
    viewerMediaId = await createMedia(superAdminRequest, viewerMediaAlt)
  })

  test.afterEach(async ({ page }) => {
    await signOut(page.request)
  })

  test.afterAll(async ({ playwright }) => {
    const cleanupRequest = await playwright.request.newContext({ baseURL: BASE_URL })

    try {
      await signIn(cleanupRequest, getSeedUser('super-admin'))
      await deleteAllTestMedia(cleanupRequest)
    } finally {
      await Promise.all([
        disposeAuthenticatedRequest(cleanupRequest),
        disposeAuthenticatedRequest(superAdminRequest),
      ])
    }
  })

  test('shows every collection and seeded role to super-admin', async ({ page }) => {
    await signInThroughUI(page, 'super-admin')

    await expect(page.getByRole('link', { name: 'Show all Users', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Show all Roles', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Show all Media', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Show all Audit-logs', exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Show all Roles', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/collections\/roles(?:\?.*)?$/)
    await expect(page.getByText('Super Admin', { exact: true })).toBeVisible()
    await expect(page.getByText('Content Admin', { exact: true })).toBeVisible()
    await expect(page.getByText('Viewer', { exact: true })).toBeVisible()
  })

  test('lets content-admin create media through the admin UI', async ({ page }) => {
    const alt = testMediaAlt('content-admin UI media')

    try {
      await signInThroughUI(page, 'content-admin')

      await expect(page.getByRole('link', { name: 'Show all Roles', exact: true })).toHaveCount(0)
      await page.getByRole('link', { name: 'Create new Media', exact: true }).click()

      await expect(page).toHaveURL(/\/admin\/collections\/media\/create$/)
      await page.locator('input[type="file"]').setInputFiles({
        name: mediaFileName(alt),
        mimeType: 'text/plain',
        buffer: Buffer.from(alt),
      })
      await page.getByRole('textbox', { name: 'Alt *', exact: true }).fill(alt)
      await page.getByRole('button', { name: 'Save', exact: true }).click()

      await expect(page).not.toHaveURL(/\/admin\/collections\/media\/create$/)
      await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible()
    } finally {
      await deleteMediaByAlt(superAdminRequest, alt)
    }
  })

  test('lets viewer open media but hides every write action', async ({ page }) => {
    await signInThroughUI(page, 'viewer')

    await expect(page.getByRole('link', { name: 'Create new Media', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Show all Roles', exact: true })).toHaveCount(0)

    await page.getByRole('link', { name: 'Show all Media', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/collections\/media(?:\?.*)?$/)
    await expect(page.getByText(viewerMediaAlt, { exact: true })).toBeVisible()

    await page.getByRole('link', { name: mediaFileName(viewerMediaAlt), exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/collections/media/${viewerMediaId}(?:\\?.*)?$`))
    await expect(page.getByRole('textbox', { name: 'Alt *', exact: true })).toHaveValue(
      viewerMediaAlt,
    )
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
  })
})
