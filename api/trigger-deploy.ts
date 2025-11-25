// /Users/dp/Desktop/my-watermark/api/trigger-deploy.ts
export default async function handler(req: any, res: any) {
  const url = process.env.VERCEL_BUILD_HOOK_URL;
  if (!url) {
    res.status(500).json({ ok: false, error: "VERCEL_BUILD_HOOK_URL not set" });
    return;
  }
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  res.status(r.ok ? 200 : 500).json({ ok: r.ok });
}
