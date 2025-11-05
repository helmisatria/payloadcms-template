import { headers as getHeaders } from 'next/headers.js'
import Image from 'next/image'
import { getPayload } from 'payload'
import React from 'react'
import { fileURLToPath } from 'url'

import config from '@/payload.config'

export default async function HomePage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const fileURL = `vscode://file/${fileURLToPath(import.meta.url)}`

  return (
    <main className="flex min-h-dvh flex-col items-center justify-between bg-linear-to-b from-background via-background to-muted/40 px-4 py-12 md:px-6">
      <section className="flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-6 rounded-3xl border border-border/80 bg-card/70 px-6 py-12 text-center shadow-lg backdrop-blur-sm sm:px-10">
        <picture className="flex items-center justify-center">
          <source srcSet="https://raw.githubusercontent.com/payloadcms/payload/main/packages/ui/src/assets/payload-favicon.svg" />
          <Image
            alt="Payload Logo"
            height={65}
            src="https://raw.githubusercontent.com/payloadcms/payload/main/packages/ui/src/assets/payload-favicon.svg"
            width={65}
            className="h-16 w-16"
          />
        </picture>
        {!user && (
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Welcome to your new project.
          </h1>
        )}
        {user && (
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Welcome back, {user.email}
          </h1>
        )}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            href={payloadConfig.routes.admin}
            rel="noopener noreferrer"
            target="_blank"
          >
            Go to admin panel
          </a>
          <a
            className="inline-flex items-center justify-center rounded-lg border border-border px-5 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            href="https://payloadcms.com/docs"
            rel="noopener noreferrer"
            target="_blank"
          >
            Documentation
          </a>
        </div>
      </section>
      <footer className="mt-10 flex flex-col items-center gap-2 text-sm text-muted-foreground">
        <p>Update this page by editing</p>
        <a
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          href={fileURL}
        >
          <code>app/(frontend)/page.tsx</code>
        </a>
      </footer>
    </main>
  )
}
