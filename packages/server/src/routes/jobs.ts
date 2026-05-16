import { Hono } from 'hono'
import { getJobStatus, getQueueStats } from '../queue/jobs.js'

const app = new Hono()

// GET /jobs/:jobId/status
app.get('/:jobId/status', async (c) => {
  const jobId = c.req.param('jobId')

  try {
    const status = await getJobStatus(jobId)
    if (!status) {
      return c.json({ error: 'Job not found' }, 404)
    }
    return c.json(status, 200)
  } catch (err) {
    console.error('getJobStatus error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /jobs/stats
app.get('/stats', async (c) => {
  try {
    const stats = await getQueueStats()
    return c.json({ queues: stats }, 200)
  } catch (err) {
    console.error('getQueueStats error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default app
