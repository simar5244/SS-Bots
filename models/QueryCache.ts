import mongoose from 'mongoose'

export interface IQueryCache extends mongoose.Document {
  botId: mongoose.Types.ObjectId
  query: string
  queryHash: string
  response: string
  metadata: any
  createdAt: Date
  expiresAt: Date
}

const QueryCacheSchema = new mongoose.Schema({
  botId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bot',
    required: true,
  },
  query: {
    type: String,
    required: true,
  },
  queryHash: {
    type: String,
    required: true,
    index: true,
  },
  response: {
    type: String,
    required: true,
  },
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
})

QueryCacheSchema.index({ botId: 1, queryHash: 1 })

export default mongoose.models.QueryCache || mongoose.model<IQueryCache>('QueryCache', QueryCacheSchema)
