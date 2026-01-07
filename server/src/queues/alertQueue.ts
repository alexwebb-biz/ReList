import { Queue, Worker, Job } from 'bullmq';
import { bullConnection, isRedisEnabled } from '../config/redis.js';
import { processAlert } from '../services/scraperService.js';

// Queue for processing alerts (only if Redis is configured)
export let alertQueue: Queue | null = null;
export let alertWorker: Worker | null = null;

console.log('Initializing alert queue...', { isRedisEnabled: isRedisEnabled(), hasBullConnection: !!bullConnection });

if (isRedisEnabled() && bullConnection) {
  console.log('Creating BullMQ queue and worker...');
  alertQueue = new Queue('alert-processing', {
    connection: bullConnection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  });

  // Worker to process alert jobs
  alertWorker = new Worker(
    'alert-processing',
    async (job: Job) => {
      const { alertId, userId } = job.data;
      console.log(`Processing alert ${alertId} for user ${userId}`);

      try {
        const results = await processAlert(alertId, userId);
        return { success: true, resultsFound: results.length };
      } catch (error) {
        console.error(`Error processing alert ${alertId}:`, error);
        throw error;
      }
    },
    {
      connection: bullConnection,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 60000, // 10 jobs per minute max
      },
    }
  );

  alertWorker.on('completed', (job) => {
    console.log(`Alert job ${job.id} completed`);
  });

  alertWorker.on('failed', (job, err) => {
    console.error(`Alert job ${job?.id} failed:`, err.message);
  });

  console.log('BullMQ queue and worker created successfully');
} else {
  console.log('Skipping BullMQ setup - Redis not available');
}

// Add an alert to the queue
export const queueAlert = async (alertId: string, userId: string, delay = 0) => {
  console.log('queueAlert called', { alertId, userId, hasQueue: !!alertQueue });

  if (!alertQueue) {
    console.log('Redis not configured - skipping queue');
    return null;
  }

  console.log('Adding job to queue...');
  return await alertQueue.add(
    'process-alert',
    { alertId, userId },
    {
      delay,
      jobId: `alert-${alertId}-${Date.now()}`,
    }
  );
};

// Schedule recurring alert checks
export const scheduleAlertCheck = async (alertId: string, userId: string, intervalMinutes: number) => {
  if (!alertQueue) {
    console.log('Redis not configured - skipping scheduled alert');
    return null;
  }

  const repeatableJob = await alertQueue.add(
    'scheduled-alert',
    { alertId, userId },
    {
      repeat: {
        every: intervalMinutes * 60 * 1000,
      },
      jobId: `scheduled-${alertId}`,
    }
  );
  return repeatableJob;
};

// Remove scheduled job
export const removeScheduledAlert = async (alertId: string) => {
  if (!alertQueue) {
    return;
  }

  const jobs = await alertQueue.getRepeatableJobs();
  for (const job of jobs) {
    if (job.id?.includes(alertId)) {
      await alertQueue.removeRepeatableByKey(job.key);
    }
  }
};

export const isQueueEnabled = (): boolean => alertQueue !== null;

export default alertQueue;
