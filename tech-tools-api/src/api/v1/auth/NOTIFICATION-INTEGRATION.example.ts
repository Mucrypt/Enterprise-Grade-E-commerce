/**
 * AUTH CONTROLLER INTEGRATION - Add to your existing auth.controller.ts
 *
 * This shows where to add notification triggers in your auth flow
 */

// Add this import at the top of your auth.controller.ts
import NotificationEvents from '../../../services/notification.events'

/**
 * EXAMPLE: After successful user signup
 *
 * In your signup/register endpoint, after creating the user, add:
 */
export const signupNotificationExample = async (
  userId: string,
  firstName: string,
) => {
  try {
    // Trigger signup notification
    await NotificationEvents.onUserSignup(userId, firstName)
    console.log('Signup notification triggered for:', userId)
  } catch (error) {
    console.error('Error sending signup notification:', error)
    // Don't throw - notification failure shouldn't block signup
  }
}

/**
 * EXAMPLE: Account verification notification
 */
export const accountVerificationNotification = async (
  userId: string,
  userEmail: string,
) => {
  try {
    const { NotificationService } = await import(
      '../../../services/notification.service'
    )

    await NotificationService.create({
      userId,
      type: 'account_verified',
      title: 'Account Verified',
      message: 'Your email has been verified. Welcome to TechTools!',
      icon: 'CheckCircle',
      actionUrl: '/products',
      actionLabel: 'Start Shopping',
      sendEmail: true,
      priority: 'normal',
    })
  } catch (error) {
    console.error('Error sending verification notification:', error)
  }
}

/**
 * EXAMPLE: Password reset notification
 */
export const passwordResetNotification = async (userId: string) => {
  try {
    const { NotificationService } = await import(
      '../../../services/notification.service'
    )

    await NotificationService.create({
      userId,
      type: 'password_reset',
      title: 'Password Reset',
      message: 'Your password has been successfully reset.',
      description: 'If you did not request this, please contact support.',
      icon: 'Lock',
      sendEmail: true,
      priority: 'high',
    })
  } catch (error) {
    console.error('Error sending password reset notification:', error)
  }
}
