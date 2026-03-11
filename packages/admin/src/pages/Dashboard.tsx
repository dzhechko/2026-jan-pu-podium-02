import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

interface DashboardData {
  total_sms_sent: number;
  total_reviews: number;
  conversion_rate: number;
  positive_count: number;
  negative_count: number;
  avg_rating: number;
  reviews_by_day: Array<{ date: string; count: number }>;
}

interface ChannelData {
  channels: Array<{
    channel: string;
    sent: number;
    failed: number;
    reviews: number;
    conversion_rate: number;
  }>;
  fallback_count: number;
}

export function Dashboard() {
  const [period, setPeriod] = useState('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => apiClient<DashboardData>(`/analytics/dashboard?period=${period}`),
  });

  const { data: channelData } = useQuery({
    queryKey: ['channels', period],
    queryFn: () => apiClient<ChannelData>(`/analytics/channels?period=${period}`),
  });

  if (isLoading) return <div className="text-gray-400">Загрузка...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Дашборд</h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="7d">7 дней</option>
          <option value="30d">30 дней</option>
          <option value="90d">90 дней</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="SMS отправлено" value={data?.total_sms_sent ?? 0} />
        <StatCard label="Отзывов" value={data?.total_reviews ?? 0} />
        <StatCard label="Конверсия" value={`${((data?.conversion_rate ?? 0) * 100).toFixed(0)}%`} />
        <StatCard label="Средний рейтинг" value={data?.avg_rating ?? 0} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 border">
          <p className="text-sm text-gray-500">Позитивные</p>
          <p className="text-3xl font-bold text-green-600">{data?.positive_count ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <p className="text-sm text-gray-500">Негативные</p>
          <p className="text-3xl font-bold text-red-600">{data?.negative_count ?? 0}</p>
        </div>
      </div>

      {channelData && (
        <div className="bg-white rounded-xl p-4 border mb-8">
          <h3 className="font-medium text-gray-900 mb-4">По каналам</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2">Канал</th>
                  <th className="pb-2">Отправлено</th>
                  <th className="pb-2">Ошибки</th>
                  <th className="pb-2">Отзывы</th>
                  <th className="pb-2">Конверсия</th>
                </tr>
              </thead>
              <tbody>
                {channelData.channels.map((ch) => (
                  <tr key={ch.channel} className="border-b last:border-0">
                    <td className="py-2 font-medium">{channelLabel(ch.channel)}</td>
                    <td className="py-2">{ch.sent}</td>
                    <td className="py-2 text-red-500">{ch.failed}</td>
                    <td className="py-2">{ch.reviews}</td>
                    <td className="py-2">{(ch.conversion_rate * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {channelData.fallback_count > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              Fallback на SMS: {channelData.fallback_count} раз(а)
            </p>
          )}
        </div>
      )}

      {data?.reviews_by_day && data.reviews_by_day.length > 0 && (
        <div className="bg-white rounded-xl p-4 border">
          <h3 className="font-medium text-gray-900 mb-4">Отзывы по дням</h3>
          <div className="flex items-end gap-1 h-32">
            {data.reviews_by_day.map((day) => {
              const maxCount = Math.max(...data.reviews_by_day.map((d) => d.count));
              const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`${day.date}: ${day.count}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function channelLabel(channel: string): string {
  switch (channel) {
    case 'sms': return 'SMS';
    case 'telegram': return 'Telegram';
    case 'max': return 'Max';
    default: return channel;
  }
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl p-4 border">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
