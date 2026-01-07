import cron from 'node-cron';
import supabase from '../config/supabase.js';
import { queueAlert } from '../queues/alertQueue.js';

// Schedule alert processing jobs
export const startScheduler = () => {
  console.log('Starting alert scheduler...');

  // Process alerts every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running scheduled alert check...');
    await processScheduledAlerts();
  });

  // Reset AI credits monthly (first of each month at midnight)
  cron.schedule('0 0 1 * *', async () => {
    console.log('Resetting monthly AI credits...');
    await resetMonthlyCredits();
  });

  // Clean up old notifications (daily at 3am)
  cron.schedule('0 3 * * *', async () => {
    console.log('Cleaning up old notifications...');
    await cleanupOldNotifications();
  });

  // Clean up old alert results (weekly on Sunday at 4am)
  cron.schedule('0 4 * * 0', async () => {
    console.log('Cleaning up old alert results...');
    await cleanupOldResults();
  });

  console.log('Scheduler started');
};

// Process all active alerts that are due for checking
const processScheduledAlerts = async () => {
  try {
    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('id, user_id, check_frequency_minutes, last_checked_at')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching alerts:', error);
      return;
    }

    const now = new Date();

    for (const alert of alerts || []) {
      const lastChecked = alert.last_checked_at ? new Date(alert.last_checked_at) : new Date(0);
      const minutesSinceCheck = (now.getTime() - lastChecked.getTime()) / 60000;

      if (minutesSinceCheck >= alert.check_frequency_minutes) {
        console.log(`Queueing alert ${alert.id} for processing`);
        await queueAlert(alert.id, alert.user_id);
      }
    }
  } catch (error) {
    console.error('Error in scheduled alert processing:', error);
  }
};

// Reset AI credits for all users based on their plan
const resetMonthlyCredits = async () => {
  try {
    // Reset free users
    await supabase
      .from('users')
      .update({ ai_credits_remaining: 10 })
      .eq('subscription_tier', 'free');

    // Reset starter users
    await supabase
      .from('users')
      .update({ ai_credits_remaining: 100 })
      .eq('subscription_tier', 'starter');

    // Reset pro users
    await supabase
      .from('users')
      .update({ ai_credits_remaining: 500 })
      .eq('subscription_tier', 'pro');

    // Reset business users
    await supabase
      .from('users')
      .update({ ai_credits_remaining: 2000 })
      .eq('subscription_tier', 'business');

    console.log('AI credits reset completed');
  } catch (error) {
    console.error('Error resetting AI credits:', error);
  }
};

// Clean up notifications older than 30 days
const cleanupOldNotifications = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error } = await supabase
      .from('notifications')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString())
      .eq('is_read', true);

    if (error) {
      console.error('Error cleaning up notifications:', error);
    } else {
      console.log('Old notifications cleaned up');
    }
  } catch (error) {
    console.error('Error in notification cleanup:', error);
  }
};

// Clean up alert results older than 7 days (that aren't saved)
const cleanupOldResults = async () => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { error } = await supabase
      .from('alert_results')
      .delete()
      .lt('created_at', sevenDaysAgo.toISOString())
      .eq('is_saved', false);

    if (error) {
      console.error('Error cleaning up alert results:', error);
    } else {
      console.log('Old alert results cleaned up');
    }
  } catch (error) {
    console.error('Error in alert results cleanup:', error);
  }
};

export default startScheduler;
