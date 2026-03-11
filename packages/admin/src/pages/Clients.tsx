import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  opted_out: boolean;
  created_at: string;
}

interface ClientsResponse {
  data: Client[];
  meta: { total: number; page: number; limit: number };
}

export function Clients() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, search],
    queryFn: () => apiClient<ClientsResponse>(`/clients?page=${page}&limit=20&search=${search}`),
  });

  const addMutation = useMutation({
    mutationFn: (input: { name: string; phone: string; email?: string }) =>
      apiClient('/clients', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setShowAdd(false);
      setForm({ name: '', phone: '', email: '' });
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/clients/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  const sendSmsMutation = useMutation({
    mutationFn: (clientIds: string[]) =>
      apiClient<{ sent: number; failed: number }>('/review-requests', {
        method: 'POST',
        body: JSON.stringify({ client_ids: clientIds }),
      }),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    addMutation.mutate({
      name: form.name,
      phone: form.phone,
      email: form.email || undefined,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Клиенты</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Добавить
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl p-4 border mb-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="Имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm" required />
            <input placeholder="+7XXXXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm" required />
            <input placeholder="Email (опционально)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
            Сохранить
          </button>
        </form>
      )}

      <div className="mb-4">
        <input
          placeholder="Поиск по имени..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm w-64"
        />
      </div>

      {isLoading ? (
        <div className="text-gray-400">Загрузка...</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Имя</th>
                <th className="px-4 py-3 text-left">Телефон</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Статус</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.data.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{client.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{client.phone}</td>
                  <td className="px-4 py-3 text-gray-500">{client.email ?? '-'}</td>
                  <td className="px-4 py-3">
                    {client.opted_out ? (
                      <span className="text-red-500 text-xs">Отписан</span>
                    ) : (
                      <span className="text-green-500 text-xs">Активен</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => sendSmsMutation.mutate([client.id])}
                      disabled={client.opted_out}
                      className="text-blue-600 hover:underline text-xs disabled:opacity-30"
                    >
                      SMS
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(client.id)}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data && data.meta.total > data.meta.limit && (
            <div className="px-4 py-3 border-t flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Всего: {data.meta.total}
              </span>
              <div className="space-x-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                  className="px-3 py-1 border rounded disabled:opacity-30">Назад</button>
                <button disabled={page * data.meta.limit >= data.meta.total} onClick={() => setPage(page + 1)}
                  className="px-3 py-1 border rounded disabled:opacity-30">Далее</button>
              </div>
            </div>
          )}
        </div>
      )}

      {sendSmsMutation.isSuccess && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg text-sm text-green-700">
          Отправлено: {sendSmsMutation.data.sent}, Ошибок: {sendSmsMutation.data.failed}
        </div>
      )}
    </div>
  );
}
