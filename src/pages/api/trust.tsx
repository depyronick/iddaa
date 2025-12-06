import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  let trustHostHeader: boolean | null = null;
  let error: string | undefined;

  try {
    const requiredPath = path.join(
      process.cwd(),
      ".next",
      "required-server-files.json"
    );
    const required = JSON.parse(fs.readFileSync(requiredPath, "utf8"));
    trustHostHeader = Boolean(required?.config?.experimental?.trustHostHeader);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  res.status(200).json({
    trustHostHeader,
    env: {
      NOW_BUILDER: process.env.NOW_BUILDER ?? null,
      VERCEL: process.env.VERCEL ?? null,
    },
    error,
  });
}
