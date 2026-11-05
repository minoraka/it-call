import { useState, useEffect, useRef } from 'react';
import { api } from './api';
import { makeT, categoryLabel, detectLang } from './i18n';
import './App.css';

const POLL_MS = 5000;
const emptyForm = { teacher: '', room: '', category: '', text: '' };

const beep = () => {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const o = c.createOscillator();
    o.connect(c.destination); o.frequency.value = 880; o.start(); o.stop(c.currentTime + 0.3);
  } catch { /* звук недоступен */ }
};

const Svg = ({ size = 18, children }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const BellIcon = () => <Svg><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></Svg>;
const SearchIcon = () => <Svg size={16}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Svg>;
const GridIcon = () => <Svg size={16}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Svg>;
const ListIcon = () => <Svg size={16}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Svg>;
const ChevronIcon = () => <span className="chev"><Svg size={16}><path d="m9 18 6-6-6-6" /></Svg></span>;
const MoonIcon = () => <Svg><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></Svg>;
const SunIcon = () => <Svg><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></Svg>;

function App() {
  const [lang, setLang] = useState(detectLang);
  const [theme, setTheme] = useState(() => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'));
  const [role, setRole] = useState('teacher');
  const [techs, setTechs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rooms, setRooms] = useState([]);     
  const [tickets, setTickets] = useState([]); 
  const [techId, setTechId] = useState(null);
  const [loadError, setLoadError] = useState(''); 
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [onlyBad, setOnlyBad] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');       
  const [toast, setToast] = useState('');
  const [sending, setSending] = useState(false);
  const toastTimer = useRef(null);

  const t = makeT(lang);
  const cat = (c) => categoryLabel(lang, c);
  const langRef = useRef(lang); 

 
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('it-theme', theme); } catch { /* ignore */ }
  }, [theme]);
  useEffect(() => {
    langRef.current = lang;
    document.documentElement.lang = lang;
    document.title = makeT(lang)('title');
    try { localStorage.setItem('it-lang', lang); } catch { /* ignore */ }
  }, [lang]);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  };


  const errKey = (err) => (err.status === 409 ? 'err.conflict' : err.status ? 'err.invalid' : 'err.network');

  const time = (ts) => new Date(ts).toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit' });


  useEffect(() => {
    Promise.all([api.technicians(), api.categories()])
      .then(([tc, c]) => {
        setTechs(tc);
        setCategories(c);
        setTechId((cur) => cur ?? tc[0]?.id ?? null);
      })
      .catch(() => setLoadError('err.server'));
  }, []);

  
  useEffect(() => {
    if (role === 'tech' && techId == null) return;
    let stopped = false;
    let known = null; 

    const tick = async () => {
      try {
        if (role === 'teacher') {
          const next = await api.rooms();
          if (!stopped) { setRooms(next); setLoadError(''); }
        } else {
          const next = await api.tickets({ techId });
          if (stopped) return;
          if (known) {
            const fresh = next.filter((x) => x.status === 'new' && !known.has(x.id));
            if (fresh.length) {
              beep();
              if ('Notification' in window && Notification.permission === 'granted') {
                const tr = makeT(langRef.current);
                new Notification(tr('notifTitle'), {
                  body: tr('notifBody', { room: fresh[0].room, category: categoryLabel(langRef.current, fresh[0].category) }),
                });
              }
            }
          }
          known = new Set(next.map((x) => x.id));
          setTickets(next);
          setLoadError('');
        }
      } catch {
        if (!stopped) setLoadError('err.retry');
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { stopped = true; clearInterval(id); };
  }, [role, techId]);


  useEffect(() => { api.rooms().then(setRooms).catch(() => {}); }, []);

  const faulty = rooms.filter((r) => r.status !== 'ok').length;

  const visible = rooms.filter((r) =>
    (tab === 'all' || r.techId === tab) &&
    r.room.toLowerCase().includes(q.trim().toLowerCase()) &&
    (!onlyBad || r.status !== 'ok'));
  const resetFilters = () => { setTab('all'); setQ(''); setOnlyBad(false); };

  const openCall = (room = '') => { setForm({ ...form, room, category: '', text: '' }); setError(''); setModal(true); };
  const field = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const send = async (e) => {
    e.preventDefault();
    if (!form.teacher.trim() || !form.room || !form.category) {
      setError('err.required');
      return;
    }
    setSending(true);
    try {
      const ticket = await api.createTicket({ ...form, teacher: form.teacher.trim() });
      const tech = techs.find((x) => x.id === ticket.techId);
      setModal(false);
      showToast(t('sent', { tech: tech?.name ?? '', room: ticket.room }));
      api.rooms().then(setRooms).catch(() => {});
    } catch (err) {
      setError(errKey(err));
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (id, action) => {
    try {
      const updated = await api[action](id);
      setTickets((ts) => ts.map((x) => (x.id === id ? updated : x)));
    } catch (err) {
      showToast(t(errKey(err)));
      api.tickets({ techId }).then(setTickets).catch(() => {}); 
    }
  };

  const queue = [...tickets].sort((a, b) => (a.status === 'done') - (b.status === 'done') || b.at - a.at);
  const modalRoom = form.room && rooms.find((r) => r.room === form.room);
  const currentTech = techs.find((x) => x.id === techId);
  const count = (st) => queue.filter((x) => x.status === st).length;

  const stats = role === 'teacher'
    ? [[t('statTotal'), rooms.length], [t('statFaulty'), faulty], [t('statWorking'), rooms.length - faulty, 'good']]
    : [[t('statNew'), count('new')], [t('statTaken'), count('taken')], [t('statDone'), count('done'), 'good']];

  return (
    <div className="app">
      <div className="topbar">
        <div className="seg">
          <button className={role === 'teacher' ? 'on' : ''} onClick={() => setRole('teacher')}>{t('teacher')}</button>
          <button className={role === 'tech' ? 'on' : ''} onClick={() => setRole('tech')}>{t('tech')}</button>
        </div>
        <div className="tools">
          <div className="seg mini" role="group" aria-label={t('langLabel')}>
            <button className={lang === 'ru' ? 'on' : ''} onClick={() => setLang('ru')} aria-pressed={lang === 'ru'}>RU</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>EN</button>
          </div>
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? t('themeToLight') : t('themeToDark')}
            title={theme === 'dark' ? t('themeToLight') : t('themeToDark')}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>

      <section className="panel hero">
        <small className="eyebrow">{role === 'teacher' ? t('eyebrowTeacher') : t('eyebrowTech')}</small>
        <h1>{role === 'teacher' ? t('h1Teacher') : t('h1Tech')}</h1>
        <div className="stats">
          {stats.map(([label, value, tone]) => (
            <div key={label} className={`stat ${tone || ''}`}><span>{label}</span><b>{value}</b></div>
          ))}
        </div>
        <button className="cta" onClick={() => (role === 'teacher' ? openCall() : 'Notification' in window && Notification.requestPermission())}>
          <BellIcon /> {role === 'teacher' ? t('callIt') : t('enableNotify')}
        </button>
      </section>

      {loadError && <p className="error" role="alert">{t(loadError)}</p>}

      {role === 'teacher' ? (
        <>
          <section className="panel">
            <div className="search-row">
              <label className="search-wrap">
                <SearchIcon />
                <input placeholder={t('searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <button className="reset" onClick={resetFilters}>{t('reset')}</button>
            </div>
            <div className="seg wide">
              <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>{t('all')}</button>
              {techs.map((x) => (
                <button key={x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>{x.name}</button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={onlyBad} onChange={(e) => setOnlyBad(e.target.checked)} /> {t('onlyFaulty')}
            </label>
          </section>

          <section className="panel">
            <h2 className="sect"><GridIcon /> {t('sectRooms')}</h2>
            <div className="grid">
              {visible.map((r) => (
                <button key={r.room} className={`tile ${r.status}`} onClick={() => openCall(r.room)}>
                  <i className="dot" />
                  <span className="tile-body">
                    <b>{t('room', { n: r.room })}{r.category && <em>{cat(r.category)}</em>}</b>
                    <small>{t(`status.${r.status}`)} · {r.techName}</small>
                  </span>
                  <ChevronIcon />
                </button>
              ))}
              {!visible.length && <p className="empty">{t('notFound')}</p>}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="panel">
            <div className="seg wide">
              {techs.map((x) => (
                <button key={x.id} className={techId === x.id ? 'on' : ''} onClick={() => { setTickets([]); setTechId(x.id); }}>{x.name}</button>
              ))}
            </div>
            <p className="label">{t('myRooms')}: {currentTech?.rooms.join(', ')}</p>
          </section>

          <section className="panel">
            <h2 className="sect"><ListIcon /> {t('sectTickets')}</h2>
            <div className="list">
              {queue.map((x) => (
                <div key={x.id} className={`tile static ${x.status}`}>
                  <i className="dot" />
                  <div className="tile-body">
                    <b>{t('room', { n: x.room })}<em>{cat(x.category)}</em></b>
                    <small>{t(`status.${x.status}`)} · {x.teacher} · {time(x.at)}</small>
                    {x.text && <p className="desc">{x.text}</p>}
                  </div>
                  {x.status === 'new' && <button className="act" onClick={() => setStatus(x.id, 'take')}>{t('accept')}</button>}
                  {x.status === 'taken' && <button className="act ok" onClick={() => setStatus(x.id, 'done')}>{t('solved')}</button>}
                </div>
              ))}
              {!queue.length && <p className="empty">{t('noTickets')}</p>}
            </div>
          </section>
        </>
      )}

      {modal && (
        <div className="overlay" onClick={() => setModal(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={send}>
            <h2>{t('modalTitle')}</h2>
            <label>{t('yourName')}
              <input value={form.teacher} onChange={field('teacher')} placeholder={t('namePlaceholder')} />
            </label>
            <label>{t('roomLabel')}
              <select value={form.room} onChange={field('room')}>
                <option value="">{t('chooseRoom')}</option>
                {techs.map((x) => (
                  <optgroup key={x.id} label={x.name}>
                    {x.rooms.map((r) => <option key={r} value={r}>{t('room', { n: r })}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            {modalRoom && <p className="hint">{t('willReceive')} <b>{modalRoom.techName}</b></p>}
            <div className="chips">
              {categories.map((c) => (
                <button type="button" key={c} className={form.category === c ? 'on' : ''} onClick={() => setForm({ ...form, category: c })}>{cat(c)}</button>
              ))}
            </div>
            <label>{t('descOptional')}
              <textarea rows="2" value={form.text} onChange={field('text')} placeholder={t('descPlaceholder')} />
            </label>
            {error && <p className="error" role="alert">{t(error)}</p>}
            <div className="row">
              <button type="button" className="reset" onClick={() => setModal(false)}>{t('cancel')}</button>
              <button type="submit" className="cta" disabled={sending}>{sending ? t('sending') : t('send')}</button>
            </div>
          </form>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

export default App;
