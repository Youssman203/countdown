import { ChevronLeft, ChevronRight, Plus, ArrowUpRight } from 'lucide-react';
import { dayKey, dateLabel, timeLabel } from '../lib/time.js';

export default function CalendarView({
  objectives,
  month,
  setMonth,
  selected,
  setSelected,
  onAdd,
  onEdit,
  expanded = false,
}) {
  const year = month.getFullYear(),
    m = month.getMonth();
  const offset = (new Date(year, m, 1).getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => new Date(year, m, i - offset + 1));
  const today = dayKey(new Date());
  const selectedItems = objectives.filter((item) => dayKey(item.target_date) === selected);
  const upcoming = objectives
    .filter((item) => new Date(item.target_date) > Date.now())
    .sort((a, b) => new Date(a.target_date) - new Date(b.target_date))
    .slice(0, 3);
  const items = selected ? selectedItems : upcoming;
  return (
    <section className={`calendar-panel ${expanded ? 'expanded-calendar' : ''}`}>
      <div className="panel-title">
        <h2>Calendrier</h2>
        <span className="eyebrow">VOS ÉCHÉANCES</span>
      </div>
      <div className="month-nav">
        <h3>{month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h3>
        <div>
          <button
            className="icon-button"
            aria-label="Mois précédent"
            onClick={() => setMonth(new Date(year, m - 1, 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Mois suivant"
            onClick={() => setMonth(new Date(year, m + 1, 1))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="calendar-grid weekdays">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
          <span key={i}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((day) => {
          const key = dayKey(day),
            events = objectives.filter((item) => dayKey(item.target_date) === key);
          return (
            <button
              key={key}
              className={`calendar-day ${day.getMonth() !== m ? 'outside' : ''} ${key === today ? 'today' : ''} ${key === selected ? 'selected' : ''}`}
              onClick={() => setSelected(key)}
              aria-label={`${dateLabel(day, { month: 'long', year: 'numeric' })}, ${events.length} objectif(s)`}
              aria-pressed={key === selected}
            >
              <span>{day.getDate()}</span>
              <div className="day-dots">
                {events.slice(0, 3).map((item) => (
                  <i key={item.id} className={`theme-${item.color_theme}`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span>
          <i />
          Échéance
        </span>
        <button
          onClick={() => {
            setMonth(new Date());
            setSelected(today);
          }}
        >
          Aujourd’hui
        </button>
      </div>
      <div className="upcoming-header">
        <h3>{selected ? dateLabel(`${selected}T12:00:00`, { month: 'long' }) : 'À l’horizon'}</h3>
        {selected ? (
          <button className="text-button" onClick={() => setSelected(null)}>
            Tout voir
          </button>
        ) : (
          <span>PROCHAINEMENT</span>
        )}
      </div>
      <div className="upcoming-list">
        {items.map((item) => (
          <button
            key={item.id}
            className={`upcoming-item theme-${item.color_theme}`}
            onClick={() => onEdit(item)}
          >
            <div className="date-box">
              <strong>{new Date(item.target_date).getDate()}</strong>
              <small>
                {new Date(item.target_date).toLocaleDateString('fr-FR', { month: 'short' })}
              </small>
            </div>
            <div>
              <strong>{item.title}</strong>
              <span>
                {item.category} <i>·</i> {timeLabel(item.target_date)}
              </span>
            </div>
            <ArrowUpRight size={14} />
          </button>
        ))}
        {items.length === 0 && (
          <p className="calendar-empty">
            Aucun objectif à cette date.
            <br />
            De la place pour votre prochaine ambition.
          </p>
        )}
      </div>
      <button className="calendar-add" onClick={() => onAdd(selected)}>
        <Plus size={15} />
        Planifier un objectif
      </button>
    </section>
  );
}
