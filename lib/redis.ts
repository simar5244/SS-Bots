import Redis from 'ioredis'

let redis: Redis | null = null

// Only enable Redis if explicitly configured
if (process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379') {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          return null
        }
        return Math.min(times * 50, 2000)
      },
      lazyConnect: true,
    })

    redis.on('error', () => {
      // Silently fail
    })

    redis.connect().catch(() => {
      redis = null
    })
  } catch (error) {
    redis = null
  }
}

export default redis
