import Link from 'next/link'

const DEFAULT_CONTENT = {
  title: 'Access Restricted',
  message: 'Your account does not currently have access to this application.',
  guidance: 'If you believe this is a mistake, please reach out to your administrator.',
  supportCode: 'ACCESS_RESTRICTED',
}

const resolveParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value ?? ''

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ErrorPage({ searchParams }: PageProps) {
  const params = await searchParams
  const code = resolveParam(params?.code)
  const redirectTarget = resolveParam(params?.redirect)
  const content = (() => {
    if (code) {
      return {
        ...DEFAULT_CONTENT,
        supportCode: DEFAULT_CONTENT.supportCode,
      }
    }

    return {
      ...DEFAULT_CONTENT,
      supportCode: undefined,
    }
  })()

  const signInUrl = redirectTarget
    ? `/auth/sign-in?redirect=${encodeURIComponent(redirectTarget)}`
    : '/auth/sign-in'

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-linear-to-b from-background via-background to-muted/40 px-6 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-border/80 bg-card/80 px-8 py-10 text-center shadow-xl backdrop-blur">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-3xl font-semibold text-amber-600">
          <span className="leading-none">!</span>
        </div>
        <h1 className="text-3xl font-semibold text-foreground">{content.title}</h1>
        <p className="mt-4 text-base text-muted-foreground">{content.message}</p>
        {content.guidance ? (
          <p className="mt-3 text-sm text-muted-foreground/80">{content.guidance}</p>
        ) : null}
        <div className="mt-8 flex justify-center">
          <Link
            href={signInUrl}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Return to Application
          </Link>
        </div>
        {content.supportCode ? (
          <>
            <hr className="my-8 border-border/70" />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
              Support Code: {content.supportCode}
            </p>
          </>
        ) : null}
      </section>
    </main>
  )
}
