  import type { NextApiRequest, NextApiResponse } from 'next'

  export default async function handler(
    _req: NextApiRequest,
    res: NextApiResponse
  ) {
    let trustHostHeader: boolean | null = null
    let error: string | undefined

    try {
      const { default: loadConfig } = await import('next/dist/server/config')
      const { PHASE_PRODUCTION_BUILD } = await import('next/constants')

      const cfg = await loadConfig(PHASE_PRODUCTION_BUILD, process.cwd(), {
        silent: true, // optional; just keeps logs clean
      })

      trustHostHeader = !!cfg.experimental?.trustHostHeader
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
