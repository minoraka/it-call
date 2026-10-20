import { useState, useEffect, useRef } from 'react';
import './App.css';

// Сотрудники и закреплённые за ними аудитории — замените на свои
const seq = (floor) => [1, 2, 3, 4, 5, 6].map((n) => `${floor}0${n}`);
const techs = [
  { id: 1, name: 'Алишер', rooms: [...seq(1), ...seq(3), ...seq(5)] },
  { id: 2, name: 'Француз', rooms: [...seq(2), ...seq(4), 'TS2', 'TS3', 'TS4', 'TS5', 'TS6'] },
];
const categories = ['Проектор', 'Компьютер', 'Интернет', 'Звук', 'Интерактивная доска', 'Другое'];
const statusText = { ok: 'Всё работает', new: 'Вызов отправлен', taken: 'Специалист идёт', done: 'Решено' };
const rooms = techs.flatMap((t) => t.rooms.map((r) => ({ room: r, tech: t })));

const KEY = 'it-tickets';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const time = (ts) => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const emptyForm = { teacher: '', room: '', category: '', text: '' };

const beep = () => {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const o = c.createOscillator();
    o.connect(c.destination); o.frequency.value = 880; o.start(); o.stop(c.currentTime + 0.3);
  } catch { /* звук недоступен */ }
};

// Сюда подключается реальная отправка (Telegram-бот, push, SMS) через ваш сервер
function notifyTech(tech, ticket) {
  console.log(`Уведомление для ${tech.name}: ауд. ${ticket.room} — ${ticket.category}`);
}

function App() {
  const [role, setRole] = useState('teacher');
  const [tickets, setTickets] = useState(load);
  const [techId, setTechId] = useState(1);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [onlyBad, setOnlyBad] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const ref = useRef({});
  ref.current = { tickets, techId: role === 'tech' ? techId : null };
  const save = (next) => { setTickets(next); localStorage.setItem(KEY, JSON.stringify(next)); };

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== KEY) return;
      const next = load();
      const known = new Set(ref.current.tickets.map((t) => t.id));
      const fresh = next.filter((t) => !known.has(t.id) && t.techId === ref.current.techId);
      if (fresh.length) {
        beep();
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Вызов айтишника', { body: `Ауд. ${fresh[0].room}: ${fresh[0].category}` });
        }
      }
      setTickets(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const active = (room) => tickets.filter((t) => t.room === room && t.status !== 'done');
  const roomStatus = (room) => {
    const a = active(room);
    return a.some((t) => t.status === 'new') ? 'new' : a.length ? 'taken' : 'ok';
  };
  const faulty = rooms.filter((r) => roomStatus(r.room) !== 'ok').length;

  const visible = rooms.filter((r) =>
    (tab === 'all' || r.tech.id === tab) &&
    r.room.toLowerCase().includes(q.trim().toLowerCase()) &&
    (!onlyBad || roomStatus(r.room) !== 'ok'));
  const resetFilters = () => { setTab('all'); setQ(''); setOnlyBad(false); };

  const openCall = (room = '') => { setForm({ ...form, room, category: '', text: '' }); setError(''); setModal(true); };
  const field = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const send = (e) => {
    e.preventDefault();
    if (!form.teacher.trim() || !form.room || !form.category) {
      setError('Укажите имя, аудиторию и тип неисправности.');
      return;
    }
    const tech = rooms.find((r) => r.room === form.room).tech;
    const ticket = { id: Date.now(), ...form, teacher: form.teacher.trim(), techId: tech.id, status: 'new', at: Date.now() };
    save([ticket, ...tickets]);
    notifyTech(tech, ticket);
    setModal(false);
    setToast(`Заявка отправлена: ${tech.name}, ауд. ${form.room}`);
    setTimeout(() => setToast(''), 4000);
  };

  const setStatus = (id, status) => save(tickets.map((t) => (t.id === id ? { ...t, status } : t)));
  const queue = tickets.filter((t) => t.techId === techId).sort((a, b) => (a.status === 'done') - (b.status === 'done') || b.at - a.at);
  const modalTech = form.room && rooms.find((r) => r.room === form.room).tech;

  return (
    <div className="app">
      <div className="pills">
        <button className={role === 'teacher' ? 'on' : ''} onClick={() => setRole('teacher')}>Преподаватель</button>
        <button className={role === 'tech' ? 'on' : ''} onClick={() => setRole('tech')}>Специалист</button>
      </div>

      <div className="banner">
        <div>
          <small>● {faulty} неисправно, {rooms.length} аудиторий</small>
          <h1>{role === 'teacher' ? 'АУДИТОРИИ' : 'ЗАЯВКИ'}</h1>
        </div>
        <button className="cta" onClick={() => (role === 'teacher' ? openCall() : 'Notification' in window && Notification.requestPermission())}>
          {role === 'teacher' ? '🔔 Вызвать айтишника' : '🔔 Включить уведомления'}
        </button>
      </div>

      {role === 'teacher' ? (
        <>
          <div className="filters">
            <input className="search" placeholder="Номер аудитории" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="reset" onClick={resetFilters}>Сбросить фильтры</button>
            <label className="check">
              <input type="checkbox" checked={onlyBad} onChange={(e) => setOnlyBad(e.target.checked)} /> Только неисправные
            </label>
          </div>
          <div className="pills center">
            <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>ВСЕ</button>
            {techs.map((t) => (
              <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.name.toUpperCase()}</button>
            ))}
          </div>
          <div className="grid">
            {visible.map(({ room, tech }) => {
              const s = roomStatus(room);
              const a = active(room)[0];
              return (
                <button key={room} className={`card ${s}`} onClick={() => openCall(room)}>
                  <i className="bar" />
                  <h3>#{room} {a ? '' : 'АУД.'}<span>{a ? a.category : ''}</span></h3>
                  <p>{statusText[s]} | {tech.name}</p>
                  <b className="go" aria-hidden="true">▶</b>
                </button>
              );
            })}
            {!visible.length && <p className="empty">Ничего не найдено.</p>}
          </div>
        </>
      ) : (
        <>
          <div className="pills center">
            {techs.map((t) => (
              <button key={t.id} className={techId === t.id ? 'on' : ''} onClick={() => setTechId(t.id)}>{t.name.toUpperCase()}</button>
            ))}
          </div>
          <p className="label">МОИ АУДИТОРИИ: {techs.find((t) => t.id === techId).rooms.join(', ')}</p>
          <div className="grid">
            {queue.map((t) => (
              <div key={t.id} className={`card static ${t.status}`}>
                <i className="bar" />
                <h3>#{t.room} <span>{t.category}</span></h3>
                <p>{statusText[t.status]} | {t.teacher} · {time(t.at)}</p>
                {t.text && <p className="desc">{t.text}</p>}
                {t.status === 'new' && <button className="act" onClick={() => setStatus(t.id, 'taken')}>Принять</button>}
                {t.status === 'taken' && <button className="act" onClick={() => setStatus(t.id, 'done')}>Решено</button>}
              </div>
            ))}
            {!queue.length && <p className="empty">Заявок нет — всё работает.</p>}
          </div>
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
            {modalTech && <p className="hint">Заявку получит: <b>{modalTech.name}</b></p>}
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
              <button type="submit" className="cta">Отправить</button>
            </div>
          </form>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

export default App;