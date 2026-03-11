import { Routes, Route } from 'react-router-dom';
import { ReviewForm } from './pages/ReviewForm';
import { ThankYou } from './pages/ThankYou';
import { OptOut } from './pages/OptOut';

function App() {
  return (
    <Routes>
      <Route path="/review/:token" element={<ReviewForm />} />
      <Route path="/thank-you" element={<ThankYou />} />
      <Route path="/optout/:token" element={<OptOut />} />
      <Route path="*" element={
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-gray-900">ReviewHub</h1>
            <p className="mt-2 text-gray-600">Откройте ссылку из SMS для оставления отзыва</p>
          </div>
        </div>
      } />
    </Routes>
  );
}

export default App;
