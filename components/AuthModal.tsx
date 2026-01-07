import React, { useState } from 'react';
import { X, Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: 'login' | 'signup' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialView = 'login' }) => {
  const [view, setView] = useState<'login' | 'signup' | 'forgot' | 'reset'>(initialView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { login, signup, forgotPassword, resetPassword, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    clearError();

    if (view === 'login') {
      const success = await login(email, password);
      if (success) {
        onClose();
        resetForm();
      }
    } else if (view === 'signup') {
      if (password !== confirmPassword) {
        setMessage({ type: 'error', text: 'Passwords do not match' });
        return;
      }
      const success = await signup(email, password, fullName);
      if (success) {
        onClose();
        resetForm();
      }
    } else if (view === 'forgot') {
      const result = await forgotPassword(email);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        if (result.debugToken) {
          // In development, auto-fill the reset token
          setResetToken(result.debugToken);
          setView('reset');
        }
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } else if (view === 'reset') {
      if (password !== confirmPassword) {
        setMessage({ type: 'error', text: 'Passwords do not match' });
        return;
      }
      const result = await resetPassword(resetToken, password);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setTimeout(() => {
          setView('login');
          setMessage(null);
        }, 2000);
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setResetToken('');
    setMessage(null);
    clearError();
  };

  const switchView = (newView: 'login' | 'signup' | 'forgot' | 'reset') => {
    setView(newView);
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-6 py-6 sm:py-8 text-white relative">
          <button
            onClick={() => { onClose(); resetForm(); }}
            className="absolute top-3 sm:top-4 right-3 sm:right-4 p-1.5 sm:p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl sm:text-2xl font-bold">
            {view === 'login' && 'Welcome Back'}
            {view === 'signup' && 'Create Account'}
            {view === 'forgot' && 'Reset Password'}
            {view === 'reset' && 'New Password'}
          </h2>
          <p className="text-blue-100 mt-1 text-xs sm:text-sm">
            {view === 'login' && 'Sign in to continue to ReList'}
            {view === 'signup' && 'Start your reselling journey'}
            {view === 'forgot' && "We'll send you a reset link"}
            {view === 'reset' && 'Enter your new password'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {/* Error/Success Messages */}
          {(error || message) && (
            <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
              message?.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{message?.text || error}</span>
            </div>
          )}

          {/* Full Name (signup only) */}
          {view === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>
          )}

          {/* Email (login, signup, forgot) */}
          {(view === 'login' || view === 'signup' || view === 'forgot') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
          )}

          {/* Reset Token (reset view only) */}
          {view === 'reset' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reset Token</label>
              <input
                type="text"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                placeholder="Paste your reset token"
                required
              />
            </div>
          )}

          {/* Password (login, signup, reset) */}
          {(view === 'login' || view === 'signup' || view === 'reset') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {view === 'reset' ? 'New Password' : 'Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
            </div>
          )}

          {/* Confirm Password (signup, reset) */}
          {(view === 'signup' || view === 'reset') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
            </div>
          )}

          {/* Forgot Password Link */}
          {view === 'login' && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => switchView('forgot')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 sm:py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Please wait...</span>
              </>
            ) : (
              <>
                {view === 'login' && 'Sign In'}
                {view === 'signup' && 'Create Account'}
                {view === 'forgot' && 'Send Reset Link'}
                {view === 'reset' && 'Reset Password'}
              </>
            )}
          </button>

          {/* Switch View Links */}
          <div className="text-center text-xs sm:text-sm text-slate-600 pt-2 pb-2 sm:pb-0">
            {view === 'login' && (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchView('signup')}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign up
                </button>
              </>
            )}
            {view === 'signup' && (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchView('login')}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign in
                </button>
              </>
            )}
            {(view === 'forgot' || view === 'reset') && (
              <button
                type="button"
                onClick={() => switchView('login')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Back to sign in
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
