import { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, UserRound, Zap } from 'lucide-react';
import Dashboard from './Dashboard.jsx';
import { request } from '../lib/api.js';

export default function MemberApp() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    request('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch((err) => {
        if (err.status !== 401) setError(err.message);
      })
      .finally(() => setChecking(false));
    const expired = () => {
      setUser(null);
      setNotice('Votre session a expiré. Reconnectez-vous.');
    };
    window.addEventListener('session-expired', expired);
    // Check again when returning to a tab, including logout from another tab.
    const visible = () => {
      if (document.visibilityState === 'visible')
        request('/api/auth/me')
          .then((data) => setUser(data.user))
          .catch((err) => {
            if (err.status === 401) setUser(null);
          });
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('session-expired', expired);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = { username: form.get('username'), pin: form.get('pin') };
    if (register) {
      data.name = form.get('name');
      if (data.pin !== form.get('confirmation'))
        return setError('Les deux codes doivent être identiques.');
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request(`/api/auth/${register ? 'register' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (register) {
        setRegister(false);
        setNotice('Votre compte est créé. Connectez-vous avec votre identifiant et votre code.');
      } else setUser(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await request('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setError('');
    setNotice('Vous êtes déconnecté.');
  }
  if (checking)
    return (
      <main className="auth-page theme-amber">
        <p role="status">Connexion à votre espace…</p>
      </main>
    );
  if (user) return <Dashboard key={user.id} user={user} onLogout={logout} onUserChange={setUser} />;
  return (
    <main className="auth-page theme-amber">
      <section className="auth-intro">
        <a className="brand" href="/" aria-label="CHRONO accueil">
          <span className="brand-mark">
            <Zap size={22} fill="currentColor" />
          </span>
          CHRONO<span className="brand-period">.</span>
        </a>
        <div className="eyebrow">
          <span className="accent-line" /> VOTRE ESPACE. VOTRE MISSION.
        </div>
        <h1>
          Le prochain chapitre
          <br />
          commence <em>maintenant.</em>
        </h1>
        <p>
          Vos objectifs, vos échéances et votre rythme.
          <br />
          Un centre de contrôle qui vous appartient.
        </p>
        <div className="auth-clock" aria-hidden="true">
          24<span>:</span>00<span>:</span>00
        </div>
        <span className="auth-caption">CHAQUE SECONDE VOUS RAPPROCHE.</span>
      </section>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-icon">
          <LockKeyhole size={24} />
        </div>
        <span className="eyebrow">ESPACE MEMBRE</span>
        <h2 id="auth-title">{register ? 'Créez votre compte.' : 'Heureux de vous revoir.'}</h2>
        <p>
          {register
            ? 'Un identifiant personnel et un code à quatre chiffres.'
            : 'Connectez-vous pour retrouver vos objectifs.'}
        </p>
        <div className="auth-tabs">
          <button
            type="button"
            aria-pressed={!register}
            onClick={() => {
              setRegister(false);
              setError('');
            }}
          >
            Connexion
          </button>
          <button
            type="button"
            aria-pressed={register}
            onClick={() => {
              setRegister(true);
              setError('');
            }}
          >
            Créer un compte
          </button>
        </div>
        <form key={register ? 'register' : 'login'} onSubmit={submit}>
          <fieldset disabled={busy}>
            {register && (
              <label>
                Votre nom
                <input
                  name="name"
                  autoComplete="name"
                  maxLength={60}
                  required
                  placeholder="Comment vous appeler ?"
                />
              </label>
            )}
            <label>
              Identifiant
              <input
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                pattern="[a-zA-Z0-9_.\-]{3,40}"
                minLength={3}
                maxLength={40}
                required
                placeholder="ex. alex.k"
                aria-describedby="username-help"
              />
            </label>
            <small id="username-help">
              3 à 40 caractères : lettres, chiffres, point, tiret ou souligné.
            </small>
            <label>
              Code personnel à 4 chiffres
              <input
                className="pin-input"
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete={register ? 'new-password' : 'current-password'}
                pattern="[0-9]{4}"
                minLength={4}
                maxLength={4}
                required
                placeholder="••••"
              />
            </label>
            {register && (
              <label>
                Confirmer le code
                <input
                  className="pin-input"
                  name="confirmation"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  required
                  placeholder="••••"
                />
              </label>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="auth-notice" role="status">
                {notice}
              </p>
            )}
            <button className="primary-button" type="submit">
              {busy ? 'Un instant…' : register ? 'Créer mon compte' : 'Accéder à mon espace'}
              <ArrowRight size={17} />
            </button>
          </fieldset>
        </form>
        <p className="auth-footnote">
          <UserRound size={14} /> Vos objectifs restent dans votre espace personnel.
        </p>
        <small>Code oublié ? Contactez l’administrateur du site.</small>
      </section>
    </main>
  );
}
