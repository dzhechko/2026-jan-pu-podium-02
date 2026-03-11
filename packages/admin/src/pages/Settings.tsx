import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

interface SettingsData {
  data: {
    company_name: string;
    yandex_maps_url: string | null;
    yandex_org_id: string | null;
    discount_percent: number;
    discount_text: string;
  };
}

export function Settings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    company_name: '',
    yandex_maps_url: '',
    discount_percent: 10,
    discount_text: '',
  });
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient<SettingsData>('/settings'),
  });

  useEffect(() => {
    if (data?.data) {
      setForm({
        company_name: data.data.company_name,
        yandex_maps_url: data.data.yandex_maps_url ?? '',
        discount_percent: data.data.discount_percent,
        discount_text: data.data.discount_text,
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (input: typeof form) =>
      apiClient('/settings', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Настройки</h2>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Название компании</label>
          <input
            value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ссылка на Яндекс Карты
          </label>
          <input
            value={form.yandex_maps_url}
            onChange={(e) => setForm({ ...form, yandex_maps_url: e.target.value })}
            placeholder="https://yandex.ru/maps/org/..."
            className="w-full border rounded-lg px-3 py-2"
          />
          {data?.data.yandex_org_id && (
            <p className="text-xs text-gray-400 mt-1">Org ID: {data.data.yandex_org_id}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Скидка (%)</label>
          <input
            type="number"
            min={1}
            max={100}
            value={form.discount_percent}
            onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Текст скидки</label>
          <input
            value={form.discount_text}
            onChange={(e) => setForm({ ...form, discount_text: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700"
        >
          Сохранить
        </button>

        {saved && <p className="text-green-600 text-sm">Сохранено!</p>}
        {mutation.isError && <p className="text-red-500 text-sm">{mutation.error.message}</p>}
      </form>
    </div>
  );
}
