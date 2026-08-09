import { AnomalyDetector } from './anomaly.detector'
import { query } from '../database/connection'
import { notificationDispatcher } from './notification-dispatcher.service'

jest.mock('../database/connection', () => ({
  query: jest.fn(),
}))

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

jest.mock('./notification-dispatcher.service', () => ({
  notificationDispatcher: { dispatchAlertToAllAdmins: jest.fn() },
}))

const mockQuery = query as jest.Mock

describe('AnomalyDetector.createAlert (private, exercised directly)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('persists a new alert into the (now-existing) alerts table', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id FROM alerts')) {
        return { rows: [] } // no recent duplicate alert
      }
      if (sql.includes('INSERT INTO alerts')) {
        return { rows: [] }
      }
      return { rows: [] }
    })

    const detector = new AnomalyDetector()

    await (detector as any).createAlert({
      alertType: 'revenue_drop',
      severity: 'high',
      title: 'Revenue dropped 25%',
      message: 'Revenue is 25% below the 7-day average',
      currentValue: 750,
      thresholdValue: 1000,
      resourceType: 'revenue',
    })

    const insertCall = mockQuery.mock.calls.find((call: any[]) =>
      call[0].includes('INSERT INTO alerts'),
    )
    expect(insertCall).toBeDefined()
    expect(insertCall![1]).toEqual([
      'revenue_drop',
      'high',
      'Revenue dropped 25%',
      'Revenue is 25% below the 7-day average',
      750,
      1000,
      null,
      'revenue',
      null,
    ])
    expect(notificationDispatcher.dispatchAlertToAllAdmins).toHaveBeenCalledTimes(1)
  })

  it('skips creating a duplicate alert when a recent matching one is already active', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id FROM alerts')) {
        return { rows: [{ id: 'existing-alert-1' }] }
      }
      return { rows: [] }
    })

    const detector = new AnomalyDetector()

    await (detector as any).createAlert({
      alertType: 'revenue_drop',
      severity: 'high',
      title: 'Revenue dropped 25%',
      message: 'Revenue is 25% below the 7-day average',
      currentValue: 750,
      thresholdValue: 1000,
      resourceType: 'revenue',
    })

    const insertCall = mockQuery.mock.calls.find((call: any[]) =>
      call[0].includes('INSERT INTO alerts'),
    )
    expect(insertCall).toBeUndefined()
    expect(notificationDispatcher.dispatchAlertToAllAdmins).not.toHaveBeenCalled()
  })

  it('does not throw when the insert fails (e.g. table still missing) -- swallows and logs', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id FROM alerts')) return { rows: [] }
      if (sql.includes('INSERT INTO alerts')) {
        const err: any = new Error('relation "alerts" does not exist')
        err.code = '42P01'
        throw err
      }
      return { rows: [] }
    })

    const detector = new AnomalyDetector()

    await expect(
      (detector as any).createAlert({
        alertType: 'revenue_drop',
        severity: 'high',
        title: 'x',
        message: 'x',
        currentValue: 1,
        thresholdValue: 1,
        resourceType: 'revenue',
      }),
    ).resolves.not.toThrow()

    expect(notificationDispatcher.dispatchAlertToAllAdmins).not.toHaveBeenCalled()
  })
})
