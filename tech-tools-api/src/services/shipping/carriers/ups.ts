/**
 * UPS Shipping Service
 * Integration with UPS REST API (OAuth 2.0)
 * Documentation: https://developer.ups.com/
 */

import { BaseCarrier } from './base'
import {
  ShippingAddress,
  Package,
  ShippingRate,
  TrackingInfo,
  TrackingEvent,
  ShipmentRequest,
  ShipmentLabel,
} from '../index'
import logger from '../../../utils/logger'

interface UPSCredentials {
  accountNumber: string
  clientId: string
  clientSecret: string
  sandbox: boolean
}

// UPS API Response Types
interface UPSTokenResponse {
  access_token: string
  expires_in: number
  response?: {
    errors?: Array<{ message: string }>
  }
}

interface UPSErrorResponse {
  response?: {
    errors?: Array<{ message: string }>
  }
}

interface UPSRateResponse {
  RateResponse?: {
    RatedShipment?: Array<unknown>
  }
}

interface UPSTrackResponse {
  trackResponse?: {
    shipment?: Array<{
      package?: Array<unknown>
    }>
  }
}

interface UPSShipmentResponse {
  ShipmentResponse?: {
    ShipmentResults?: {
      TrackingNumber?: string
      PackageResults?: {
        TrackingNumber?: string
        ShippingLabel?: { GraphicImage?: string }
      }
      ShipmentCharges?: {
        TotalCharges?: { MonetaryValue?: string }
      }
    }
  }
}

interface UPSAddressResponse {
  XAVResponse?: {
    ValidAddressIndicator?: string
    Candidate?:
      | Array<{
          AddressKeyFormat?: {
            AddressLine?: string[]
            PoliticalDivision2?: string
            PoliticalDivision1?: string
            PostcodePrimaryLow?: string
            PostcodeExtendedLow?: string
            CountryCode?: string
          }
        }>
      | {
          AddressKeyFormat?: {
            AddressLine?: string[]
            PoliticalDivision2?: string
            PoliticalDivision1?: string
            PostcodePrimaryLow?: string
            PostcodeExtendedLow?: string
            CountryCode?: string
          }
        }
  }
}

export class UPSService extends BaseCarrier {
  private accountNumber: string = ''
  private clientId: string = ''
  private clientSecret: string = ''
  private accessToken: string = ''
  private tokenExpiry: Date = new Date()

  private get baseUrl(): string {
    return this.sandbox
      ? 'https://wwwcie.ups.com'
      : 'https://onlinetools.ups.com'
  }

  setCredentials(credentials: UPSCredentials): void {
    this.accountNumber = credentials.accountNumber
    this.clientId = credentials.clientId
    this.clientSecret = credentials.clientSecret
    this.sandbox = credentials.sandbox
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry > new Date()) {
      return this.accessToken
    }

    try {
      const auth = Buffer.from(
        `${this.clientId}:${this.clientSecret}`,
      ).toString('base64')

      const response = await fetch(`${this.baseUrl}/security/v1/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${auth}`,
        },
        body: 'grant_type=client_credentials',
      })

      const data = (await response.json()) as UPSTokenResponse

      if (!response.ok) {
        throw new Error(
          data.response?.errors?.[0]?.message || 'Failed to get UPS token',
        )
      }

      this.accessToken = data.access_token
      this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000)

      return this.accessToken
    } catch (error) {
      logger.error('UPS authentication error:', error)
      throw error
    }
  }

  async getRates(
    from: ShippingAddress,
    to: ShippingAddress,
    packages: Package[],
  ): Promise<ShippingRate[]> {
    if (!this.clientId) {
      return this.getMockRates(from, to, packages)
    }

    try {
      const token = await this.getAccessToken()

      const packageList = packages.map((pkg) => ({
        PackagingType: { Code: '02', Description: 'Package' },
        Dimensions: {
          UnitOfMeasurement: { Code: 'IN' },
          Length: String(
            Math.round(
              this.convertDimensions(pkg.length, pkg.dimensionUnit, 'in'),
            ),
          ),
          Width: String(
            Math.round(
              this.convertDimensions(pkg.width, pkg.dimensionUnit, 'in'),
            ),
          ),
          Height: String(
            Math.round(
              this.convertDimensions(pkg.height, pkg.dimensionUnit, 'in'),
            ),
          ),
        },
        PackageWeight: {
          UnitOfMeasurement: { Code: 'LBS' },
          Weight: String(
            this.convertWeight(pkg.weight, pkg.weightUnit, 'lb').toFixed(1),
          ),
        },
      }))

      const response = await fetch(`${this.baseUrl}/api/rating/v1/Shop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          transId: `rate-${Date.now()}`,
          transactionSrc: 'TechTools',
        },
        body: JSON.stringify({
          RateRequest: {
            Request: {
              TransactionReference: { CustomerContext: 'Rate Request' },
            },
            Shipment: {
              Shipper: {
                ShipperNumber: this.accountNumber,
                Address: {
                  AddressLine: [from.street1, from.street2].filter(Boolean),
                  City: from.city,
                  StateProvinceCode: from.state,
                  PostalCode: from.postalCode,
                  CountryCode: from.country,
                },
              },
              ShipTo: {
                Address: {
                  AddressLine: [to.street1, to.street2].filter(Boolean),
                  City: to.city,
                  StateProvinceCode: to.state,
                  PostalCode: to.postalCode,
                  CountryCode: to.country,
                  ResidentialAddressIndicator: to.isResidential
                    ? 'Y'
                    : undefined,
                },
              },
              ShipFrom: {
                Address: {
                  AddressLine: [from.street1, from.street2].filter(Boolean),
                  City: from.city,
                  StateProvinceCode: from.state,
                  PostalCode: from.postalCode,
                  CountryCode: from.country,
                },
              },
              Package: packageList,
            },
          },
        }),
      })

      const data = (await response.json()) as UPSErrorResponse & UPSRateResponse

      if (!response.ok) {
        throw new Error(
          data.response?.errors?.[0]?.message || 'Failed to get UPS rates',
        )
      }

      return this.parseRates(data)
    } catch (error) {
      logger.error('UPS rate error:', error)
      return this.getMockRates(from, to, packages)
    }
  }

  private parseRates(data: any): ShippingRate[] {
    const rates: ShippingRate[] = []
    const ratedShipments = data.RateResponse?.RatedShipment || []

    for (const shipment of ratedShipments) {
      const serviceCode = shipment.Service?.Code
      const totalCharges = shipment.TotalCharges?.MonetaryValue

      if (serviceCode && totalCharges) {
        rates.push({
          carrier: 'ups',
          serviceCode,
          serviceName: this.getServiceName(serviceCode),
          deliveryDays:
            parseInt(shipment.GuaranteedDelivery?.BusinessDaysInTransit) ||
            null,
          deliveryDate: shipment.GuaranteedDelivery?.DeliveryByTime || null,
          totalPrice: parseFloat(totalCharges),
          currency: shipment.TotalCharges?.CurrencyCode || 'USD',
          guaranteed: !!shipment.GuaranteedDelivery,
          rateId: shipment.RateModifiers?.ChargeDetail?.[0]?.ChargeCode,
        })
      }
    }

    return rates
  }

  private getMockRates(
    from: ShippingAddress,
    to: ShippingAddress,
    packages: Package[],
  ): ShippingRate[] {
    const baseWeight = packages.reduce(
      (sum, pkg) => sum + this.convertWeight(pkg.weight, pkg.weightUnit, 'lb'),
      0,
    )

    const domesticRates: ShippingRate[] = [
      {
        carrier: 'ups',
        serviceCode: '03',
        serviceName: 'UPS Ground',
        deliveryDays: 5,
        deliveryDate: null,
        totalPrice: Math.round((9.49 + baseWeight * 0.55) * 100) / 100,
        currency: 'USD',
        guaranteed: false,
      },
      {
        carrier: 'ups',
        serviceCode: '12',
        serviceName: 'UPS 3 Day Select',
        deliveryDays: 3,
        deliveryDate: null,
        totalPrice: Math.round((16.99 + baseWeight * 0.8) * 100) / 100,
        currency: 'USD',
        guaranteed: true,
      },
      {
        carrier: 'ups',
        serviceCode: '02',
        serviceName: 'UPS 2nd Day Air',
        deliveryDays: 2,
        deliveryDate: null,
        totalPrice: Math.round((24.99 + baseWeight * 1.1) * 100) / 100,
        currency: 'USD',
        guaranteed: true,
      },
      {
        carrier: 'ups',
        serviceCode: '59',
        serviceName: 'UPS 2nd Day Air A.M.',
        deliveryDays: 2,
        deliveryDate: null,
        totalPrice: Math.round((29.99 + baseWeight * 1.25) * 100) / 100,
        currency: 'USD',
        guaranteed: true,
      },
      {
        carrier: 'ups',
        serviceCode: '01',
        serviceName: 'UPS Next Day Air',
        deliveryDays: 1,
        deliveryDate: null,
        totalPrice: Math.round((42.99 + baseWeight * 1.6) * 100) / 100,
        currency: 'USD',
        guaranteed: true,
      },
      {
        carrier: 'ups',
        serviceCode: '14',
        serviceName: 'UPS Next Day Air Early',
        deliveryDays: 1,
        deliveryDate: null,
        totalPrice: Math.round((54.99 + baseWeight * 2.0) * 100) / 100,
        currency: 'USD',
        guaranteed: true,
      },
    ]

    // International rates
    if (from.country !== to.country) {
      return [
        {
          carrier: 'ups',
          serviceCode: '08',
          serviceName: 'UPS Worldwide Expedited',
          deliveryDays: 5,
          deliveryDate: null,
          totalPrice: Math.round((49.99 + baseWeight * 3.5) * 100) / 100,
          currency: 'USD',
          guaranteed: false,
        },
        {
          carrier: 'ups',
          serviceCode: '65',
          serviceName: 'UPS Worldwide Saver',
          deliveryDays: 3,
          deliveryDate: null,
          totalPrice: Math.round((74.99 + baseWeight * 4.5) * 100) / 100,
          currency: 'USD',
          guaranteed: true,
        },
        {
          carrier: 'ups',
          serviceCode: '07',
          serviceName: 'UPS Worldwide Express',
          deliveryDays: 2,
          deliveryDate: null,
          totalPrice: Math.round((99.99 + baseWeight * 6.0) * 100) / 100,
          currency: 'USD',
          guaranteed: true,
        },
      ]
    }

    return domesticRates
  }

  async track(trackingNumber: string): Promise<TrackingInfo> {
    if (!this.clientId) {
      return this.getMockTracking(trackingNumber)
    }

    try {
      const token = await this.getAccessToken()

      const response = await fetch(
        `${this.baseUrl}/api/track/v1/details/${trackingNumber}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            transId: `track-${Date.now()}`,
            transactionSrc: 'TechTools',
          },
        },
      )

      const data = (await response.json()) as UPSErrorResponse &
        UPSTrackResponse

      if (!response.ok) {
        throw new Error(
          data.response?.errors?.[0]?.message || 'Failed to track shipment',
        )
      }

      return this.parseTracking(trackingNumber, data)
    } catch (error) {
      logger.error('UPS tracking error:', error)
      return this.getMockTracking(trackingNumber)
    }
  }

  private parseTracking(trackingNumber: string, data: any): TrackingInfo {
    const shipment = data.trackResponse?.shipment?.[0]
    const pkg = shipment?.package?.[0]

    if (!pkg) {
      throw new Error('Tracking information not found')
    }

    const activities = pkg.activity || []
    const events: TrackingEvent[] = activities.map((activity: any) => ({
      timestamp: `${activity.date} ${activity.time}`,
      location: [
        activity.location?.address?.city,
        activity.location?.address?.stateProvince,
        activity.location?.address?.country,
      ]
        .filter(Boolean)
        .join(', '),
      description: activity.status?.description || '',
      status: activity.status?.type || '',
    }))

    const currentStatus = pkg.currentStatus
    const deliveryDate = pkg.deliveryDate?.[0]

    return {
      carrier: 'ups',
      trackingNumber,
      status: currentStatus?.type || 'Unknown',
      statusDescription: currentStatus?.description || '',
      estimatedDelivery: deliveryDate?.date || null,
      actualDelivery: currentStatus?.type === 'D' ? deliveryDate?.date : null,
      signedBy: pkg.deliveryInformation?.receivedBy || null,
      events,
    }
  }

  private getMockTracking(trackingNumber: string): TrackingInfo {
    const now = new Date()
    const events: TrackingEvent[] = [
      {
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
        location: 'San Francisco, CA',
        description: 'Out For Delivery Today',
        status: 'I',
      },
      {
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 10).toISOString(),
        location: 'San Francisco, CA',
        description: 'Arrived at Facility',
        status: 'I',
      },
      {
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 28).toISOString(),
        location: 'Oakland, CA',
        description: 'Departed Facility',
        status: 'I',
      },
      {
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 52).toISOString(),
        location: 'Salt Lake City, UT',
        description: 'In Transit',
        status: 'I',
      },
      {
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 76).toISOString(),
        location: 'Louisville, KY',
        description: 'Origin Scan',
        status: 'I',
      },
    ]

    return {
      carrier: 'ups',
      trackingNumber,
      status: 'In Transit',
      statusDescription: 'Your package is out for delivery today',
      estimatedDelivery: new Date(
        now.getTime() + 1000 * 60 * 60 * 4,
      ).toISOString(),
      actualDelivery: null,
      signedBy: null,
      events,
    }
  }

  async createShipment(request: ShipmentRequest): Promise<ShipmentLabel> {
    if (!this.clientId) {
      return this.getMockLabel(request)
    }

    try {
      const token = await this.getAccessToken()

      const packageList = request.packages.map((pkg, index) => ({
        Description: pkg.description || `Package ${index + 1}`,
        Packaging: { Code: '02' },
        Dimensions: {
          UnitOfMeasurement: { Code: 'IN' },
          Length: String(
            Math.round(
              this.convertDimensions(pkg.length, pkg.dimensionUnit, 'in'),
            ),
          ),
          Width: String(
            Math.round(
              this.convertDimensions(pkg.width, pkg.dimensionUnit, 'in'),
            ),
          ),
          Height: String(
            Math.round(
              this.convertDimensions(pkg.height, pkg.dimensionUnit, 'in'),
            ),
          ),
        },
        PackageWeight: {
          UnitOfMeasurement: { Code: 'LBS' },
          Weight: String(
            this.convertWeight(pkg.weight, pkg.weightUnit, 'lb').toFixed(1),
          ),
        },
      }))

      const response = await fetch(`${this.baseUrl}/api/shipments/v1/ship`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          transId: `ship-${Date.now()}`,
          transactionSrc: 'TechTools',
        },
        body: JSON.stringify({
          ShipmentRequest: {
            Request: {
              TransactionReference: { CustomerContext: 'Ship Request' },
            },
            Shipment: {
              Description: request.reference || 'Shipment',
              Shipper: {
                Name: request.from.name,
                ShipperNumber: this.accountNumber,
                Phone: { Number: request.from.phone || '' },
                Address: {
                  AddressLine: [
                    request.from.street1,
                    request.from.street2,
                  ].filter(Boolean),
                  City: request.from.city,
                  StateProvinceCode: request.from.state,
                  PostalCode: request.from.postalCode,
                  CountryCode: request.from.country,
                },
              },
              ShipTo: {
                Name: request.to.name,
                Phone: { Number: request.to.phone || '' },
                Address: {
                  AddressLine: [request.to.street1, request.to.street2].filter(
                    Boolean,
                  ),
                  City: request.to.city,
                  StateProvinceCode: request.to.state,
                  PostalCode: request.to.postalCode,
                  CountryCode: request.to.country,
                },
              },
              ShipFrom: {
                Name: request.from.name,
                Phone: { Number: request.from.phone || '' },
                Address: {
                  AddressLine: [
                    request.from.street1,
                    request.from.street2,
                  ].filter(Boolean),
                  City: request.from.city,
                  StateProvinceCode: request.from.state,
                  PostalCode: request.from.postalCode,
                  CountryCode: request.from.country,
                },
              },
              PaymentInformation: {
                ShipmentCharge: {
                  Type: '01',
                  BillShipper: { AccountNumber: this.accountNumber },
                },
              },
              Service: { Code: request.serviceCode },
              Package: packageList,
            },
            LabelSpecification: {
              LabelImageFormat: { Code: request.labelFormat || 'GIF' },
              LabelStockSize: { Height: '6', Width: '4' },
            },
          },
        }),
      })

      const data = (await response.json()) as UPSErrorResponse &
        UPSShipmentResponse

      if (!response.ok) {
        throw new Error(
          data.response?.errors?.[0]?.message || 'Failed to create shipment',
        )
      }

      const shipmentResults = data.ShipmentResponse?.ShipmentResults
      const pkgResults = shipmentResults?.PackageResults

      return {
        trackingNumber: pkgResults?.TrackingNumber || '',
        labelData: pkgResults?.ShippingLabel?.GraphicImage || '',
        labelFormat: request.labelFormat || 'GIF',
        carrier: 'ups',
        serviceCode: request.serviceCode,
        cost:
          parseFloat(
            shipmentResults?.ShipmentCharges?.TotalCharges?.MonetaryValue,
          ) || 0,
      }
    } catch (error) {
      logger.error('UPS create shipment error:', error)
      throw error
    }
  }

  private getMockLabel(request: ShipmentRequest): ShipmentLabel {
    const trackingNumber = `1Z999AA1${Math.random().toString().slice(2, 12)}`

    return {
      trackingNumber,
      labelData: 'MOCK_UPS_LABEL_DATA_BASE64',
      labelFormat: request.labelFormat || 'GIF',
      carrier: 'ups',
      serviceCode: request.serviceCode,
      cost: 18.99,
    }
  }

  async validateAddress(
    address: ShippingAddress,
  ): Promise<{ valid: boolean; suggestions?: ShippingAddress[] }> {
    if (!this.clientId) {
      return { valid: true }
    }

    try {
      const token = await this.getAccessToken()

      const response = await fetch(
        `${this.baseUrl}/api/addressvalidation/v1/1`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            transId: `validate-${Date.now()}`,
            transactionSrc: 'TechTools',
          },
          body: JSON.stringify({
            XAVRequest: {
              AddressKeyFormat: {
                AddressLine: [address.street1, address.street2].filter(Boolean),
                PoliticalDivision2: address.city,
                PoliticalDivision1: address.state,
                PostcodePrimaryLow: address.postalCode,
                CountryCode: address.country,
              },
            },
          }),
        },
      )

      const data = (await response.json()) as UPSAddressResponse

      if (!response.ok) {
        return { valid: false }
      }

      const xavResponse = data.XAVResponse
      const validIndicator = xavResponse?.ValidAddressIndicator

      const suggestions: ShippingAddress[] = []
      const candidates = xavResponse?.Candidate || []

      for (const candidate of Array.isArray(candidates)
        ? candidates
        : [candidates]) {
        if (candidate?.AddressKeyFormat) {
          suggestions.push({
            name: address.name,
            company: address.company,
            street1:
              candidate.AddressKeyFormat.AddressLine?.[0] || address.street1,
            street2: candidate.AddressKeyFormat.AddressLine?.[1],
            city: candidate.AddressKeyFormat.PoliticalDivision2 || address.city,
            state:
              candidate.AddressKeyFormat.PoliticalDivision1 || address.state,
            postalCode:
              candidate.AddressKeyFormat.PostcodePrimaryLow +
              (candidate.AddressKeyFormat.PostcodeExtendedLow
                ? `-${candidate.AddressKeyFormat.PostcodeExtendedLow}`
                : ''),
            country: candidate.AddressKeyFormat.CountryCode || address.country,
            phone: address.phone,
            email: address.email,
          })
        }
      }

      return {
        valid: !!validIndicator,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      }
    } catch (error) {
      logger.error('UPS address validation error:', error)
      return { valid: false }
    }
  }

  async cancelShipment(trackingNumber: string): Promise<boolean> {
    if (!this.clientId) {
      return true
    }

    try {
      const token = await this.getAccessToken()

      const response = await fetch(
        `${this.baseUrl}/api/shipments/v1/void/cancel/${trackingNumber}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            transId: `void-${Date.now()}`,
            transactionSrc: 'TechTools',
          },
        },
      )

      return response.ok
    } catch (error) {
      logger.error('UPS cancel shipment error:', error)
      return false
    }
  }

  private getServiceName(code: string): string {
    const services: Record<string, string> = {
      '01': 'UPS Next Day Air',
      '02': 'UPS 2nd Day Air',
      '03': 'UPS Ground',
      '07': 'UPS Worldwide Express',
      '08': 'UPS Worldwide Expedited',
      '11': 'UPS Standard',
      '12': 'UPS 3 Day Select',
      '13': 'UPS Next Day Air Saver',
      '14': 'UPS Next Day Air Early',
      '54': 'UPS Worldwide Express Plus',
      '59': 'UPS 2nd Day Air A.M.',
      '65': 'UPS Worldwide Saver',
      '82': 'UPS Today Standard',
      '83': 'UPS Today Dedicated Courier',
      '84': 'UPS Today Intercity',
      '85': 'UPS Today Express',
      '86': 'UPS Today Express Saver',
    }
    return services[code] || `UPS Service ${code}`
  }

  static getServices(): { code: string; name: string }[] {
    return [
      { code: '03', name: 'UPS Ground' },
      { code: '12', name: 'UPS 3 Day Select' },
      { code: '02', name: 'UPS 2nd Day Air' },
      { code: '59', name: 'UPS 2nd Day Air A.M.' },
      { code: '01', name: 'UPS Next Day Air' },
      { code: '13', name: 'UPS Next Day Air Saver' },
      { code: '14', name: 'UPS Next Day Air Early' },
      { code: '11', name: 'UPS Standard (International)' },
      { code: '08', name: 'UPS Worldwide Expedited' },
      { code: '65', name: 'UPS Worldwide Saver' },
      { code: '07', name: 'UPS Worldwide Express' },
    ]
  }
}
