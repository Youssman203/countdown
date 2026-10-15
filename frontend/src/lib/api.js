export async function api(path = '', options = {}) {
  return request(`/api/objectives${path}`, options);
}
export async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal || AbortSignal.timeout(10000),
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (
      response.status === 401 &&
      (path.startsWith('/api/objectives') || options.method === 'PATCH')
    )
      window.dispatchEvent(new Event('session-expired'));
    const error = new Error(data?.error || 'Le serveur ne répond pas. Réessayez dans un instant.');
    error.status = response.status;
    throw error;
  }
  if (!data) throw new Error('Réponse du serveur invalide.');
  return data;
}
