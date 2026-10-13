import { useEffect, useRef, useState } from 'react';
import { X, Flag, Trash2, ArrowRight, LoaderCircle } from 'lucide-react';
import { localInput } from '../lib/time.js';

export default function AddEditModal({ objective, selectedDate, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => ({
    title: objective?.title || '',
    description: objective?.description || '',
    target_date: objective
      ? localInput(objective.target_date)
      : `${selectedDate || localInput(new Date(Date.now() + 86400000)).slice(0, 10)}T09:00:00`,
    category: objective?.category || 'Personnel',
    color_theme: objective?.color_theme || 'amber',
  }));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    dialog.querySelector('input[name="title"]')?.focus();
    return () => {
      dialog.close();
      previouslyFocused?.focus();
    };
  }, []);
  const update = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    values.title = values.title.trim();
    values.category = values.category.trim();
    values.description = values.description.trim();
    if (!values.title || !values.category) {
      setError('Le titre et la catégorie ne peuvent pas être vides.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave(
        {
          ...values,
          color_theme: form.color_theme,
          target_date: new Date(values.target_date).toISOString(),
        },
        objective?.id,
      );
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError('');
    try {
      await onDelete(objective.id);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="objective-dialog"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="modal-top">
          <span className="modal-icon">
            <Flag size={21} />
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fermer"
          >
            <X size={21} />
          </button>
        </div>
        <span className="eyebrow">CHAQUE AMBITION A SON ÉCHÉANCE</span>
        <h2 id="modal-title">{objective ? 'Ajuster votre objectif.' : 'Le prochain chapitre.'}</h2>
        <p className="modal-intro">Définissez votre cap. Nous comptons les secondes.</p>
        <fieldset disabled={busy}>
          <label>
            Titre de l’objectif
            <input
              name="title"
              value={form.title}
              onChange={update}
              required
              maxLength={120}
              placeholder="Qu’allez-vous accomplir ?"
              autoFocus
            />
          </label>
          <label>
            Description <span className="optional">facultatif</span>
            <textarea
              name="description"
              value={form.description}
              onChange={update}
              maxLength={2000}
              rows={3}
              placeholder="Quelques mots pour garder le cap…"
            />
          </label>
          <div className="form-row">
            <label>
              Échéance exacte
              <input
                type="datetime-local"
                name="target_date"
                step="1"
                defaultValue={form.target_date}
                required
              />
            </label>
            <label>
              Catégorie
              <input
                name="category"
                list="categories"
                maxLength={60}
                value={form.category}
                onChange={update}
                required
              />
              <datalist id="categories">
                {['Personnel', 'Professionnel', 'Sport', 'Formation', 'Voyage'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </datalist>
            </label>
          </div>
          <p className="timezone-note">
            Heure locale · {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </p>
          <label>Couleur de l’objectif</label>
          <div className="color-options">
            {[
              ['amber', 'Ambre'],
              ['cyan', 'Cyan'],
              ['emerald', 'Émeraude'],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={`theme-${value} ${form.color_theme === value ? 'chosen' : ''}`}
                aria-pressed={form.color_theme === value}
                onClick={() => setForm({ ...form, color_theme: value })}
              >
                <i />
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {confirmDelete && (
          <div className="delete-confirm">
            <p>Supprimer définitivement cet objectif ?</p>
            <button type="button" disabled={busy} onClick={remove}>
              Oui, supprimer
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>
              Annuler
            </button>
          </div>
        )}
        <div className="modal-actions">
          {objective ? (
            <button
              type="button"
              className="delete-button"
              aria-label="Supprimer l’objectif"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={17} />
            </button>
          ) : (
            <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>
              Annuler
            </button>
          )}
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? <LoaderCircle size={17} className="spin" /> : null}
            {objective ? 'Enregistrer les modifications' : 'Lancer le compte à rebours'}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </dialog>
  );
}
