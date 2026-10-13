export async function api(path = '', options = {}) {
  const response = await fetch(`/api/objectives${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal || AbortSignal.timeout(10000),
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(data?.error || 'Le serveur ne répond pas. Réessayez dans un instant.');
  if (!data) throw new Error('Réponse du serveur invalide.');
  return data;
}
export function demoObjectives() {
  const now = new Date();
  const target = (days, hours) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hours, 0, 0, 0);
    return d.toISOString();
  };
  const created_at = new Date(now.getTime() - 24 * 86400000).toISOString();
  return [
    {
      title: 'Lancement du projet Horizon',
      description:
        'La dernière ligne droite. Finaliser les détails, aligner l’équipe et donner vie à la prochaine grande idée.',
      target_date: target(15, 9),
      category: 'Professionnel',
      color_theme: 'amber',
    },
    {
      title: 'Semi-marathon de la ville',
      description: '21,1 kilomètres. Un seul objectif : se dépasser.',
      target_date: target(24, 7),
      category: 'Sport',
      color_theme: 'emerald',
    },
    {
      title: 'Cap sur de nouveaux horizons',
      description: 'Tout est prêt pour la prochaine aventure.',
      target_date: target(45, 14),
      category: 'Personnel',
      color_theme: 'cyan',
    },
    {
      title: 'Certification en design UX',
      description: 'Dernière étape du parcours de formation.',
      target_date: target(64, 10),
      category: 'Formation',
      color_theme: 'amber',
    },
  ].map((item) => ({ ...item, id: crypto.randomUUID(), created_at }));
}
