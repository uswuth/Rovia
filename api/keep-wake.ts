/**
 * Keep the Render API awake.
 *
 * Render's free tier spins an idle web service down after 15 minutes and needs
 * roughly 50 seconds to wake. A judge opening a shared demo link would hit that
 * wait, and an open Socket.io connection is not enough to hold it awake on every
 * plan. A cron ping from Vercel does it for free.
 *
 * This runs on Vercel's cron schedule (every 10 minutes, below the spin-down
 * window). A failed ping is deliberately swallowed: the service sleeping is the
 * thing being prevented, so a transient network error must not fail the job and
 * make Vercel retry.
 *
 * Set RENDER_API_URL to the Render service root, e.g.
 * https://intellmeet-api.onrender.com
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const TIMEOUT_MS = 8_000;

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const baseUrl = process.env.RENDER_API_URL;
  if (!baseUrl) {
    // Misconfiguration, not a wake failure. Say so plainly so it is visible in
    // the Vercel logs instead of looking like a silent no-op.
    return res.status(500).json({ ok: false, error: 'RENDER_API_URL is not set' });
  }

  const healthUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/health`;

  try {
    const response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'intellmeet-keep-awake' },
    });

    return res.status(200).json({
      ok: response.ok,
      status: response.status,
      // The health endpoint returns no version or host details by design, so
      // only the status code is echoed back here.
      url: healthUrl,
    });
  } catch {
    // Swallowed on purpose: see the note above.
    return res.status(200).json({ ok: false, error: 'wake ping failed' });
  }
}