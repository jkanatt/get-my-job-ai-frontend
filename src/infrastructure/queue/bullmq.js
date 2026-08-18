import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

export const getmyjobJobQueue = new Queue('GetMyJobBuilderQueue', { connection });
export const getmyjobQueueEvents = new QueueEvents('GetMyJobBuilderQueue', { connection });

/**
 * Enqueue a new ATS Build Job
 */
export async function enqueueBuildJob(jobData) {
  return await getmyjobJobQueue.add('build-ats-assets', jobData, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: 100, // keep last 100 failed jobs for debugging
  });
}
