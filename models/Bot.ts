import mongoose from 'mongoose'

export interface IBot extends mongoose.Document {
  name: string
  userId: mongoose.Types.ObjectId
  dbType: 'postgresql' | 'mysql' | 'mssql' | 'mongodb' | 'oracle' | 'sharepoint'
  dbConfig: {
    host: string
    port: number
    database: string
    username: string
    password: string
    useSSH?: boolean
    sshConfig?: {
      host: string
      port: number
      username: string
      privateKey?: string
      password?: string
    }
  }
  schema: any
  vectorData: Array<{
    id: string
    table: string
    column: string
    embedding: number[]
    metadata: any
  }>
  isConnected: boolean
  lastScanned?: Date
  createdAt: Date
}

const BotSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  dbType: {
    type: String,
    enum: ['postgresql', 'mysql', 'mssql', 'mongodb', 'oracle', 'sharepoint'],
    required: true,
  },
  dbConfig: {
    host: String,
    port: Number,
    database: String,
    username: String,
    password: String,
    useSSH: Boolean,
    sshConfig: {
      host: String,
      port: Number,
      username: String,
      privateKey: String,
      password: String,
    },
  },
  schema: mongoose.Schema.Types.Mixed,
  vectorData: [{
    id: String,
    table: String,
    column: String,
    embedding: [Number],
    metadata: mongoose.Schema.Types.Mixed,
  }],
  isConnected: {
    type: Boolean,
    default: false,
  },
  lastScanned: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

export default mongoose.models.Bot || mongoose.model<IBot>('Bot', BotSchema)
