import React, { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Package,
  Zap,
  Search,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Bell,
  Sparkles,
  Sun,
  Moon,
  Shield,
  BarChart3
} from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { InventoryManager } from './components/InventoryManager';
import { AlertsManager } from './components/AlertsManager';
import { AlertResults } from './components/AlertResults';
import { Settings } from './components/Settings';
import { Analytics } from './components/Analytics';
import { Research } from './components/Research';
import Admin from './components/Admin';
import { AuthModal } from './components/AuthModal';
import { ViewState } from './types';
import { useAuthStore } from './stores/authStore';
import { useTheme } from './contexts/ThemeContext';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const { user, isAuthenticated, isLoading, checkAuth, logout } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Check for Stripe checkout result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      setCurrentView('settings');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Close mobile nav when view changes
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [currentView]);

  const navItems = [
    { id: 'dashboard' as ViewState, label: 'Dashboard', icon: LayoutGrid },
    { id: 'inventory' as ViewState, label: 'Inventory', icon: Package },
    { id: 'alerts' as ViewState, label: 'Smart Alerts', icon: Zap },
    { id: 'results' as ViewState, label: 'Alert Results', icon: Search },
    { id: 'analytics' as ViewState, label: 'Analytics', icon: BarChart3 },
    { id: 'research' as ViewState, label: 'AI Research', icon: Search },
    { id: 'settings' as ViewState, label: 'Settings', icon: SettingsIcon },
  ];

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onViewChange={(v) => setCurrentView(v as ViewState)} />;
      case 'inventory':
        return <InventoryManager />;
      case 'alerts':
        return <AlertsManager />;
      case 'results':
        return <AlertResults />;
      case 'settings':
        return <Settings />;
      case 'analytics':
        return <Analytics />;
      case 'research':
        return <Research />;
      case 'admin':
        return <Admin />;
      default:
        return <Dashboard onViewChange={(v) => setCurrentView(v as ViewState)} />;
    }
  };

  const getPageTitle = () => {
    const item = navItems.find(i => i.id === currentView);
    return item?.label || currentView;
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (user?.full_name) {
      return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-neutral-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 font-sans text-slate-900 dark:text-neutral-200 flex selection:bg-violet-500/30">

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-72 fixed h-full z-20 border-r border-slate-200 dark:border-white/5 bg-white dark:bg-neutral-950/50 dark:backdrop-blur-xl">
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3 font-bold text-xl tracking-tight text-slate-900 dark:text-white">
            <div className="w-10 h-10 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-900/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            ReList
          </div>
          <div className="mt-2 ml-1 text-xs text-slate-500 dark:text-neutral-500 font-medium tracking-wider uppercase">
            {user?.subscription_tier || 'Free'} Plan
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {navItems.map(item => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                  isActive
                    ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-white/5 font-semibold'
                    : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
                )}
                <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-violet-400' : 'text-slate-500 dark:text-neutral-500 group-hover:text-slate-700 dark:group-hover:text-neutral-300'}`} />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}

          {user?.email === 'alexjwebb13@gmail.com' && (
            <button
              onClick={() => setCurrentView('admin')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                currentView === 'admin'
                  ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-white/5 font-semibold'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              {currentView === 'admin' && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
              )}
              <Shield className={`w-5 h-5 transition-colors ${currentView === 'admin' ? 'text-violet-400' : 'text-slate-500 dark:text-neutral-500 group-hover:text-slate-700 dark:group-hover:text-neutral-300'}`} />
              <span className="text-sm">Admin</span>
            </button>
          )}
        </nav>

        {isAuthenticated && user ? (
          <div className="p-4 m-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-violet-900/20 dark:to-indigo-900/20 border border-slate-200 dark:border-violet-500/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white">
                {getInitials()}
              </div>
              <div className="overflow-hidden flex-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.full_name || user.email}</div>
                <div className="text-xs text-slate-600 dark:text-neutral-400 truncate">{user.email}</div>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-colors w-full px-1"
            >
              <LogOut className="w-3 h-3" /> Sign Out
            </button>
          </div>
        ) : (
          <div className="p-4 m-4">
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl font-medium transition-all duration-200"
            >
              Sign In
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 dark:bg-neutral-950/80 backdrop-blur-sm md:hidden" onClick={() => setIsMobileNavOpen(false)}></div>
      )}

      {/* Mobile Sidebar */}
      <div className={`fixed top-0 left-0 h-full w-72 bg-white dark:bg-neutral-900 border-r border-slate-200 dark:border-white/5 z-50 transform transition-transform duration-300 md:hidden ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex justify-between items-center border-b border-slate-200 dark:border-white/5">
          <span className="font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white"/>
            </div>
            ReList
          </span>
          <button onClick={() => setIsMobileNavOpen(false)} className="text-slate-600 dark:text-neutral-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium ${
                currentView === item.id ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}

          {user?.email === 'alexjwebb13@gmail.com' && (
            <button
              onClick={() => setCurrentView('admin')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium ${
                currentView === 'admin' ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <Shield className="w-5 h-5" />
              Admin
            </button>
          )}
        </nav>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 px-6 py-4 flex justify-between items-center bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md border-b border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileNavOpen(true)} className="md:hidden text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white">
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white hidden sm:block capitalize">{getPageTitle()}</h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center bg-slate-100 dark:bg-neutral-900 rounded-full px-3 py-1.5 border border-slate-200 dark:border-white/5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></div>
              <span className="text-xs font-medium text-slate-600 dark:text-neutral-400">System Operational</span>
            </div>

            <button
              onClick={toggleTheme}
              className="p-2 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            <button className="relative p-2 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-violet-500 rounded-full ring-2 ring-white dark:ring-neutral-950"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6 lg:p-10 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500 slide-in-from-bottom-2">
          {renderContent()}
        </div>
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
};

export default App;
