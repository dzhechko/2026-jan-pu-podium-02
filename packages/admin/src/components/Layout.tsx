import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';

const navItems = [
  { to: '/', label: 'Дашборд' },
  { to: '/clients', label: 'Клиенты' },
  { to: '/reviews', label: 'Отзывы' },
  { to: '/settings', label: 'Настройки' },
];

export function Layout() {
  const { admin, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-gray-900">ReviewHub</h1>
          <p className="text-sm text-gray-500 truncate">{admin?.company_name}</p>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t">
          <p className="text-xs text-gray-400 truncate mb-2">{admin?.email}</p>
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Выйти
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
