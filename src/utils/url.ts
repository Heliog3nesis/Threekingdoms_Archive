export const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function url(path: string) {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}