import { getPayload } from 'payload'
import config from '../payload.config'
import { seed } from './index'

async function main(): Promise<void> {
  const payload = await getPayload({
    config,
    disableOnInit: true,
  })

  try {
    await seed(payload)
  } finally {
    await payload.destroy()
  }
}

await main()
