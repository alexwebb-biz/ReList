import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { stripe, isStripeConfigured, PLANS, getPlanByPriceId, PlanType } from '../config/stripe.js';
import supabase from '../config/supabase.js';
import { success, error } from '../utils/response.js';

const router = Router();

// Middleware to check if Stripe is configured
const requireStripe = (req: Request, res: Response, next: Function) => {
  if (!isStripeConfigured()) {
    return res.status(503).json(error('STRIPE_NOT_CONFIGURED', 'Stripe payments are not configured'));
  }
  next();
};

// Get available plans
router.get('/plans', (req: Request, res: Response) => {
  const plans = Object.entries(PLANS).map(([key, plan]) => ({
    id: key,
    name: plan.name,
    price: plan.price,
    features: plan.features,
    alerts: plan.alerts,
    aiCredits: plan.aiCredits,
  }));

  res.json(success(plans));
});

// Create checkout session
router.post('/create-checkout', authenticateToken, requireStripe, async (req: Request, res: Response) => {
  try {
    const { planId } = req.body;
    const userId = req.user!.id;
    const email = req.user!.email;

    const plan = PLANS[planId as PlanType];
    if (!plan || !plan.priceId) {
      return res.status(400).json(error('INVALID_PLAN', 'Invalid plan selected'));
    }

    // Check if user already has a Stripe customer ID
    const { data: user } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    let customerId = user?.stripe_customer_id;

    // Create new Stripe customer if needed
    if (!customerId) {
      const customer = await stripe!.customers.create({
        email,
        metadata: { userId },
      });
      customerId = customer.id;

      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    // Create checkout session
    const session = await stripe!.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/settings?checkout=success`,
      cancel_url: `${process.env.FRONTEND_URL}/settings?checkout=cancelled`,
      metadata: {
        userId,
        planId,
      },
    });

    res.json(success({ url: session.url }));
  } catch (err) {
    console.error('Error creating checkout session:', err);
    res.status(500).json(error('CHECKOUT_ERROR', 'Failed to create checkout session'));
  }
});

// Create customer portal session
router.post('/customer-portal', authenticateToken, requireStripe, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const { data: user } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!user?.stripe_customer_id) {
      return res.status(400).json(error('NO_SUBSCRIPTION', 'No active subscription found'));
    }

    const session = await stripe!.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/settings`,
    });

    res.json(success({ url: session.url }));
  } catch (err) {
    console.error('Error creating portal session:', err);
    res.status(500).json(error('PORTAL_ERROR', 'Failed to create portal session'));
  }
});

// Get current subscription (and sync from Stripe if needed)
router.get('/subscription', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const { data: user } = await supabase
      .from('users')
      .select('stripe_customer_id, subscription_tier, subscription_status, ai_credits_remaining')
      .eq('id', userId)
      .single();

    // If Stripe isn't configured or user has no customer ID, return free plan
    if (!isStripeConfigured() || !user?.stripe_customer_id) {
      return res.json(success({
        plan: user?.subscription_tier || 'free',
        status: 'active',
        aiCredits: user?.ai_credits_remaining || 10,
        features: PLANS.free.features,
      }));
    }

    // Get subscription from Stripe
    const subscriptions = await stripe!.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // No active subscription - sync to free if database shows otherwise
      if (user.subscription_tier !== 'free') {
        await supabase
          .from('users')
          .update({
            subscription_tier: 'free',
            subscription_status: 'inactive',
          })
          .eq('id', userId);
      }

      return res.json(success({
        plan: 'free',
        status: 'inactive',
        aiCredits: user.ai_credits_remaining,
        features: PLANS.free.features,
      }));
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price.id;
    const planType = getPlanByPriceId(priceId || '') || 'free';
    const plan = PLANS[planType];

    // Sync database if it doesn't match Stripe (useful when webhooks aren't working)
    if (user.subscription_tier !== planType || user.subscription_status !== subscription.status) {
      console.log(`Syncing subscription for user ${userId}: ${user.subscription_tier} -> ${planType}`);
      await supabase
        .from('users')
        .update({
          subscription_tier: planType,
          subscription_status: subscription.status,
          ai_credits_remaining: user.subscription_tier === 'free' ? plan.aiCredits : user.ai_credits_remaining,
        })
        .eq('id', userId);
    }

    res.json(success({
      plan: planType,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      aiCredits: user.subscription_tier === 'free' && planType !== 'free' ? plan.aiCredits : user.ai_credits_remaining,
      features: plan.features,
    }));
  } catch (err) {
    console.error('Error fetching subscription:', err);
    res.status(500).json(error('FETCH_ERROR', 'Failed to fetch subscription'));
  }
});

// Sync subscription from Stripe to database (for when webhooks aren't available)
router.post('/sync', authenticateToken, requireStripe, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const { data: user } = await supabase
      .from('users')
      .select('stripe_customer_id, subscription_tier')
      .eq('id', userId)
      .single();

    if (!user?.stripe_customer_id) {
      return res.json(success({ synced: false, message: 'No Stripe customer ID' }));
    }

    // Get active subscription from Stripe
    const subscriptions = await stripe!.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // No active subscription - set to free
      await supabase
        .from('users')
        .update({
          subscription_tier: 'free',
          subscription_status: 'inactive',
          ai_credits_remaining: PLANS.free.aiCredits,
        })
        .eq('id', userId);

      return res.json(success({ synced: true, plan: 'free' }));
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price.id;
    const planType = getPlanByPriceId(priceId || '') || 'free';
    const plan = PLANS[planType];

    // Update database
    await supabase
      .from('users')
      .update({
        subscription_tier: planType,
        subscription_status: subscription.status,
        ai_credits_remaining: plan.aiCredits,
      })
      .eq('id', userId);

    console.log(`Synced subscription for user ${userId}: ${planType}`);

    return res.json(success({ synced: true, plan: planType }));
  } catch (err) {
    console.error('Error syncing subscription:', err);
    res.status(500).json(error('SYNC_ERROR', 'Failed to sync subscription'));
  }
});

// Stripe webhook handler
router.post('/webhook', async (req: Request, res: Response) => {
  if (!isStripeConfigured()) {
    return res.status(503).send('Stripe not configured');
  }

  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Stripe webhook secret not configured');
    return res.status(400).send('Webhook secret not configured');
  }

  let event;

  try {
    event = stripe!.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any;
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId;

      if (userId && planId) {
        const plan = PLANS[planId as PlanType];
        await supabase
          .from('users')
          .update({
            subscription_tier: planId,
            subscription_status: 'active',
            ai_credits_remaining: plan.aiCredits,
          })
          .eq('id', userId);

        console.log(`User ${userId} subscribed to ${planId}`);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as any;
      const customerId = subscription.customer;

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (user) {
        const priceId = subscription.items.data[0]?.price.id;
        const planType = getPlanByPriceId(priceId || '') || 'free';

        await supabase
          .from('users')
          .update({
            subscription_tier: planType,
            subscription_status: subscription.status,
          })
          .eq('id', user.id);

        console.log(`User ${user.id} subscription updated to ${planType}`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as any;
      const customerId = subscription.customer;

      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (user) {
        await supabase
          .from('users')
          .update({
            subscription_tier: 'free',
            subscription_status: 'cancelled',
            ai_credits_remaining: PLANS.free.aiCredits,
          })
          .eq('id', user.id);

        console.log(`User ${user.id} subscription cancelled`);
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

export default router;
