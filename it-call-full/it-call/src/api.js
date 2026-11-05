
const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
   
    const msg = data?.detail ?? (data && Object.values(data).flat().join(' ')) ?? 'Server error';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  technicians: () => request('/technicians/'),                       
  categories: () => request('/categories/'),                        
  rooms: () => request('/rooms/'),                                 
  tickets: (params = {}) => request(`/tickets/?${new URLSearchParams(params)}`),
  createTicket: (body) => request('/tickets/', { method: 'POST', body: JSON.stringify(body) }),
  take: (id) => request(`/tickets/${id}/take/`, { method: 'POST' }),
  done: (id) => request(`/tickets/${id}/done/`, { method: 'POST' }),
};
