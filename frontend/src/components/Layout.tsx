import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Shirt, Sparkles, LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export function Layout() {
  const { logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Wardrobe', path: '/wardrobe', icon: Shirt },
    { name: 'Suggest', path: '/suggest', icon: Sparkles },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans text-zinc-900">
      {/* Top Navigation (Desktop) */}
      <header className="sticky top-0 z-10 bg-white border-b border-zinc-200 hidden md:block">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-lg tracking-tight">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            GRWM
          </div>
          <nav className="flex items-center gap-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 text-sm font-medium transition-colors hover:text-indigo-600",
                    isActive ? "text-indigo-600" : "text-zinc-500"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
            <button
              onClick={logout}
              className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-red-600 transition-colors ml-4"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-zinc-200 md:hidden h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          GRWM
        </div>
        <button onClick={logout} className="p-2 text-zinc-500 hover:text-red-600">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-6 pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 pb-safe z-20">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1",
                  isActive ? "text-indigo-600" : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                <Icon className={cn("w-6 h-6", isActive && "fill-indigo-50")} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
