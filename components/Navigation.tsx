import React, { useState, useEffect } from 'react';
import { ViewState } from '../types';
import { LayoutDashboard, ShoppingBag, Bell, Settings, LogOut, LogIn, Search, BarChart3, Menu, X, FlaskConical } from 'lucide-react';
import { Logo } from './Logo';
import { useAuthStore } from '../stores/authStore';
import { NotificationBell } from './NotificationBell';

interface NavigationProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  onOpenAuth: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, setView, onOpenAuth }) => {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when view changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentView]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    await logout();
    setIsMobileMenuOpen(false);
  };

  const handleNavClick = (view: ViewState) => {
    setView(view);
    setIsMobileMenuOpen(false);
  };

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState; icon: any; label: string }) => (
    <button
      onClick={() => handleNavClick(view)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
        ${currentView === view
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
    >
      <Icon className={`w-5 h-5 ${currentView === view ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );

  // Mobile Header Bar
  const MobileHeader = () => (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b border-slate-800 px-4 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <Logo className="w-7 h-7" light={true} />
          <h1 className="text-lg font-bold text-white">ReList</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        {isAuthenticated && user && (
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
            {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
          </div>
        )}
      </div>
    </div>
  );

  // Sidebar Navigation Content
  const SidebarContent = () => (
    <>
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo className="w-8 h-8" light={true} />
          <h1 className="text-xl font-bold text-white tracking-tight">ReList</h1>
        </div>
        <div className="hidden lg:block">
          <NotificationBell />
        </div>
        {/* Mobile close button */}
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 space-y-2 flex-1 mt-6 overflow-y-auto">
        <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
        <NavItem view="inventory" icon={ShoppingBag} label="Inventory" />
        <NavItem view="alerts" icon={Bell} label="Smart Alerts" />
        <NavItem view="results" icon={Search} label="Alert Results" />
        <NavItem view="analytics" icon={BarChart3} label="Analytics" />
        <NavItem view="research" icon={FlaskConical} label="Research" />
        <div className="pt-4 mt-4 border-t border-slate-800">
          <NavItem view="settings" icon={Settings} label="Settings" />
        </div>
      </div>

      <div className="p-4 border-t border-slate-800">
        {isAuthenticated ? (
          <div className="space-y-3">
            {/* User Info */}
            <div className="px-4 py-2">
              <p className="text-white text-sm font-medium truncate">{user?.full_name || 'User'}</p>
              <p className="text-slate-400 text-xs truncate">{user?.email}</p>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded capitalize">
                  {user?.subscription_tier}
                </span>
              </div>
            </div>
            {/* Sign Out Button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-900/10 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">Sign Out</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => { onOpenAuth(); setIsMobileMenuOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-blue-400 hover:bg-blue-900/10 rounded-lg transition-colors"
          >
            <LogIn className="w-5 h-5" />
            <span className="font-medium text-sm">Sign In</span>
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <MobileHeader />

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`lg:hidden fixed top-0 left-0 h-full w-72 bg-slate-900 z-50 transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <SidebarContent />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 bg-slate-900 h-screen flex-col border-r border-slate-800 sticky top-0 left-0">
        <SidebarContent />
      </div>
    </>
  );
};
