import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import supabase from '../config/supabase.js';

const router = express.Router();

// Get all users with their subscription and alert counts
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    // Get all users with their subscription info
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        subscription_tier,
        subscription_status,
        created_at,
        last_login_at
      `)
      .order('created_at', { ascending: false });

    if (usersError) throw usersError;

    // Get alert counts for each user
    const usersWithData = await Promise.all(
      (users || []).map(async (user) => {
        // Get active alerts count
        const { count: alertCount } = await supabase
          .from('alerts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_active', true);

        // Get total results count
        const { count: resultsCount } = await supabase
          .from('alert_results')
          .select('*', { count: 'exact', head: true })
          .in('alert_id',
            (await supabase
              .from('alerts')
              .select('id')
              .eq('user_id', user.id)).data?.map(a => a.id) || []
          );

        return {
          ...user,
          alert_count: alertCount || 0,
          results_count: resultsCount || 0,
        };
      })
    );

    res.json(usersWithData);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get detailed alerts for a specific user
router.get('/users/:userId/alerts', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: alerts, error } = await supabase
      .from('alerts')
      .select(`
        id,
        name,
        marketplace,
        search_query,
        price_min,
        price_max,
        is_active,
        check_interval,
        created_at,
        last_checked_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get result counts for each alert
    const alertsWithCounts = await Promise.all(
      (alerts || []).map(async (alert) => {
        const { count } = await supabase
          .from('alert_results')
          .select('*', { count: 'exact', head: true })
          .eq('alert_id', alert.id);

        return {
          ...alert,
          results_count: count || 0,
        };
      })
    );

    res.json(alertsWithCounts);
  } catch (error) {
    console.error('Admin alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch user alerts' });
  }
});

// Get admin stats (overview)
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    // Total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Active subscriptions
    const { count: activeSubscriptions } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'active');

    // Total alerts
    const { count: totalAlerts } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true });

    // Active alerts
    const { count: activeAlerts } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Total results found
    const { count: totalResults } = await supabase
      .from('alert_results')
      .select('*', { count: 'exact', head: true });

    // Subscription tier breakdown
    const { data: tierBreakdown } = await supabase
      .from('users')
      .select('subscription_tier')
      .not('subscription_tier', 'is', null);

    const tiers = tierBreakdown?.reduce((acc: any, user: any) => {
      const tier = user.subscription_tier || 'free';
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {}) || {};

    res.json({
      totalUsers: totalUsers || 0,
      activeSubscriptions: activeSubscriptions || 0,
      totalAlerts: totalAlerts || 0,
      activeAlerts: activeAlerts || 0,
      totalResults: totalResults || 0,
      subscriptionTiers: tiers,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
