  import type { NextApiRequest, NextApiResponse } from 'next'

  // Loads the built config at runtime and reports the flag plus the Vercel env.
  export default async function handler(
    _req: NextApiRequest,
    res: NextApiResponse
  ) {
    let trustHostHeader: unknown = 'unresolved'
    let error: string | undefined

    try {
      const { default: loadConfig } = await import('next/dist/server/config')
      const { PHASE_PRODUCTION_BUILD } = await import('next/constants')

      const cfg = await loadConfig(PHASE_PRODUCTION_BUILD, process.cwd(), null)
      trustHostHeader = cfg?.experimental?.trustHostHeader ?? false
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }

    res.status(200).json({
      trustHostHeader,
      env: {
        NOW_BUILDER: process.env.NOW_BUILDER ?? null,
        VERCEL: process.env.VERCEL ?? null,
      },
      error,
    })
  }
