'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Mail, MessageSquare, Phone, Save } from 'lucide-react'
import { apiClient } from '@/lib/api-client'

interface NotificationPreference {
  adminId: string
  emailEnabled: boolean
  emailAddress?: string
  slackEnabled: boolean
  slackChannel?: string
  smsEnabled: boolean
  phoneNumber?: string
  severityThreshold: 'critical' | 'high' | 'medium' | 'low'
}

export default function NotificationSettingsPage() {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<Partial<NotificationPreference>>({})

  // Fetch current preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const data = await apiClient.get<NotificationPreference>(
        '/settings/notification-preferences',
      )
      setFormData(data)
      return data
    },
  })

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<NotificationPreference>) => {
      return apiClient.put<NotificationPreference>(
        '/settings/notification-preferences',
        data,
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
    },
  })

  const handleSave = () => {
    updateMutation.mutate(formData)
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4'></div>
          <p className='text-muted-foreground'>
            Loading notification settings...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>Notification Settings</h1>
        <p className='text-muted-foreground'>
          Configure how you receive alert notifications
        </p>
      </div>

      {/* Severity Threshold */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <AlertCircle className='h-5 w-5' />
            Alert Severity Threshold
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <label className='text-sm font-medium text-gray-700'>
              Only receive notifications for alerts at or above this severity
            </label>
            <select
              value={formData.severityThreshold || 'high'}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  severityThreshold: e.target.value as any,
                }))
              }
              className='w-full mt-2 px-3 py-2 border rounded-md'
            >
              <option value='critical'>🚨 Critical Only</option>
              <option value='high'>⚠️ Critical & High</option>
              <option value='medium'>⚠ All (High, Medium, Low)</option>
              <option value='low'>ℹ️ All Alerts</option>
            </select>
            <p className='text-xs text-muted-foreground mt-2'>
              Higher thresholds reduce notification frequency but may miss
              important alerts.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Mail className='h-5 w-5 text-blue-600' />
            Email Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <label className='flex items-center gap-3 cursor-pointer'>
            <input
              type='checkbox'
              checked={formData.emailEnabled || false}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  emailEnabled: e.target.checked,
                }))
              }
              className='rounded'
            />
            <span className='text-sm font-medium'>
              Enable email notifications
            </span>
          </label>

          {formData.emailEnabled && (
            <div>
              <label className='text-sm font-medium text-gray-700'>
                Email Address
              </label>
              <input
                type='email'
                value={formData.emailAddress || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    emailAddress: e.target.value,
                  }))
                }
                placeholder='admin@example.com'
                className='w-full mt-1 px-3 py-2 border rounded-md'
              />
            </div>
          )}

          <p className='text-xs text-muted-foreground'>
            📧 Receive detailed alert notifications with context and actionable
            links to the dashboard
          </p>
        </CardContent>
      </Card>

      {/* Slack Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <MessageSquare className='h-5 w-5 text-purple-600' />
            Slack Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <label className='flex items-center gap-3 cursor-pointer'>
            <input
              type='checkbox'
              checked={formData.slackEnabled || false}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  slackEnabled: e.target.checked,
                }))
              }
              className='rounded'
            />
            <span className='text-sm font-medium'>
              Enable Slack notifications
            </span>
          </label>

          {formData.slackEnabled && (
            <div>
              <label className='text-sm font-medium text-gray-700'>
                Slack Channel
              </label>
              <input
                type='text'
                value={formData.slackChannel || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    slackChannel: e.target.value,
                  }))
                }
                placeholder='#alerts'
                className='w-full mt-1 px-3 py-2 border rounded-md'
              />
              <p className='text-xs text-muted-foreground mt-1'>
                Include the # symbol. You must have a Slack webhook configured.
              </p>
            </div>
          )}

          <p className='text-xs text-muted-foreground'>
            💬 Get instant Slack messages with rich formatting and quick action
            buttons
          </p>
        </CardContent>
      </Card>

      {/* SMS Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Phone className='h-5 w-5 text-green-600' />
            SMS Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <label className='flex items-center gap-3 cursor-pointer'>
            <input
              type='checkbox'
              checked={formData.smsEnabled || false}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  smsEnabled: e.target.checked,
                }))
              }
              className='rounded'
            />
            <span className='text-sm font-medium'>
              Enable SMS notifications
            </span>
          </label>

          {formData.smsEnabled && (
            <div>
              <label className='text-sm font-medium text-gray-700'>
                Phone Number
              </label>
              <input
                type='tel'
                value={formData.phoneNumber || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    phoneNumber: e.target.value,
                  }))
                }
                placeholder='+1 (555) 000-0000'
                className='w-full mt-1 px-3 py-2 border rounded-md'
              />
              <p className='text-xs text-muted-foreground mt-1'>
                Include country code. SMS only sent for CRITICAL and HIGH
                severity alerts to minimize costs.
              </p>
            </div>
          )}

          <p className='text-xs text-muted-foreground'>
            📱 Receive text messages for the most critical alerts (requires
            Twilio integration)
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className='flex gap-3'>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className='flex items-center justify-center gap-2 px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50'
        >
          <Save className='h-4 w-4' />
          Save Changes
        </button>
      </div>

      {updateMutation.isSuccess && (
        <div className='p-4 bg-green-50 border border-green-200 rounded-md flex items-center gap-3'>
          <div className='h-2 w-2 bg-green-600 rounded-full'></div>
          <p className='text-sm text-green-700'>
            Notification settings updated successfully
          </p>
        </div>
      )}
    </div>
  )
}
