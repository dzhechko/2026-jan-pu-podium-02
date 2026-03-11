import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export function OptOut() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    fetch(`/api/optout/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error('failed');
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {status === 'loading' && <p className="text-gray-400">Обработка...</p>}
        {status === 'success' && (
          <>
            <h1 className="text-xl font-bold text-gray-900">Вы отписаны</h1>
            <p className="mt-2 text-gray-600">Вы больше не будете получать SMS от нас</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-xl font-bold text-gray-900">Ошибка</h1>
            <p className="mt-2 text-gray-600">Не удалось обработать отписку</p>
          </>
        )}
      </div>
    </div>
  );
}
