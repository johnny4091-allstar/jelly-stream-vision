// Receives crash reports from the News Hammer app's recovery screen (the user taps "Send crash
// report"). Each report holds only the error, the app version and the Android version; it's
// written to the function log, where it can be read from the Netlify dashboard (Logs > Functions).

const MAX_FIELD = 6000;

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response('Bad report', { status: 400 });
  }
  const field = (k: string) => String(body[k] ?? '').slice(0, MAX_FIELD);
  console.log(
    `[crash-report] ${JSON.stringify({
      at: new Date().toISOString(),
      version: field('version'),
      android: field('android'),
      where: field('where'),
      message: field('message'),
      stack: field('stack'),
    })}`,
  );
  return Response.json({ ok: true });
};

export const config = { path: '/api/crash', method: 'POST' };
