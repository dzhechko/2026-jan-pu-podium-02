import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getChannels, ChannelInfo } from '../lib/api';

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  telegram_chat_id: string | null;
  max_chat_id: string | null;
  preferred_channel: 'sms' | 'telegram' | 'max' | null;
  opted_out: boolean;
  created_at: string;
}

interface ClientsResponse {
  data: Client[];
  meta: { total: number; page: number; limit: number };
}

const CHANNEL_LABELS: Record<string, string> = {
  sms: 'SMS',
  telegram: 'Telegram',
  max: 'Max',
};

function ChannelBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    sms: 'bg-gray-100 text-gray-600',
    telegram: 'bg-blue-100 text-blue-700',
    max: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${colors[type] ?? 'bg-gray-100 text-gray-600'}`}>
      {CHANNEL_LABELS[type] ?? type}
    </span>
  );
}

export function Clients() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
  });
  const [error, setError] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('sms');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, search],
    queryFn: () => apiClient<ClientsResponse>(`/clients?page=${page}&limit=20&search=${search}`),
  });

  const { data: channelsData } = useQuery({
    queryKey: ['channels'],
    queryFn: getChannels,
  });

  const configuredChannels: ChannelInfo[] = channelsData?.channels?.filter(
    (ch: ChannelInfo) => ch.configured
  ) ?? [{ type: 'sms', configured: true }];

  const addMutation = useMutation({
    mutationFn: (input: {
      name: string;
      phone: string;
      email?: string;
    }) =>
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

  const sendMutation = useMutation({
    mutationFn: (params: { clientIds: string[]; channel: string }) =>
      apiClient<{ sent: number; failed: number }>('/review-requests', {
        method: 'POST',
        body: JSON.stringify({ client_ids: params.clientIds, channel: params.channel }),
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

  const getClientChannels = (client: Client): string[] => {
    const channels: string[] = ['sms'];
    if (client.telegram_chat_id) channels.push('telegram');
    if (client.max_chat_id) channels.push('max');
    return channels;
  };

  const activeClients = data?.data.filter((c) => !c.opted_out) ?? [];
  const allActiveSelected = activeClients.length > 0 && activeClients.every((c) => selectedIds.has(c.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allActiveSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeClients.map((c) => c.id)));
    }
  };

  const handleBatchSend = () => {
    if (selectedIds.size === 0) return;
    sendMutation.mutate(
      { clientIds: Array.from(selectedIds), channel: selectedChannel },
      { onSuccess: () => setSelectedIds(new Set()) },
    );
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
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
            Мессенджеры подключаются автоматически: клиент получит ссылку на бота в SMS и подключится одним нажатием.
          </p>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
            Сохранить
          </button>
        </form>
      )}

      <div className="mb-4 flex items-center gap-4">
        <input
          placeholder="Поиск по имени..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm w-64"
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Канал:</span>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {configuredChannels.map((ch) => (
              <option key={ch.type} value={ch.type}>
                {CHANNEL_LABELS[ch.type] ?? ch.type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <span className="text-sm text-blue-700 font-medium">
            Выбрано: {selectedIds.size}
          </span>
          <button
            onClick={handleBatchSend}
            disabled={sendMutation.isPending}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {sendMutation.isPending ? 'Отправка...' : `Отправить через ${CHANNEL_LABELS[selectedChannel] ?? selectedChannel}`}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Сбросить
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-400">Загрузка...</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allActiveSelected}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left">Имя</th>
                <th className="px-4 py-3 text-left">Телефон</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Каналы</th>
                <th className="px-4 py-3 text-left">Статус</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.data.map((client) => (
                <tr key={client.id} className={`hover:bg-gray-50 ${selectedIds.has(client.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(client.id)}
                      onChange={() => toggleSelect(client.id)}
                      disabled={client.opted_out}
                      className="rounded disabled:opacity-30"
                    />
                  </td>
                  <td className="px-4 py-3">{client.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{client.phone}</td>
                  <td className="px-4 py-3 text-gray-500">{client.email ?? '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {getClientChannels(client).map((ch) => (
                        <ChannelBadge key={ch} type={ch} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {client.opted_out ? (
                      <span className="text-red-500 text-xs">Отписан</span>
                    ) : (
                      <span className="text-green-500 text-xs">Активен</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => sendMutation.mutate({ clientIds: [client.id], channel: selectedChannel })}
                      disabled={client.opted_out}
                      className="text-blue-600 hover:underline text-xs disabled:opacity-30"
                    >
                      {CHANNEL_LABELS[selectedChannel] ?? 'Отправить'}
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

      {sendMutation.isSuccess && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg text-sm text-green-700">
          Отправлено: {sendMutation.data.sent}, Ошибок: {sendMutation.data.failed}
        </div>
      )}
    </div>
  );
}
