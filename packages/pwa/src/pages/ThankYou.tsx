import { useLocation } from 'react-router-dom';

interface ReviewResult {
  sentiment: string;
  redirect_url: string | null;
  promo_code: string | null;
  discount_text: string | null;
  discount_percent: number | null;
}

export function ThankYou() {
  const location = useLocation();
  const result = location.state as ReviewResult | null;

  if (!result) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">Спасибо за отзыв!</h1>
        </div>
      </div>
    );
  }

  if (result.redirect_url) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-2xl shadow-lg p-8">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-bold text-gray-900">Спасибо за отзыв!</h1>
          <p className="text-gray-600 mt-2 mb-6">
            Будем рады, если вы оставите отзыв на Яндекс Картах
          </p>
          <a
            href={result.redirect_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Оставить отзыв на Яндекс Картах
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="text-5xl mb-4">🎁</div>
        <h1 className="text-xl font-bold text-gray-900">Спасибо за отзыв!</h1>
        <p className="text-gray-600 mt-2">Мы учтём ваше мнение</p>

        {result.promo_code && (
          <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-200">
            <p className="text-sm text-gray-600">
              {result.discount_text} — {result.discount_percent}%
            </p>
            <p className="mt-2 text-2xl font-mono font-bold text-green-700">
              {result.promo_code}
            </p>
            <p className="text-xs text-gray-400 mt-1">Покажите этот код при следующем визите</p>
          </div>
        )}
      </div>
    </div>
  );
}
