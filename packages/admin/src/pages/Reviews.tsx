import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

interface Review {
  id: string;
  client_name: string;
  stars: number;
  text: string;
  sentiment: string | null;
  routed_to: string | null;
  promo_code: string | null;
  created_at: string;
}

interface ReviewsResponse {
  data: Review[];
  meta: { total: number; page: number; limit: number };
}

export function Reviews() {
  const [page, setPage] = useState(1);
  const [sentiment, setSentiment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', page, sentiment],
    queryFn: () =>
      apiClient<ReviewsResponse>(
        `/reviews?page=${page}&limit=20${sentiment ? `&sentiment=${sentiment}` : ''}`,
      ),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Отзывы</h2>
        <select
          value={sentiment}
          onChange={(e) => { setSentiment(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Все</option>
          <option value="POSITIVE">Позитивные</option>
          <option value="NEGATIVE">Негативные</option>
          <option value="NEUTRAL">Нейтральные</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-gray-400">Загрузка...</div>
      ) : (
        <div className="space-y-4">
          {data?.data.map((review) => (
            <div key={review.id} className="bg-white rounded-xl p-4 border">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-medium">{review.client_name}</span>
                  <span className="ml-2 text-yellow-500">
                    {'★'.repeat(review.stars)}{'☆'.repeat(5 - review.stars)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {review.sentiment && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      review.sentiment === 'POSITIVE'
                        ? 'bg-green-100 text-green-700'
                        : review.sentiment === 'NEGATIVE'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}>
                      {review.sentiment === 'POSITIVE' ? 'Позитив' :
                       review.sentiment === 'NEGATIVE' ? 'Негатив' : 'Нейтрал'}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(review.created_at).toLocaleDateString('ru')}
                  </span>
                </div>
              </div>
              <p className="text-gray-700 text-sm">{review.text}</p>
              {review.promo_code && (
                <p className="mt-2 text-xs text-gray-500">
                  Промокод: <span className="font-mono font-bold">{review.promo_code}</span>
                </p>
              )}
            </div>
          ))}

          {data && data.meta.total > data.meta.limit && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Всего: {data.meta.total}</span>
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
    </div>
  );
}
