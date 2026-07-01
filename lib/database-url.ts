/**
 * When the app runs inside Docker, DATABASE_URL often still points at localhost
 * (from .env copied from the dev machine). Inside the container, localhost is not the host OS.
 * If DOCKER_PG_HOST is set (e.g. host.docker.internal), replace localhost / 127.0.0.1 with that host.
 */
export function resolveDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  const dockerHost = process.env.DOCKER_PG_HOST?.trim();
  if (!dockerHost) return raw;

  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') {
      u.hostname = dockerHost;
      return u.href;
    }
    return raw;
  } catch {
    /* URL() can fail if the password contains @ or other special chars */
  }

  if (/@localhost(:\d+|\/)|@127\.0\.0\.1(:\d+|\/)/i.test(raw)) {
    return raw
      .replace(/@localhost(?=:\d+|\/)/gi, `@${dockerHost}`)
      .replace(/@127\.0\.0\.1(?=:\d+|\/)/g, `@${dockerHost}`);
  }

  return raw;
}
