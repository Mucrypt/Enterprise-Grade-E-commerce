import {
  getActiveAlerts,
  acknowledgeAlert,
  dismissAlert,
  getAlertStats,
} from './alerts.controller'
import { query } from '../../../database/connection'
import { webSocketService } from '../../../services/websocket.service'

jest.mock('../../../database/connection', () => ({
  query: jest.fn(),
}))

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))

jest.mock('../../../services/websocket.service', () => ({
  webSocketService: {
    broadcastAlert: jest.fn(),
    broadcastAlertAcknowledged: jest.fn(),
    broadcastAlertDismissed: jest.fn(),
  },
}))

const mockQuery = query as jest.Mock

const makeRes = () => {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

describe('alerts controller (against the repaired alerts table)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('getActiveAlerts reads and shapes rows from the alerts table', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'alert-1',
          alert_type: 'revenue_drop',
          severity: 'high',
          title: 'Revenue dropped',
          message: 'msg',
          current_value: '750.00',
          threshold_value: '1000.00',
          baseline_value: null,
          resource_type: 'revenue',
          resource_id: null,
          is_active: true,
          triggered_at: '2026-08-01T00:00:00Z',
          acknowledged_at: null,
          resolved_at: null,
        },
      ],
      rowCount: 1,
    })

    const req: any = { query: {} }
    const res = makeRes()

    await getActiveAlerts(req, res)

    expect(mockQuery.mock.calls[0][0]).toContain('FROM alerts')
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        alerts: expect.arrayContaining([
          expect.objectContaining({ id: 'alert-1', alertType: 'revenue_drop' }),
        ]),
        total: 1,
      }),
    )
  })

  it('acknowledgeAlert writes req.user.id as acknowledged_by and broadcasts the acknowledgment', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'alert-1',
          alert_type: 'revenue_drop',
          severity: 'high',
          is_active: false,
        },
      ],
    })

    const req: any = { params: { id: 'alert-1' }, user: { id: 'user-42' } }
    const res = makeRes()

    await acknowledgeAlert(req, res)

    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('UPDATE alerts')
    expect(sql).toContain('acknowledged_by')
    expect(params).toEqual(['alert-1', 'user-42'])
    expect(webSocketService.broadcastAlertAcknowledged).toHaveBeenCalledWith(
      'alert-1',
      'user-42',
    )
  })

  it('acknowledgeAlert requires authentication', async () => {
    const req: any = { params: { id: 'alert-1' }, user: undefined }
    const res = makeRes()

    await acknowledgeAlert(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('dismissAlert marks the alert inactive and broadcasts the dismissal', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'alert-1',
          alert_type: 'revenue_drop',
          severity: 'high',
          is_active: false,
        },
      ],
    })

    const req: any = { params: { id: 'alert-1' }, user: { id: 'user-42' } }
    const res = makeRes()

    await dismissAlert(req, res)

    const [sql] = mockQuery.mock.calls[0]
    expect(sql).toContain('is_active = false')
    expect(webSocketService.broadcastAlertDismissed).toHaveBeenCalledWith(
      'alert-1',
    )
  })

  it('getAlertStats reads counts from the alerts table without the missing-table workaround', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          critical_alerts: '1',
          high_alerts: '2',
          medium_alerts: '0',
          low_alerts: '0',
          total_active: '3',
          resolved_last_24h: '1',
        },
      ],
    })

    const req: any = {}
    const res = makeRes()

    await getAlertStats(req, res)

    expect(res.json).toHaveBeenCalledWith({
      critical: 1,
      high: 2,
      medium: 0,
      low: 0,
      totalActive: 3,
      resolvedLast24h: 1,
    })
  })
})
