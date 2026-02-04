import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { dbService } from '@/lib/db'
import { randomBytes } from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key'

export interface JWTPayload {
  userId: string
  email: string
}

export function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch (error) {
    return null
  }
}

export async function getUserFromRequest(req: NextRequest): Promise<{ id: string; email: string; name: string } | null> {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return null

    const decoded = verifyToken(token) as { userId: string }
    const user = await dbService.findUserById(decoded.userId)
    
    if (!user) return null

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    }
  } catch (error) {
    return null
  }
}

export function generateResetToken(): string {
  return jwt.sign({ purpose: 'reset' }, JWT_SECRET, { expiresIn: '1h' })
}
