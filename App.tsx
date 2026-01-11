import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
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

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [showAuthModal, setShowAuthModal] = useState(false);

  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Check for Stripe checkout result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      setCurrentView('settings');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
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
        return <Dashboard />;
    }
  };

  const getPageTitle = () => {
    switch (currentView) {
      case 'results':
        return 'Alert Results';
      default:
        return currentView;
    }
  };

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navigation
        currentView={currentView}
        setView={setCurrentView}
        onOpenAuth={() => setShowAuthModal(true)}
      />

      <main className="flex-1 lg:max-h-screen overflow-y-auto w-full">
        {/* Desktop Header - hidden on mobile since Navigation has mobile header */}
        <header className="hidden lg:flex bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10 justify-between items-center shadow-sm">
           <h2 className="text-lg md:text-xl font-bold text-slate-800 capitalize">{getPageTitle()}</h2>
           <div className="flex items-center gap-4">
              {isAuthenticated && user ? (
                <>
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-semibold text-slate-800">{user.full_name || 'User'}</p>
                    <p className="text-xs text-slate-500 capitalize">{user.subscription_tier} Plan</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200">
                    {getInitials()}
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Sign In
                </button>
              )}
           </div>
        </header>

        {/* Mobile Page Title */}
        <div className="lg:hidden pt-20 px-4 pb-3 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 capitalize">{getPageTitle()}</h2>
        </div>

        <div className="p-4 md:p-6 lg:p-8 pb-24">
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
