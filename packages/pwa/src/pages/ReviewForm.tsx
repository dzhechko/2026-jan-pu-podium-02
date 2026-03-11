import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StarRating } from '../components/StarRating';

interface FormData {
  company_name: string;
  discount_text: string;
  discount_percent: number;
}

export function ReviewForm() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData | null>(null);
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/reviews/form/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 410 ? 'expired' : 'not_found');
        return res.json();
      })
      .then((data) => setFormData(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stars === 0) return setError('Выберите оценку');
    if (text.length < 10) return setError('Минимум 10 символов');

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/reviews/submit/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stars, text }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Ошибка отправки');
      }

      const result = await res.json();
      navigate('/thank-you', { state: result });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Загрузка...</div>
      </div>
    );
  }

  if (error === 'expired' || error === 'not_found') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold text-gray-900">
            {error === 'expired' ? 'Ссылка устарела' : 'Ссылка не найдена'}
          </h1>
          <p className="mt-2 text-gray-600">
            {error === 'expired'
              ? 'Срок действия этой ссылки истёк'
              : 'Проверьте правильность ссылки'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-xl font-bold text-center text-gray-900">
          {formData?.company_name}
        </h1>
        <p className="text-center text-gray-500 mt-1 mb-6">Оставьте отзыв о нашем сервисе</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
              Ваша оценка
            </label>
            <StarRating value={stars} onChange={setStars} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ваш отзыв
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full border rounded-lg p-3 min-h-[120px] text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Расскажите о вашем опыте..."
            />
            <p className="text-xs text-gray-400 mt-1">{text.length}/2000</p>
          </div>

          {error && error !== 'expired' && error !== 'not_found' && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Отправка...' : 'Отправить отзыв'}
          </button>
        </form>
      </div>
    </div>
  );
}
