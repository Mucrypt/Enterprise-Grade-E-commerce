'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertCircle,
  AlertTriangle,
  AlertOctagon,
  Info,
  RefreshCw,
  Save,
  X,
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'

interface AlertThreshold {
  id: string
  thresholdType: string
  thresholdValue: number
  baselineValue?: number
  unit: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  isActive: boolean
  description: string
}

interface AlertThresholdsResponse {
  thresholds: AlertThreshold[]
}

interface AlertThresholdMutationResponse {
  threshold?: AlertThreshold
  message?: string
}

const severityConfig = {
  critical: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', icon: AlertOctagon },
  high: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', icon: AlertTriangle },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200', icon: AlertCircle },
  low: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', icon: Info },
}

export default function AlertThresholdsPage() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})

  // Fetch alert thresholds
  const { data: thresholdsData, isLoading, error } = useQuery({
    queryKey: ['alert-thresholds'],
    queryFn: async () => {
      const response = await apiClient.get<AlertThresholdsResponse>('/settings/alert-thresholds')
      return response.thresholds
    },
  })

  // Update threshold mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AlertThreshold> }) => {
      return apiClient.put<AlertThresholdMutationResponse>(`/settings/alert-thresholds/${id}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-thresholds'] })
      setEditingId(null)
      setFormData({})
    },
  })

  // Reset threshold mutation
  const resetMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.post<AlertThresholdMutationResponse>(`/settings/alert-thresholds/${id}/reset`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-thresholds'] })
    },
  })

  const handleEdit = (threshold: AlertThreshold) => {
    setEditingId(threshold.id)
    setFormData({
      [threshold.id]: {
        thresholdValue: threshold.thresholdValue,
        severity: threshold.severity,
        description: threshold.description,
      },
    })
  }

  const handleSave = (id: string) => {
    updateMutation.mutate({
      id,
      data: formData[id],
    })
  }

  const handleCancel = () => {
    setEditingId(null)
    setFormData({})
  }

  const handleReset = (id: string) => {
    if (confirm('Reset this threshold to default values?')) {
      resetMutation.mutate(id)
    }
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <RefreshCw className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (error) {
    return (
      <div className='min-h-screen bg-red-50 p-4 flex items-center justify-center'>
        <div className='text-center'>
          <AlertCircle className='h-12 w-12 text-red-600 mx-auto mb-4' />
          <h1 className='text-2xl font-bold text-red-600 mb-2'>Error Loading Thresholds</h1>
          <p className='text-red-600'>{error instanceof Error ? error.message : 'Failed to load alert thresholds'}</p>
        </div>
      </div>
    )
  }

  const thresholds = thresholdsData || []

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>Alert Thresholds Configuration</h1>
        <p className='text-muted-foreground'>Customize anomaly detection sensitivity and alert levels</p>
      </div>

      {/* Info Box */}
      <Card className='bg-blue-50 border-blue-200'>
        <CardContent className='pt-6'>
          <div className='flex gap-3'>
            <Info className='h-5 w-5 text-blue-600 shrink-0 mt-0.5' />
            <div>
              <p className='font-semibold text-blue-900'>How thresholds work</p>
              <p className='text-sm text-blue-700 mt-1'>
                Thresholds define when anomalies are detected. Lower values create more sensitive alerts. Severity level determines how prominently the alert is displayed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Thresholds List */}
      <div className='grid gap-4'>
        {thresholds.map((threshold) => {
          const isEditing = editingId === threshold.id
          const config = severityConfig[threshold.severity]
          const Icon = config.icon

          return (
            <Card key={threshold.id} className={`${config.bg} border-2 ${config.border}`}>
              <CardHeader>
                <div className='flex items-start justify-between'>
                  <div className='flex items-center gap-3'>
                    <Icon className={`h-6 w-6 ${config.text}`} />
                    <div>
                      <CardTitle className={config.text}>
                        {threshold.thresholdType.replace(/_/g, ' ').toUpperCase()}
                      </CardTitle>
                      <p className={`text-sm ${config.text} opacity-75`}>
                        {threshold.description}
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    {!isEditing && (
                      <>
                        <button
                          onClick={() => handleEdit(threshold)}
                          className={`px-3 py-1 rounded-md text-sm font-medium ${config.text} hover:opacity-75 transition-opacity`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleReset(threshold.id)}
                          disabled={resetMutation.isPending}
                          className={`px-3 py-1 rounded-md text-sm font-medium ${config.text} hover:opacity-75 transition-opacity disabled:opacity-50`}
                        >
                          Reset
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {isEditing ? (
                  <div className='space-y-4'>
                    <div>
                      <label className='text-sm font-medium text-gray-700'>
                        Threshold Value
                      </label>
                      <div className='flex gap-2 mt-1'>
                        <input
                          type='number'
                          value={formData[threshold.id]?.thresholdValue || threshold.thresholdValue}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              [threshold.id]: {
                                ...prev[threshold.id],
                                thresholdValue: parseFloat(e.target.value),
                              },
                            }))
                          }
                          className='flex-1 px-3 py-2 border rounded-md'
                        />
                        <span className='px-3 py-2 bg-white rounded-md border text-gray-600 font-medium'>
                          {threshold.unit}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className='text-sm font-medium text-gray-700'>Severity Level</label>
                      <select
                        value={formData[threshold.id]?.severity || threshold.severity}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            [threshold.id]: {
                              ...prev[threshold.id],
                              severity: e.target.value,
                            },
                          }))
                        }
                        className='w-full mt-1 px-3 py-2 border rounded-md'
                      >
                        <option value='low'>Low</option>
                        <option value='medium'>Medium</option>
                        <option value='high'>High</option>
                        <option value='critical'>Critical</option>
                      </select>
                    </div>

                    <div className='flex gap-2 pt-2'>
                      <button
                        onClick={() => handleSave(threshold.id)}
                        disabled={updateMutation.isPending}
                        className='flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50'
                      >
                        <Save className='h-4 w-4' />
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className='flex-1 px-4 py-2 border rounded-md hover:bg-gray-50'
                      >
                        <X className='h-4 w-4 mx-auto' />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className='flex items-center justify-between'>
                    <div>
                      <p className={`text-sm ${config.text}`}>Current Threshold</p>
                      <p className={`text-3xl font-bold ${config.text}`}>
                        {threshold.thresholdValue}
                        <span className='text-lg ml-1'>{threshold.unit}</span>
                      </p>
                      {threshold.baselineValue && (
                        <p className={`text-xs ${config.text} opacity-75 mt-1`}>
                          Baseline: {threshold.baselineValue} {threshold.unit}
                        </p>
                      )}
                    </div>
                    <div className={`px-4 py-2 rounded-lg ${config.bg} border ${config.border}`}>
                      <p className={`text-xs font-semibold ${config.text}`}>
                        {threshold.severity.toUpperCase()}
                      </p>
                      <p className={`text-xs ${config.text} opacity-75 mt-1`}>
                        {threshold.isActive ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Empty State */}
      {thresholds.length === 0 && (
        <Card>
          <CardContent className='py-12 text-center'>
            <AlertCircle className='h-12 w-12 text-muted-foreground mx-auto mb-4' />
            <p className='text-muted-foreground'>No alert thresholds configured</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
