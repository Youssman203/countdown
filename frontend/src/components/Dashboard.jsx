import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownWideNarrow,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Command,
  Flag,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  Radio,
  Search,
  Target,
  Timer,
  X,
  Zap,
} from 'lucide-react';
import CountdownCard from './CountdownCard.jsx';
import CalendarView from './CalendarView.jsx';
import AddEditModal from './AddEditModal.jsx';
import { api, demoObjectives } from '../lib/api.js';

const DEMO_KEY = 'chrono-demo-v1';
export default function Dashboard() {
  const [objectives, setObjectives] = useState([]),
    [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [demo, setDemo] = useState(false);
  const [view, setView] = useState('dashboard'),
    [category, setCategory] = useState('Tous'),
    [search, setSearch] = useState(''),
    [sort, setSort] = useState('nearest');
  const [month, setMonth] = useState(new Date()),
    [selected, setSelected] = useState(null),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState('');
  const [accent, setAccent] = useState(() => {
    try {
      return localStorage.getItem('chrono-accent') || 'amber';
    } catch {
      return 'amber';
    }
  });
  const [help, setHelp] = useState(false);
  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api();
      setObjectives(data);
      setDemo(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(''), 4500);
      return () => clearTimeout(timeout);
    }
  }, [toast]);
  function startDemo() {
    let data;
    try {
      const saved = JSON.parse(localStorage.getItem(DEMO_KEY));
      if (
        Array.isArray(saved) &&
        saved.every(
          (item) =>
            item &&
            typeof item.title === 'string' &&
            typeof item.category === 'string' &&
            typeof item.id === 'string' &&
            ['amber', 'cyan', 'emerald'].includes(item.color_theme) &&
            Number.isFinite(Date.parse(item.target_date)) &&
            Number.isFinite(Date.parse(item.created_at)),
        )
      )
        data = saved;
    } catch {
      /* storage may be unavailable */
    }
    setObjectives(data || demoObjectives());
    setDemo(true);
    setError('');
  }
  const active = useMemo(
    () =>
      objectives
        .filter((o) => new Date(o.target_date) > now)
        .sort((a, b) => new Date(a.target_date) - new Date(b.target_date)),
    [objectives, now],
  );
  const elapsed = objectives.length - active.length;
  const urgent = active.filter((o) => new Date(o.target_date) - now < 48 * 3600000).length;
  const categories = [...new Set(objectives.map((o) => o.category))];
  const filtered = useMemo(() => {
    const source =
      view === 'elapsed' ? objectives.filter((o) => new Date(o.target_date) <= now) : active;
    return source
      .filter(
        (o) =>
          (category === 'Tous' || o.category === category) &&
          `${o.title} ${o.description}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
      )
      .sort((a, b) =>
        sort === 'name'
          ? a.title.localeCompare(b.title, 'fr')
          : sort === 'latest'
            ? new Date(b.target_date) - new Date(a.target_date)
            : new Date(a.target_date) - new Date(b.target_date),
      );
  }, [active, objectives, view, category, search, sort, now]);
  const master =
    view === 'dashboard'
      ? [...filtered].sort((a, b) => new Date(a.target_date) - new Date(b.target_date))[0]
      : null;
  const cards = master ? filtered.filter((item) => item.id !== master.id) : filtered;
  function persistDemo(next) {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(next));
    } catch {
      throw new Error('Le stockage local est indisponible. Activez-le pour enregistrer la démo.');
    }
    setObjectives(next);
  }
  async function save(data, id) {
    if (demo) {
      const item = {
        ...data,
        id: id || crypto.randomUUID(),
        created_at: id ? objectives.find((o) => o.id === id).created_at : new Date().toISOString(),
      };
      persistDemo(id ? objectives.map((o) => (o.id === id ? item : o)) : [...objectives, item]);
    } else {
      const item = await api(id ? `/${id}` : '', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(data),
      });
      setObjectives((previous) =>
        id ? previous.map((o) => (o.id === id ? item : o)) : [...previous, item],
      );
    }
    setToast(id ? 'Objectif mis à jour.' : 'Le compte à rebours est lancé.');
  }
  async function remove(id) {
    if (demo) persistDemo(objectives.filter((o) => o.id !== id));
    else {
      await api(`/${id}`, { method: 'DELETE' });
      setObjectives((previous) => previous.filter((o) => o.id !== id));
    }
    setToast('Objectif supprimé.');
  }
  function changeView(next) {
    setView(next);
    setCategory('Tous');
    setSearch('');
  }
  function changeAccent(value) {
    setAccent(value);
    try {
      localStorage.setItem('chrono-accent', value);
    } catch {
      /* session preference remains usable */
    }
  }
  const add = (date = null) => setModal({ selectedDate: date });
  const edit = (objective) => setModal({ objective });
  return (
    <div className={`app theme-${accent}`}>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            changeView('dashboard');
          }}
          aria-label="CHRONO accueil"
        >
          <span className="brand-mark">
            <Zap size={22} fill="currentColor" />
          </span>
          CHRONO<span className="brand-period">.</span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">P</span>
          <div>
            Espace personnel<small>CENTRE DE CONTRÔLE</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <span className="nav-caption">VOTRE ESPACE</span>
        <nav>
          {[
            ['dashboard', LayoutDashboard, 'Vue d’ensemble', null],
            ['objectives', Flag, 'Mes objectifs', active.length],
            ['calendar', CalendarDays, 'Calendrier', null],
            ['elapsed', Check, 'Échéances passées', elapsed],
          ].map(([key, Icon, label, count]) => (
            <button
              aria-label={label}
              title={label}
              aria-current={view === key ? 'page' : undefined}
              className={view === key ? 'active' : ''}
              key={key}
              onClick={() => changeView(key)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {count !== null && <small>{String(count).padStart(2, '0')}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="orbit-icon">
            <Target size={28} />
          </div>
          <p>
            Les grandes choses
            <br />
            commencent par un cap.
          </p>
          <span>
            Faites de chaque seconde
            <br />
            un pas vers votre objectif.
          </span>
          <button onClick={() => add()}>
            Définir un objectif <ArrowRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="theme-selector">
            <span>AMBIANCE</span>
            <div>
              {['amber', 'cyan', 'emerald'].map((color) => (
                <button
                  key={color}
                  className={`theme-${color} ${accent === color ? 'selected' : ''}`}
                  aria-label={`Thème ${color}`}
                  aria-pressed={accent === color}
                  onClick={() => changeAccent(color)}
                />
              ))}
            </div>
          </div>
          <button className="help-button" onClick={() => setHelp(!help)}>
            <CircleHelp size={17} /> Guide de mission <ArrowUpRightIcon />
          </button>
          <div className="profile">
            <span>OP</span>
            <div>
              Opérateur personnel<small>Un objectif à la fois.</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Espace personnel <ChevronRight size={13} />
            <strong>
              {
                {
                  dashboard: 'Vue d’ensemble',
                  objectives: 'Mes objectifs',
                  calendar: 'Calendrier',
                  elapsed: 'Échéances passées',
                }[view]
              }
            </strong>
          </div>
          <div className="topbar-right">
            <span className={`connection ${error ? 'offline' : ''}`}>
              <i />
              {loading
                ? 'CONNEXION'
                : demo
                  ? 'DÉMO LOCALE'
                  : error
                    ? 'HORS LIGNE'
                    : 'SYSTÈME CONNECTÉ'}
            </span>
            <span className="header-time">{new Date(now).toLocaleTimeString('fr-FR')}</span>
            <span className="header-avatar">OP</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="accent-line" /> VOTRE TEMPS. VOS AMBITIONS.
              </div>
              <h1>
                {view === 'calendar'
                  ? 'Gardez le cap.'
                  : view === 'elapsed'
                    ? 'Le chemin parcouru.'
                    : view === 'objectives'
                      ? 'Donnez vie à vos objectifs.'
                      : 'Chaque seconde compte.'}
              </h1>
              <p>Un regard sur vos objectifs. Une longueur d’avance sur demain.</p>
            </div>
            <button className="primary-button" onClick={() => add()} disabled={loading || !!error}>
              <Plus size={17} />
              Nouvel objectif
            </button>
          </div>
          {demo && (
            <div className="demo-banner">
              <span>
                <Radio size={14} /> Mode démo · vos modifications sont enregistrées dans ce
                navigateur.
              </span>
              <button onClick={load}>
                Connecter PostgreSQL <ArrowRight size={13} />
              </button>
            </div>
          )}
          {help && (
            <div className="help-panel">
              <button
                className="icon-button"
                aria-label="Fermer le guide"
                onClick={() => setHelp(false)}
              >
                <X size={16} />
              </button>
              <strong>Votre guide de mission</strong>
              <p>
                Créez un objectif avec une date et une heure locales. L’objectif actif le plus
                proche devient prioritaire. Cliquez sur une date du calendrier pour la planifier, ou
                sur le crayon pour modifier et supprimer. À moins de 48 heures, une alerte lumineuse
                s’active. Les échéances atteintes restent accessibles dans « Échéances passées ».
              </p>
            </div>
          )}
          <div className="stats-grid">
            {[
              [Flag, 'Objectifs actifs', active.length, 'À vous de jouer', 'accent'],
              [
                Timer,
                'Dans les 48 heures',
                urgent,
                urgent ? 'Dernière ligne droite' : 'Tout est sous contrôle',
                '',
              ],
              [Check, 'Échéances atteintes', elapsed, 'Votre parcours continue', ''],
              [
                CalendarDays,
                'Prochaine échéance',
                active[0]
                  ? new Date(active[0].target_date).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                    })
                  : '—',
                active[0]?.category || 'À définir',
                'date-stat',
              ],
            ].map(([Icon, label, value, caption, cls]) => (
              <div className={`stat ${cls}`} key={label}>
                <div>
                  <span>{label}</span>
                  <Icon size={16} />
                </div>
                <strong>
                  {typeof value === 'number' ? String(value).padStart(2, '0') : value}
                </strong>
                <small>{caption}</small>
              </div>
            ))}
          </div>
          {loading ? (
            <div className="state-panel">
              <LoaderCircle className="spin" size={26} />
              <h2>Synchronisation des objectifs…</h2>
            </div>
          ) : error ? (
            <div className="state-panel">
              <Activity size={30} />
              <h2>Connectons votre centre de contrôle.</h2>
              <p>{error}</p>
              <div>
                <button className="primary-button" onClick={load}>
                  Réessayer
                </button>
                <button className="secondary-button" onClick={startDemo}>
                  Explorer la démo
                </button>
              </div>
            </div>
          ) : (
            <>
              {view !== 'calendar' && (
                <div className="filter-bar">
                  <div className="filter-tabs">
                    <button
                      className={category === 'Tous' ? 'active' : ''}
                      onClick={() => setCategory('Tous')}
                    >
                      Tous les objectifs{' '}
                      <small>{view === 'elapsed' ? elapsed : active.length}</small>
                    </button>
                    <select
                      aria-label="Filtrer par catégorie"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="Tous">Toutes les catégories</option>
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-tools">
                    <label className="search-box">
                      <Search size={14} />
                      <input
                        aria-label="Rechercher un objectif"
                        placeholder="Rechercher…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <label className="sort-box">
                      <ArrowDownWideNarrow size={14} />
                      <select
                        aria-label="Trier les objectifs"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="nearest">Échéance proche</option>
                        <option value="latest">Échéance lointaine</option>
                        <option value="name">Titre A–Z</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}
              <div className={`dashboard-layout ${view === 'calendar' ? 'calendar-only' : ''}`}>
                {view !== 'calendar' && (
                  <div className="objectives-column">
                    {master && <CountdownCard objective={master} now={now} master onEdit={edit} />}
                    {cards.length > 0 && (
                      <>
                        <div className="section-heading">
                          <h2>
                            {master
                              ? 'Et après ?'
                              : view === 'elapsed'
                                ? 'Vos échéances passées'
                                : 'Vos objectifs'}
                          </h2>
                          <span>
                            {cards.length} OBJECTIF{cards.length > 1 ? 'S' : ''}
                          </span>
                        </div>
                        <div className="cards-grid">
                          {cards.map((item) => (
                            <CountdownCard key={item.id} objective={item} now={now} onEdit={edit} />
                          ))}
                        </div>
                      </>
                    )}
                    {!filtered.length && (
                      <div className="state-panel empty-state">
                        <Target size={34} />
                        <h2>
                          {search || category !== 'Tous'
                            ? 'Aucun objectif trouvé.'
                            : view === 'elapsed'
                              ? 'L’histoire reste à écrire.'
                              : 'Tout commence par un objectif.'}
                        </h2>
                        <p>
                          {search || category !== 'Tous'
                            ? 'Essayez une autre recherche ou catégorie.'
                            : view === 'elapsed'
                              ? 'Vos échéances atteintes apparaîtront ici.'
                              : 'Donnez une date à votre prochaine ambition.'}
                        </p>
                        {view !== 'elapsed' && (
                          <button className="secondary-button" onClick={() => add()}>
                            <Plus size={16} />
                            Créer un objectif
                          </button>
                        )}
                      </div>
                    )}
                    {view !== 'elapsed' && (
                      <button className="add-card" onClick={() => add()}>
                        <span>
                          <Plus size={17} />
                        </span>
                        <div>
                          Une nouvelle ambition ?<small>Donnez-lui une échéance.</small>
                        </div>
                        <ArrowRight size={17} />
                      </button>
                    )}
                  </div>
                )}
                <CalendarView
                  objectives={objectives}
                  month={month}
                  setMonth={setMonth}
                  selected={selected}
                  setSelected={setSelected}
                  onAdd={add}
                  onEdit={edit}
                  expanded={view === 'calendar'}
                />
              </div>
            </>
          )}
          <footer className="page-footer">
            <span>
              <Command size={12} /> CHRONO <i>/</i> LE TEMPS PREND TOUT SON SENS.
            </span>
            <span>
              <i className="status-dot" /> PRÉCISION À LA SECONDE
            </span>
          </footer>
        </main>
      </div>
      {modal && (
        <AddEditModal
          objective={modal.objective}
          selectedDate={modal.selectedDate}
          onClose={() => setModal(null)}
          onSave={save}
          onDelete={remove}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button aria-label="Fermer la notification" onClick={() => setToast('')}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={13} className="help-arrow" />;
}
