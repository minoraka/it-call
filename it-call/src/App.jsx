import { useState, useEffect, useRef } from 'react';
import { api } from './api';
import './App.css';

const statusText = { ok: 'Всё работает', new: 'Вызов отправлен', taken: 'Специалист идёт', done: 'Решено' };
const POLL_MS = 5000;

const time = (ts) => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
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

function App() {
  const [role, setRole] = useState('teacher');
  const [techs, setTechs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rooms, setRooms] = useState([]);     // [{room, techId, techName, status, category}]
  const [tickets, setTickets] = useState([]); // очередь выбранного специалиста
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

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  };

  // Справочники: специалисты, типы неисправностей
  useEffect(() => {
    Promise.all([api.technicians(), api.categories()])
      .then(([t, c]) => {
        setTechs(t);
        setCategories(c);
        setTechId((cur) => cur ?? t[0]?.id ?? null);
      })
      .catch(() => setLoadError('Не удалось подключиться к серверу. Запущен ли бэкенд?'));
  }, []);

  // Живое обновление (раньше было событие storage): опрос сервера.
  // Преподаватель — статусы аудиторий, специалист — своя очередь + звук/уведомление о новых заявках.
  useEffect(() => {
    if (role === 'tech' && techId == null) return;
    let stopped = false;
    let known = null; // id заявок, которые уже видели; null до первой загрузки

    const tick = async () => {
      try {
        if (role === 'teacher') {
          const next = await api.rooms();
          if (!stopped) { setRooms(next); setLoadError(''); }
        } else {
          const next = await api.tickets({ techId });
          if (stopped) return;
          if (known) {
            const fresh = next.filter((t) => t.status === 'new' && !known.has(t.id));
            if (fresh.length) {
              beep();
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Вызов айтишника', { body: `Ауд. ${fresh[0].room}: ${fresh[0].category}` });
              }
            }
          }
          known = new Set(next.map((t) => t.id));
          setTickets(next);
          setLoadError('');
        }
      } catch {
        if (!stopped) setLoadError('Нет связи с сервером. Повторяем…');
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { stopped = true; clearInterval(id); };
  }, [role, techId]);

  // Список аудиторий для преподавателя нужен и в форме — подгружаем один раз при старте
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
      setError('Укажите имя, аудиторию и тип неисправности.');
      return;
    }
    setSending(true);
    try {
      const ticket = await api.createTicket({ ...form, teacher: form.teacher.trim() });
      const tech = techs.find((t) => t.id === ticket.techId);
      setModal(false);
      showToast(`Заявка отправлена: ${tech?.name ?? ''}, ауд. ${ticket.room}`);
      api.rooms().then(setRooms).catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (id, action) => {
    try {
      const updated = await api[action](id);
      setTickets((ts) => ts.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      showToast(err.message);
      api.tickets({ techId }).then(setTickets).catch(() => {}); // подтянуть актуальное состояние
    }
  };

  const queue = [...tickets].sort((a, b) => (a.status === 'done') - (b.status === 'done') || b.at - a.at);
  const modalRoom = form.room && rooms.find((r) => r.room === form.room);
  const currentTech = techs.find((t) => t.id === techId);
  const count = (st) => queue.filter((t) => t.status === st).length;

  const stats = role === 'teacher'
    ? [['ВСЕГО', rooms.length], ['НЕИСПРАВНО', faulty], ['РАБОТАЕТ', rooms.length - faulty, 'good']]
    : [['НОВЫЕ', count('new')], ['В РАБОТЕ', count('taken')], ['РЕШЕНО', count('done'), 'good']];

  return (
    <div className="app">
      <div className="topbar">
        <div className="seg">
          <button className={role === 'teacher' ? 'on' : ''} onClick={() => setRole('teacher')}>Преподаватель</button>
          <button className={role === 'tech' ? 'on' : ''} onClick={() => setRole('tech')}>Специалист</button>
        </div>
      </div>

      <section className="panel hero">
        <small className="eyebrow">{role === 'teacher' ? 'IT-ПОДДЕРЖКА КОЛЛЕДЖА' : 'ПАНЕЛЬ СПЕЦИАЛИСТА'}</small>
        <h1>{role === 'teacher' ? 'Аудитории' : 'Заявки'}</h1>
        <div className="stats">
          {stats.map(([label, value, tone]) => (
            <div key={label} className={`stat ${tone || ''}`}><span>{label}</span><b>{value}</b></div>
          ))}
        </div>
        <button className="cta" onClick={() => (role === 'teacher' ? openCall() : 'Notification' in window && Notification.requestPermission())}>
          <BellIcon /> {role === 'teacher' ? 'Вызвать айтишника' : 'Включить уведомления'}
        </button>
      </section>

      {loadError && <p className="error" role="alert">{loadError}</p>}

      {role === 'teacher' ? (
        <>
          <section className="panel">
            <div className="search-row">
              <label className="search-wrap">
                <SearchIcon />
                <input placeholder="Номер аудитории" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <button className="reset" onClick={resetFilters}>Сбросить</button>
            </div>
            <div className="seg wide">
              <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>Все</button>
              {techs.map((t) => (
                <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.name}</button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={onlyBad} onChange={(e) => setOnlyBad(e.target.checked)} /> Только неисправные
            </label>
          </section>

          <section className="panel">
            <h2 className="sect"><GridIcon /> аудитории</h2>
            <div className="grid">
              {visible.map((r) => (
                <button key={r.room} className={`tile ${r.status}`} onClick={() => openCall(r.room)}>
                  <i className="dot" />
                  <span className="tile-body">
                    <b>Ауд. {r.room}{r.category && <em>{r.category}</em>}</b>
                    <small>{statusText[r.status]} · {r.techName}</small>
                  </span>
                  <ChevronIcon />
                </button>
              ))}
              {!visible.length && <p className="empty">Ничего не найдено.</p>}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="panel">
            <div className="seg wide">
              {techs.map((t) => (
                <button key={t.id} className={techId === t.id ? 'on' : ''} onClick={() => { setTickets([]); setTechId(t.id); }}>{t.name}</button>
              ))}
            </div>
            <p className="label">Мои аудитории: {currentTech?.rooms.join(', ')}</p>
          </section>

          <section className="panel">
            <h2 className="sect"><ListIcon /> заявки</h2>
            <div className="list">
              {queue.map((t) => (
                <div key={t.id} className={`tile static ${t.status}`}>
                  <i className="dot" />
                  <div className="tile-body">
                    <b>Ауд. {t.room}<em>{t.category}</em></b>
                    <small>{statusText[t.status]} · {t.teacher} · {time(t.at)}</small>
                    {t.text && <p className="desc">{t.text}</p>}
                  </div>
                  {t.status === 'new' && <button className="act" onClick={() => setStatus(t.id, 'take')}>Принять</button>}
                  {t.status === 'taken' && <button className="act ok" onClick={() => setStatus(t.id, 'done')}>Решено</button>}
                </div>
              ))}
              {!queue.length && <p className="empty">Заявок нет — всё работает.</p>}
            </div>
          </section>
        </>
      )}

      {modal && (
        <div className="overlay" onClick={() => setModal(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={send}>
            <h2>Вызов айтишника</h2>
            <label>Ваше имя
              <input value={form.teacher} onChange={field('teacher')} placeholder="Например, Мария Сергеевна" />
            </label>
            <label>Аудитория
              <select value={form.room} onChange={field('room')}>
                <option value="">Выберите аудиторию</option>
                {techs.map((t) => (
                  <optgroup key={t.id} label={t.name}>
                    {t.rooms.map((r) => <option key={r} value={r}>Ауд. {r}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            {modalRoom && <p className="hint">Заявку получит: <b>{modalRoom.techName}</b></p>}
            <div className="chips">
              {categories.map((c) => (
                <button type="button" key={c} className={form.category === c ? 'on' : ''} onClick={() => setForm({ ...form, category: c })}>{c}</button>
              ))}
            </div>
            <label>Описание (по желанию)
              <textarea rows="2" value={form.text} onChange={field('text')} placeholder="Например, проектор не включается" />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="row">
              <button type="button" className="reset" onClick={() => setModal(false)}>Отмена</button>
              <button type="submit" className="cta" disabled={sending}>{sending ? 'Отправка…' : 'Отправить'}</button>
            </div>
          </form>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

export default App;