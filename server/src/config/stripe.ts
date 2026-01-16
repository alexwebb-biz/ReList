import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Only initialize Stripe if API key is provided
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' })
  : null;

export const isStripeConfigured = (): boolean => !!stripe;

// Subscription plan configuration
export const PLANS = {
  free: {
    name: 'Free',
    priceId: null,
    price: 0,
    alerts: 3,
    aiCredits: 10,
    features: ['3 active alerts', '10 AI credits/month', 'Basic notifications'],
  },
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    price: 9,
    alerts: 10,
    aiCredits: 100,
    features: ['10 active alerts', '100 AI credits/month', 'Email & Telegram notifications', 'Priority scraping'],
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    price: 29,
    alerts: 50,
    aiCredits: 500,
    features: ['50 active alerts', '500 AI credits/month', 'All notification channels', 'Real-time alerts', 'API access'],
  },
  business: {
    name: 'Business',
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    price: 99,
    alerts: -1, // unlimited
    aiCredits: 2000,
    features: ['Unlimited alerts', '2000 AI credits/month', 'White-label options', 'Dedicated support', 'Custom integrations'],
  },
};

export type PlanType = keyof typeof PLANS;

export const getPlanByPriceId = (priceId: string): PlanType | null => {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.priceId === priceId) {
      return key as PlanType;
    }
  }
  return null;
};

export default stripe;
