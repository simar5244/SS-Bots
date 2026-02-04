import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '@/lib/db'
import { generateResetToken } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const user = await dbService.findUserByEmail(email)
    if (!user) {
      return NextResponse.json(
        { message: 'If the email exists, a reset link has been sent' },
        { status: 200 }
      )
    }

    const resetToken = generateResetToken()
    await dbService.updateUser(user.id, {
      resetToken,
      resetTokenExpiry: Date.now() + 3600000,
    })

    await sendPasswordResetEmail(email, resetToken)

    return NextResponse.json({
      message: 'If the email exists, a reset link has been sent',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
