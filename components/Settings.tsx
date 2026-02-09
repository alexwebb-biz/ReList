import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { User, Bell, CreditCard, Key, Shield, Loader2, Check, ExternalLink } from 'lucide-react';
import { Card, Button, Badge, Input } from './ui/UIComponents';

interface SubscriptionInfo {
  plan: string;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  aiCredits: number;
  features: string[];
}

interface Plan {
  id: string;
  name: string;
  price: number;
  features: string[];
  alerts: number;
  aiCredits: number;
}

export const Settings: React.FC = () => {
  const { user, checkAuth } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [postcode, setPostcode] = useState(user?.location_postcode || '');

  // Notification state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [telegramNotifications, setTelegramNotifications] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [isTelegramVerified, setIsTelegramVerified] = useState(false);
  const [isVerifyingTelegram, setIsVerifyingTelegram] = useState(false);
  const [discordNotifications, setDiscordNotifications] = useState(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [isDiscordVerified, setIsDiscordVerified] = useState(false);
  const [isVerifyingDiscord, setIsVerifyingDiscord] = useState(false);

  // Subscription state
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    loadSubscription();
    loadPlans();
    loadNotificationSettings();

    // Check if returning from Stripe checkout
    const urlParams = new URLSearchParams(window.location.search);
    const checkoutStatus = urlParams.get('checkout');
    if (checkoutStatus === 'success') {
      // Sync subscription from Stripe and refresh user data
      syncSubscription();
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPostcode(user.location_postcode || '');
    }
  }, [user]);

  const loadSubscription = async (refreshAuth = false) => {
    const response = await api.get<SubscriptionInfo>('/stripe/subscription');
    if (response.success && response.data) {
      setSubscription(response.data);
      // Only refresh auth when explicitly requested (e.g., after checkout)
      if (refreshAuth) {
        checkAuth();
      }
    }
  };

  const syncSubscription = async () => {
    setIsLoading(true);
    // Sync subscription from Stripe (useful when webhooks aren't working)
    await api.post('/stripe/sync', {});
    // Reload subscription data and refresh auth
    await loadSubscription(true);
    setIsLoading(false);
    setMessage({ type: 'success', text: 'Subscription synced successfully!' });
  };

  const loadPlans = async () => {
    const response = await api.get<Plan[]>('/stripe/plans');
    if (response.success && response.data) {
      setPlans(response.data);
    }
  };

  const loadNotificationSettings = async () => {
    const response = await api.get<{
      notification_email: boolean;
      notification_push: boolean;
      notification_telegram: boolean;
      telegram_chat_id: string | null;
      notification_discord: boolean;
      discord_webhook_url: string | null;
    }>('/user/notification-settings');
    if (response.success && response.data) {
      setEmailNotifications(response.data.notification_email ?? true);
      setPushNotifications(response.data.notification_push ?? false);
      setTelegramNotifications(response.data.notification_telegram ?? false);
      setTelegramChatId(response.data.telegram_chat_id || '');
      setIsTelegramVerified(!!response.data.telegram_chat_id);
      setDiscordNotifications(response.data.notification_discord ?? false);
      setDiscordWebhookUrl(response.data.discord_webhook_url || '');
      setIsDiscordVerified(!!response.data.discord_webhook_url);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage(null);

    const response = await api.updateProfile({
      full_name: fullName,
      location_postcode: postcode,
    });

    if (response.success) {
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      checkAuth(); // Refresh user data
    } else {
      setMessage({ type: 'error', text: response.error?.message || 'Failed to update profile' });
    }

    setIsSaving(false);
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    setMessage(null);

    const response = await api.patch('/user/notification-settings', {
      notification_email: emailNotifications,
      notification_push: pushNotifications,
      notification_telegram: telegramNotifications,
      telegram_chat_id: telegramChatId || null,
      notification_discord: discordNotifications,
      discord_webhook_url: discordWebhookUrl || null,
    });

    if (response.success) {
      setMessage({ type: 'success', text: 'Notification settings saved!' });
      setIsTelegramVerified(!!telegramChatId);
      setIsDiscordVerified(!!discordWebhookUrl);
    } else {
      setMessage({ type: 'error', text: 'Failed to save notification settings' });
    }

    setIsSaving(false);
  };

  const handleTestTelegram = async () => {
    if (!telegramChatId) {
      setMessage({ type: 'error', text: 'Please enter your Chat ID or Channel ID' });
      return;
    }

    setIsVerifyingTelegram(true);
    setMessage(null);

    const response = await api.post('/user/test-telegram', {
      telegram_chat_id: telegramChatId,
    });

    if (response.success) {
      setMessage({ type: 'success', text: 'Test message sent! Check your Telegram.' });
      setIsTelegramVerified(true);
    } else {
      setMessage({ type: 'error', text: response.error?.message || 'Failed to send test message. Make sure you\'ve started a chat with @ReListBot first.' });
      setIsTelegramVerified(false);
    }

    setIsVerifyingTelegram(false);
  };

  const handleTestDiscord = async () => {
    if (!discordWebhookUrl) {
      setMessage({ type: 'error', text: 'Please enter your Discord webhook URL' });
      return;
    }

    setIsVerifyingDiscord(true);
    setMessage(null);

    const response = await api.post('/user/test-discord', {
      discord_webhook_url: discordWebhookUrl,
    });

    if (response.success) {
      setMessage({ type: 'success', text: 'Test message sent! Check your Discord channel.' });
      setIsDiscordVerified(true);
    } else {
      setMessage({ type: 'error', text: response.error?.message || 'Failed to send test message. Make sure your webhook URL is correct.' });
      setIsDiscordVerified(false);
    }

    setIsVerifyingDiscord(false);
  };

  const handleUpgrade = async (planId: string) => {
    setIsLoading(true);

    const response = await api.post<{ url: string }>('/stripe/create-checkout', { planId });

    if (response.success && response.data?.url) {
      window.location.href = response.data.url;
    } else {
      setMessage({ type: 'error', text: 'Failed to start checkout' });
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsLoading(true);

    const response = await api.post<{ url: string }>('/stripe/customer-portal', {});

    if (response.success && response.data?.url) {
      window.location.href = response.data.url;
    } else {
      setMessage({ type: 'error', text: 'Failed to open billing portal' });
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Settings</h2>
        <p className="text-sm md:text-base text-slate-500 dark:text-neutral-500">Manage your account preferences and subscription.</p>
      </div>

      {message && (
        <div className={`mb-4 md:mb-6 p-3 md:p-4 rounded-lg flex items-center gap-2 text-sm md:text-base ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' && <Check size={18} />}
          {message.text}
        </div>
      )}

      <div className="bg-white dark:bg-neutral-900/80 rounded-xl shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-slate-200 dark:border-white/5 overflow-x-auto">
          <div className="flex min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-500 dark:text-neutral-500 border-transparent hover:text-slate-700 dark:text-neutral-300'
                }`}
              >
                <tab.icon size={16} className="md:w-[18px] md:h-[18px]" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4 md:p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-4 md:space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5 md:mb-2">Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-slate-200 dark:border-neutral-700 rounded-lg bg-slate-50 dark:bg-neutral-800 text-slate-500 dark:text-neutral-300"
                />
                <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5 md:mb-2">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 md:px-4 py-2 text-sm md:text-base bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500"
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5 md:mb-2">Location (Postcode)</label>
                <input
                  type="text"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  className="w-full px-3 md:px-4 py-2 text-sm md:text-base bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500"
                  placeholder="e.g. SW1A 1AA"
                />
                <p className="text-xs text-slate-400 mt-1">Used for location-based alerts</p>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="w-full sm:w-auto bg-violet-600 text-white px-6 py-2.5 md:py-2 rounded-lg hover:bg-violet-500 font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm md:text-base"
              >
                {isSaving && <Loader2 size={16} className="animate-spin" />}
                Save Changes
              </button>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-4 md:space-y-6">
              <div className="flex items-center justify-between p-3 md:p-4 bg-slate-50 dark:bg-neutral-900/50 rounded-lg gap-3">
                <div className="min-w-0">
                  <h4 className="font-medium text-slate-900 dark:text-white text-sm md:text-base">Email Notifications</h4>
                  <p className="text-xs md:text-sm text-slate-500 dark:text-neutral-500">Receive alerts and updates via email</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-neutral-700 peer-focus:ring-2 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 md:p-4 bg-slate-50 dark:bg-neutral-900/50 rounded-lg gap-3">
                <div className="min-w-0">
                  <h4 className="font-medium text-slate-900 dark:text-white text-sm md:text-base">Push Notifications</h4>
                  <p className="text-xs md:text-sm text-slate-500 dark:text-neutral-500">Get instant notifications in your browser</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={pushNotifications}
                    onChange={(e) => setPushNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-neutral-700 peer-focus:ring-2 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                </label>
              </div>

              {/* Telegram Notifications Section */}
              <div className="p-3 md:p-4 bg-slate-50 dark:bg-neutral-900/50 rounded-lg space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-medium text-slate-900 dark:text-white text-sm md:text-base">Telegram Notifications</h4>
                    <p className="text-xs md:text-sm text-slate-500 dark:text-neutral-500">Receive instant alerts via Telegram</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={telegramNotifications}
                      onChange={(e) => setTelegramNotifications(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-neutral-700 peer-focus:ring-2 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                  </label>
                </div>

                {telegramNotifications && (
                  <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/5">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                      <p className="text-xs md:text-sm text-blue-800">
                        <strong>Setup Instructions:</strong>
                      </p>
                      <ol className="text-xs md:text-sm text-blue-700 mt-2 space-y-1 list-decimal list-inside">
                        <li>Start a chat with <a href="https://t.me/ReListBot" target="_blank" rel="noopener noreferrer" className="underline font-medium">@ReListBot</a> on Telegram</li>
                        <li>Send any message to start the conversation</li>
                        <li>Get your Chat ID from <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="underline">@userinfobot</a></li>
                        <li>Or use a channel ID (e.g., @mychannel or -100123456789)</li>
                      </ol>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5 md:mb-2">Chat ID or Channel ID</label>
                      <input
                        type="text"
                        value={telegramChatId}
                        onChange={(e) => {
                          setTelegramChatId(e.target.value);
                          setIsTelegramVerified(false);
                        }}
                        className="w-full px-3 md:px-4 py-2 text-sm md:text-base bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500"
                        placeholder="123456789 or @yourchannel"
                      />
                      <p className="text-xs text-slate-400 mt-1">Your personal chat ID or a channel where you've added @ReListBot as admin</p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <button
                        onClick={handleTestTelegram}
                        disabled={isVerifyingTelegram || !telegramChatId}
                        className="bg-slate-800 text-white px-4 py-2.5 md:py-2 rounded-lg text-sm font-medium hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isVerifyingTelegram && <Loader2 size={14} className="animate-spin" />}
                        Send Test Message
                      </button>
                      {isTelegramVerified && (
                        <span className="flex items-center gap-1 text-emerald-600 text-sm">
                          <Check size={16} />
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Discord Notifications Section */}
              <div className="p-3 md:p-4 bg-slate-50 dark:bg-neutral-900/50 rounded-lg space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-medium text-slate-900 dark:text-white text-sm md:text-base">Discord Notifications</h4>
                    <p className="text-xs md:text-sm text-slate-500 dark:text-neutral-500">Receive instant alerts via Discord webhook</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={discordNotifications}
                      onChange={(e) => setDiscordNotifications(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-neutral-700 peer-focus:ring-2 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                  </label>
                </div>

                {discordNotifications && (
                  <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/5">
                    <div className="bg-violet-50 border border-violet-100 rounded-lg p-3">
                      <p className="text-xs md:text-sm text-violet-800">
                        <strong>Setup Instructions:</strong>
                      </p>
                      <ol className="text-xs md:text-sm text-violet-700 mt-2 space-y-1 list-decimal list-inside">
                        <li>Open your Discord server settings</li>
                        <li>Go to Integrations → Webhooks → New Webhook</li>
                        <li>Choose the channel where you want notifications</li>
                        <li>Copy the Webhook URL and paste it below</li>
                      </ol>
                      <p className="text-xs text-violet-600 mt-2">
                        <strong>Note:</strong> Keep your webhook URL private - anyone with it can send messages to your channel.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5 md:mb-2">Discord Webhook URL</label>
                      <input
                        type="text"
                        value={discordWebhookUrl}
                        onChange={(e) => {
                          setDiscordWebhookUrl(e.target.value);
                          setIsDiscordVerified(false);
                        }}
                        className="w-full px-3 md:px-4 py-2 text-sm md:text-base bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500"
                        placeholder="https://discord.com/api/webhooks/..."
                      />
                      <p className="text-xs text-slate-400 mt-1">Paste your Discord webhook URL here</p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <button
                        onClick={handleTestDiscord}
                        disabled={isVerifyingDiscord || !discordWebhookUrl}
                        className="bg-violet-600 text-white px-4 py-2.5 md:py-2 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isVerifyingDiscord && <Loader2 size={14} className="animate-spin" />}
                        Send Test Message
                      </button>
                      {isDiscordVerified && (
                        <span className="flex items-center gap-1 text-emerald-600 text-sm">
                          <Check size={16} />
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleSaveNotifications}
                disabled={isSaving}
                className="w-full sm:w-auto bg-violet-600 text-white px-6 py-2.5 md:py-2 rounded-lg hover:bg-violet-500 font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm md:text-base"
              >
                {isSaving && <Loader2 size={16} className="animate-spin" />}
                Save Preferences
              </button>
            </div>
          )}

          {/* Subscription Tab */}
          {activeTab === 'subscription' && (
            <div className="space-y-4 md:space-y-6">
              {/* Current Plan */}
              {subscription && (
                <div className="p-4 md:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div>
                      <h4 className="text-base md:text-lg font-bold text-slate-900 dark:text-white capitalize">{subscription.plan} Plan</h4>
                      <p className="text-xs md:text-sm text-slate-600 dark:text-neutral-400 mt-1">
                        Status: <span className={`font-medium ${subscription.status === 'active' ? 'text-emerald-600' : 'text-slate-500 dark:text-neutral-500'}`}>
                          {subscription.status}
                        </span>
                      </p>
                      {subscription.currentPeriodEnd && (
                        <p className="text-xs md:text-sm text-slate-500 dark:text-neutral-500 mt-1">
                          {subscription.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="sm:text-right">
                      <p className="text-xs md:text-sm text-slate-500 dark:text-neutral-500">AI Credits</p>
                      <p className="text-xl md:text-2xl font-bold text-blue-600">{subscription.aiCredits}</p>
                    </div>
                  </div>

                  {subscription.plan !== 'free' && (
                    <button
                      onClick={handleManageSubscription}
                      disabled={isLoading}
                      className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                    >
                      Manage Subscription <ExternalLink size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Available Plans */}
              <div>
                <h4 className="text-base md:text-lg font-bold text-slate-900 dark:text-white mb-3 md:mb-4">Available Plans</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`p-3 md:p-4 rounded-xl border-2 transition-all ${
                        subscription?.plan === plan.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 dark:border-white/5 hover:border-slate-300'
                      }`}
                    >
                      <h5 className="font-bold text-slate-900 dark:text-white text-sm md:text-base">{plan.name}</h5>
                      <p className="text-lg md:text-xl font-bold text-slate-900 dark:text-white mt-1">
                        {plan.price === 0 ? 'Free' : `£${plan.price}/mo`}
                      </p>
                      <p className="text-xs md:text-sm text-slate-500 dark:text-neutral-500 mt-2">
                        {plan.alerts === -1 ? 'Unlimited' : plan.alerts} alerts
                      </p>
                      <p className="text-xs md:text-sm text-slate-500 dark:text-neutral-500">
                        {plan.aiCredits} AI credits/mo
                      </p>
                      <ul className="mt-2 md:mt-3 space-y-1 hidden sm:block">
                        {plan.features.slice(0, 3).map((feature, i) => (
                          <li key={i} className="text-xs text-slate-600 dark:text-neutral-400 flex items-center gap-1">
                            <Check size={12} className="text-emerald-500 flex-shrink-0" />
                            <span className="truncate">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {subscription?.plan !== plan.id && plan.id !== 'free' && (
                        <button
                          onClick={() => handleUpgrade(plan.id)}
                          disabled={isLoading}
                          className="mt-3 md:mt-4 w-full bg-violet-600 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Upgrade'}
                        </button>
                      )}
                      {subscription?.plan === plan.id && (
                        <div className="mt-3 md:mt-4 text-center text-xs md:text-sm text-blue-600 font-medium">
                          Current Plan
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-4 md:space-y-6">
              <div className="p-3 md:p-4 bg-slate-50 dark:bg-neutral-900/50 rounded-lg">
                <h4 className="font-medium text-slate-900 dark:text-white mb-1 md:mb-2 text-sm md:text-base">Change Password</h4>
                <p className="text-xs md:text-sm text-slate-500 dark:text-neutral-500 mb-3 md:mb-4">Update your password to keep your account secure</p>
                <button className="w-full sm:w-auto bg-slate-800 text-white px-4 py-2.5 md:py-2 rounded-lg text-sm font-medium hover:bg-slate-900">
                  Change Password
                </button>
              </div>

              <div className="p-3 md:p-4 bg-slate-50 dark:bg-neutral-900/50 rounded-lg">
                <h4 className="font-medium text-slate-900 dark:text-white mb-1 md:mb-2 text-sm md:text-base">Two-Factor Authentication</h4>
                <p className="text-xs md:text-sm text-slate-500 dark:text-neutral-500 mb-3 md:mb-4">Add an extra layer of security to your account</p>
                <button className="w-full sm:w-auto bg-slate-200 text-slate-600 dark:text-neutral-400 px-4 py-2.5 md:py-2 rounded-lg text-sm font-medium cursor-not-allowed">
                  Coming Soon
                </button>
              </div>

              <div className="p-3 md:p-4 bg-red-50 rounded-lg border border-red-100">
                <h4 className="font-medium text-red-800 mb-1 md:mb-2 text-sm md:text-base">Delete Account</h4>
                <p className="text-xs md:text-sm text-red-600 mb-3 md:mb-4">Permanently delete your account and all data</p>
                <button className="w-full sm:w-auto bg-red-600 text-white px-4 py-2.5 md:py-2 rounded-lg text-sm font-medium hover:bg-red-700">
                  Delete Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
