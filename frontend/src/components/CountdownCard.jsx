import { ArrowUpRight, CalendarDays, Flag, Pencil, Radio, Timer } from 'lucide-react';
import { countdown, dateLabel, progress, timeLabel } from '../lib/time.js';

const segments = [
  'abcdef',
  'bc',
  'abdeg',
  'abcdg',
  'bcfg',
  'acdfg',
  'acdefg',
  'abc',
  'abcdefg',
  'abcdfg',
];
const paths = {
  a: '8,2 36,2 40,6 35,10 9,10 4,6',
  b: '38,9 42,5 42,32 38,36 34,32 34,13',
  c: '38,40 42,44 42,71 38,75 34,70 34,45',
  d: '9,70 35,70 40,75 36,79 8,79 4,75',
  e: '2,44 6,40 10,45 10,70 6,75 2,71',
  f: '2,5 6,9 10,13 10,32 6,36 2,32',
  g: '9,35 35,35 39,40 35,44 9,44 5,40',
};
function Digit({ value }) {
  return (
    <svg viewBox="0 0 44 81" aria-hidden="true">
      {Object.entries(paths).map(([key, points]) => (
        <polygon
          key={key}
          points={points}
          fill="currentColor"
          opacity={segments[Number(value)].includes(key) ? 1 : 0.045}
        />
      ))}
    </svg>
  );
}
export function Countdown({ target, now, digital = false }) {
  const values = countdown(target, now);
  return (
    <div
      className={`countdown ${digital ? 'digital' : ''}`}
      role="timer"
      aria-label={values
        .map((v, i) => `${v} ${['jours', 'heures', 'minutes', 'secondes'][i]}`)
        .join(', ')}
    >
      {values.map((value, i) => (
        <div className="time-unit" key={i}>
          <div className="time-value">
            {digital
              ? String(value)
                  .padStart(2, '0')
                  .split('')
                  .map((n, index) => <Digit key={index} value={n} />)
              : String(value).padStart(2, '0')}
          </div>
          <span className="time-label">{['Jours', 'Heures', 'Minutes', 'Secondes'][i]}</span>
        </div>
      ))}
    </div>
  );
}
export default function CountdownCard({ objective, now, master = false, onEdit }) {
  const remaining = new Date(objective.target_date) - now;
  const expired = remaining <= 0;
  const urgent = !expired && remaining < 48 * 3600000;
  const percent = progress(objective, now);
  return (
    <article
      className={`countdown-card theme-${objective.color_theme} ${master ? 'master-card' : ''} ${urgent ? 'urgent' : ''}`}
    >
      {master && (
        <div className="master-kicker">
          <span>
            <Radio size={14} /> OBJECTIF PRIORITAIRE
          </span>
          <span className="live-chip">
            <i /> EN DIRECT
          </span>
        </div>
      )}
      <div className="card-heading">
        <div>
          {!master && (
            <div className="card-symbol">
              <Flag size={17} />
            </div>
          )}
          <span className="category-pill">
            <i />
            {objective.category}
          </span>
          <h2>{objective.title}</h2>
        </div>
        <button
          className="icon-button"
          title="Modifier l’objectif"
          aria-label={`Modifier ${objective.title}`}
          onClick={() => onEdit(objective)}
        >
          {master ? <ArrowUpRight size={22} /> : <Pencil size={15} />}
        </button>
      </div>
      {master && (
        <p className="master-description">
          {objective.description || 'Un objectif clair. Chaque seconde vous en rapproche.'}
        </p>
      )}
      {master && (
        <div className="target-line">
          <CalendarDays size={14} />
          {dateLabel(objective.target_date, { year: 'numeric' })}
          <span>·</span>
          {timeLabel(objective.target_date)}
          <span className="timezone">heure locale</span>
        </div>
      )}
      <Countdown target={objective.target_date} now={now} digital={master} />
      <div className="progress-meta">
        <span>
          {expired ? (
            'Échéance atteinte'
          ) : urgent ? (
            <>
              <Timer size={12} /> Moins de 48 heures
            </>
          ) : (
            'Temps écoulé'
          )}
        </span>
        <span>
          {Math.floor(percent)}
          <small> %</small>
        </span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Temps écoulé"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(percent)}
      >
        <div style={{ width: `${percent}%` }} />
      </div>
      <div className="card-footer">
        {master ? (
          <>
            <span>
              <i className="status-dot" />{' '}
              {urgent ? 'Dernière ligne droite' : 'Le compte à rebours est lancé'}
            </span>
            <span>RESTEZ CONCENTRÉ.</span>
          </>
        ) : (
          <>
            <span>
              <CalendarDays size={13} />
              {dateLabel(objective.target_date, { year: 'numeric' })}
            </span>
            <span>
              {timeLabel(objective.target_date)} <ArrowUpRight size={13} />
            </span>
          </>
        )}
      </div>
    </article>
  );
}
