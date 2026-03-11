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
  channels?: {
    sms?: { enabled: boolean; status: string };
    telegram?: { enabled: boolean; status: string; bot_username?: string };
    max?: { enabled: boolean; status: string; bot_name?: string };
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

  // Channel tokens
  const [telegramToken, setTelegramToken] = useState('');
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [telegramBotUsername, setTelegramBotUsername] = useState('');
  const [telegramValidating, setTelegramValidating] = useState(false);
  const [telegramError, setTelegramError] = useState('');

  const [maxToken, setMaxToken] = useState('');
  const [showMaxToken, setShowMaxToken] = useState(false);
  const [maxBotName, setMaxBotName] = useState('');
  const [maxValidating, setMaxValidating] = useState(false);
  const [maxError, setMaxError] = useState('');

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
    if (data?.channels?.telegram?.bot_username) {
      setTelegramBotUsername(data.channels.telegram.bot_username);
    }
    if (data?.channels?.max?.bot_name) {
      setMaxBotName(data.channels.max.bot_name);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiClient<SettingsData>('/settings', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (result?.channels?.telegram?.bot_username) {
        setTelegramBotUsername(result.channels.telegram.bot_username);
      }
      if (result?.channels?.max?.bot_name) {
        setMaxBotName(result.channels.max.bot_name);
      }
    },
  });

  const handleValidateTelegram = async () => {
    if (!telegramToken.trim()) return;
    setTelegramValidating(true);
    setTelegramError('');
    try {
      const result = await apiClient<SettingsData>('/settings', {
        method: 'PUT',
        body: JSON.stringify({ ...form, telegram_bot_token: telegramToken }),
      });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      if (result?.channels?.telegram?.bot_username) {
        setTelegramBotUsername(result.channels.telegram.bot_username);
      } else {
        setTelegramError('Не удалось получить имя бота');
      }
    } catch (err) {
      setTelegramError(err instanceof Error ? err.message : 'Ошибка валидации токена');
    } finally {
      setTelegramValidating(false);
    }
  };

  const handleValidateMax = async () => {
    if (!maxToken.trim()) return;
    setMaxValidating(true);
    setMaxError('');
    try {
      const result = await apiClient<SettingsData>('/settings', {
        method: 'PUT',
        body: JSON.stringify({ ...form, max_bot_token: maxToken }),
      });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      if (result?.channels?.max?.bot_name) {
        setMaxBotName(result.channels.max.bot_name);
      } else {
        setMaxError('Не удалось получить имя бота');
      }
    } catch (err) {
      setMaxError(err instanceof Error ? err.message : 'Ошибка валидации токена');
    } finally {
      setMaxValidating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = { ...form };
    if (telegramToken.trim()) {
      payload.telegram_bot_token = telegramToken;
    }
    if (maxToken.trim()) {
      payload.max_bot_token = maxToken;
    }
    mutation.mutate(payload);
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

        {/* Каналы доставки */}
        <div className="border-t pt-4 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Каналы доставки</h3>

          {/* Telegram */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telegram Bot Token
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showTelegramToken ? 'text' : 'password'}
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="123456:ABC-DEF..."
                  className="w-full border rounded-lg px-3 py-2 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowTelegramToken(!showTelegramToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  {showTelegramToken ? 'Скрыть' : 'Показать'}
                </button>
              </div>
              <button
                type="button"
                onClick={handleValidateTelegram}
                disabled={telegramValidating || !telegramToken.trim()}
                className="px-3 py-2 border rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-30"
              >
                {telegramValidating ? '...' : 'Проверить'}
              </button>
            </div>
            {telegramBotUsername && (
              <div className="mt-1 space-y-1">
                <p className="text-sm text-green-600">
                  @{telegramBotUsername.replace('@', '')} &#10003;
                </p>
                <p className="text-xs text-gray-500">
                  Ссылка для клиентов:{' '}
                  <a
                    href={`https://t.me/${telegramBotUsername.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    t.me/{telegramBotUsername.replace('@', '')}
                  </a>
                </p>
              </div>
            )}
            {telegramError && <p className="text-red-500 text-xs mt-1">{telegramError}</p>}
          </div>

          {/* Max */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Bot Token
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showMaxToken ? 'text' : 'password'}
                  value={maxToken}
                  onChange={(e) => setMaxToken(e.target.value)}
                  placeholder="Токен бота Max..."
                  className="w-full border rounded-lg px-3 py-2 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowMaxToken(!showMaxToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  {showMaxToken ? 'Скрыть' : 'Показать'}
                </button>
              </div>
              <button
                type="button"
                onClick={handleValidateMax}
                disabled={maxValidating || !maxToken.trim()}
                className="px-3 py-2 border rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-30"
              >
                {maxValidating ? '...' : 'Проверить'}
              </button>
            </div>
            {maxBotName && (
              <p className="text-sm text-green-600 mt-1">
                {maxBotName} &#10003;
              </p>
            )}
            {maxError && <p className="text-red-500 text-xs mt-1">{maxError}</p>}
          </div>
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
