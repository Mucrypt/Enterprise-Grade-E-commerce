/**
 * FedEx Shipping Service
 * Integration with FedEx REST API (v1)
 * Documentation: https://developer.fedex.com/api/en-us/home.html
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

interface FedExCredentials {
  accountNumber: string
  apiKey: string
  secretKey: string
  sandbox: boolean
}

// FedEx API Response Types
interface FedExTokenResponse {
  access_token: string
  expires_in: number
  errors?: Array<{ message: string }>
}

interface FedExErrorResponse {
  errors?: Array<{ message: string }>
}

interface FedExRateOutput {
  output?: {
    rateReplyDetails?: Array<{
      ratedShipmentDetails?: Array<unknown>
    }>
  }
}

interface FedExTrackOutput {
  output?: {
    completeTrackResults?: Array<{
      trackResults?: Array<unknown>
    }>
  }
}

interface FedExShipmentOutput {
  output?: {
    transactionShipments?: Array<{
      pieceResponses?: Array<{
        trackingNumber?: string
        packageDocuments?: Array<{ encodedLabel?: string }>
      }>
      completedShipmentDetail?: {
        shipmentRating?: {
          totalNetCharge?: { amount?: number }
        }
      }
    }>
  }
}

interface FedExAddressOutput {
  output?: {
    resolvedAddresses?: Array<{
      classification?: string
      effectiveAddress?: {
        streetLinesToken?: string[]
        city?: string
        stateOrProvinceCode?: string
        postalCode?: string
        countryCode?: string
      }
    }>
  }
}

export class FedExService extends BaseCarrier {
  private accountNumber: string = ''
  private apiKey: string = ''
  private secretKey: string = ''
  private accessToken: string = ''
  private tokenExpiry: Date = new Date()

  private get baseUrl(): string {
    return this.sandbox
      ? 'https://apis-sandbox.fedex.com'
      : 'https://apis.fedex.com'
  }

  setCredentials(credentials: FedExCredentials): void {
    this.accountNumber = credentials.accountNumber
    this.apiKey = credentials.apiKey
    this.secretKey = credentials.secretKey
    this.sandbox = credentials.sandbox
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry > new Date()) {
      return this.accessToken
    }

    try {
      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.apiKey,
          client_secret: this.secretKey,
        }),
      })

      const data = (await response.json()) as FedExTokenResponse

      if (!response.ok) {
        throw new Error(
          data.errors?.[0]?.message || 'Failed to get FedEx token',
        )
      }

      this.accessToken = data.access_token
      this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000)

      return this.accessToken
    } catch (error) {
      logger.error('FedEx authentication error:', error)
      throw error
    }
  }

  async getRates(
    from: ShippingAddress,
    to: ShippingAddress,
    packages: Package[],
  ): Promise<ShippingRate[]> {
    // If no credentials, return mock rates
    if (!this.apiKey) {
      return this.getMockRates(from, to, packages)
    }

    try {
      const token = await this.getAccessToken()

      const requestedPackageLineItems = packages.map((pkg) => ({
        weight: {
          value: this.convertWeight(pkg.weight, pkg.weightUnit, 'lb'),
          units: 'LB',
        },
        dimensions: {
          length: Math.round(
            this.convertDimensions(pkg.length, pkg.dimensionUnit, 'in'),
          ),
          width: Math.round(
            this.convertDimensions(pkg.width, pkg.dimensionUnit, 'in'),
          ),
          height: Math.round(
            this.convertDimensions(pkg.height, pkg.dimensionUnit, 'in'),
          ),
          units: 'IN',
        },
      }))

      const response = await fetch(`${this.baseUrl}/rate/v1/rates/quotes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accountNumber: { value: this.accountNumber },
          requestedShipment: {
            shipper: {
              address: {
                streetLines: [from.street1, from.street2].filter(Boolean),
                city: from.city,
                stateOrProvinceCode: from.state,
                postalCode: from.postalCode,
                countryCode: from.country,
                residential: from.isResidential,
              },
            },
            recipient: {
              address: {
                streetLines: [to.street1, to.street2].filter(Boolean),
                city: to.city,
                stateOrProvinceCode: to.state,
                postalCode: to.postalCode,
                countryCode: to.country,
                residential: to.isResidential,
              },
            },
            pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
            rateRequestType: ['ACCOUNT', 'LIST'],
            requestedPackageLineItems,
          },
        }),
      })

      const data = (await response.json()) as FedExErrorResponse &
        FedExRateOutput

      if (!response.ok) {
        throw new Error(
          data.errors?.[0]?.message || 'Failed to get FedEx rates',
        )
      }

      return this.parseRates(data)
    } catch (error) {
      logger.error('FedEx rate error:', error)
      return this.getMockRates(from, to, packages)
    }
  }

  private parseRates(data: any): ShippingRate[] {
    const rates: ShippingRate[] = []

    for (const rateReply of data.output?.rateReplyDetails || []) {
      const ratedShipment = rateReply.ratedShipmentDetails?.[0]
      if (!ratedShipment) continue

      rates.push({
        carrier: 'fedex',
        serviceCode: rateReply.serviceType,
        serviceName: this.getServiceName(rateReply.serviceType),
        deliveryDays: rateReply.commit?.transitDays?.minimumDays || null,
        deliveryDate: rateReply.commit?.dateDetail?.dayOfWeek || null,
        totalPrice: parseFloat(ratedShipment.totalNetCharge) || 0,
        currency: ratedShipment.currency || 'USD',
        guaranteed: rateReply.commit?.guaranteedDelivery || false,
        rateId: rateReply.operationalDetail?.serviceDescription?.serviceId,
      })
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

    const rates: ShippingRate[] = [
      {
        carrier: 'fedex',
        serviceCode: 'FEDEX_GROUND',
        serviceName: 'FedEx Ground',
        deliveryDays: 5,
        deliveryDate: null,
        totalPrice: Math.round((8.99 + baseWeight * 0.5) * 100) / 100,
        currency: 'USD',
        guaranteed: false,
      },
      {
        carrier: 'fedex',
        serviceCode: 'FEDEX_EXPRESS_SAVER',
        serviceName: 'FedEx Express Saver',
        deliveryDays: 3,
        deliveryDate: null,
        totalPrice: Math.round((15.99 + baseWeight * 0.75) * 100) / 100,
        currency: 'USD',
        guaranteed: true,
      },
      {
        carrier: 'fedex',
        serviceCode: 'FEDEX_2_DAY',
        serviceName: 'FedEx 2Day',
        deliveryDays: 2,
        deliveryDate: null,
        totalPrice: Math.round((22.99 + baseWeight * 1.0) * 100) / 100,
        currency: 'USD',
        guaranteed: true,
      },
      {
        carrier: 'fedex',
        serviceCode: 'PRIORITY_OVERNIGHT',
        serviceName: 'FedEx Priority Overnight',
        deliveryDays: 1,
        deliveryDate: null,
        totalPrice: Math.round((39.99 + baseWeight * 1.5) * 100) / 100,
        currency: 'USD',
        guaranteed: true,
      },
      {
        carrier: 'fedex',
        serviceCode: 'STANDARD_OVERNIGHT',
        serviceName: 'FedEx Standard Overnight',
        deliveryDays: 1,
        deliveryDate: null,
        totalPrice: Math.round((34.99 + baseWeight * 1.25) * 100) / 100,
        currency: 'USD',
        guaranteed: true,
      },
    ]

    // Adjust for international
    if (from.country !== to.country) {
      return [
        {
          carrier: 'fedex',
          serviceCode: 'FEDEX_INTERNATIONAL_ECONOMY',
          serviceName: 'FedEx International Economy',
          deliveryDays: 7,
          deliveryDate: null,
          totalPrice: Math.round((45.99 + baseWeight * 3.0) * 100) / 100,
          currency: 'USD',
          guaranteed: false,
        },
        {
          carrier: 'fedex',
          serviceCode: 'FEDEX_INTERNATIONAL_PRIORITY',
          serviceName: 'FedEx International Priority',
          deliveryDays: 3,
          deliveryDate: null,
          totalPrice: Math.round((89.99 + baseWeight * 5.0) * 100) / 100,
          currency: 'USD',
          guaranteed: true,
        },
      ]
    }

    return rates
  }

  async track(trackingNumber: string): Promise<TrackingInfo> {
    if (!this.apiKey) {
      return this.getMockTracking(trackingNumber)
    }

    try {
      const token = await this.getAccessToken()

      const response = await fetch(`${this.baseUrl}/track/v1/trackingnumbers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          includeDetailedScans: true,
          trackingInfo: [
            {
              trackingNumberInfo: {
                trackingNumber,
              },
            },
          ],
        }),
      })

      const data = (await response.json()) as FedExErrorResponse &
        FedExTrackOutput

      if (!response.ok) {
        throw new Error(data.errors?.[0]?.message || 'Failed to track shipment')
      }

      return this.parseTracking(trackingNumber, data)
    } catch (error) {
      logger.error('FedEx tracking error:', error)
      return this.getMockTracking(trackingNumber)
    }
  }

  private parseTracking(trackingNumber: string, data: any): TrackingInfo {
    const trackResult =
      data.output?.completeTrackResults?.[0]?.trackResults?.[0]
    if (!trackResult) {
      throw new Error('Tracking information not found')
    }

    const events: TrackingEvent[] = (trackResult.scanEvents || []).map(
      (event: any) => ({
        timestamp: event.date,
        location: [
          event.scanLocation?.city,
          event.scanLocation?.stateOrProvinceCode,
          event.scanLocation?.countryCode,
        ]
          .filter(Boolean)
          .join(', '),
        description: event.eventDescription,
        status: event.derivedStatus || event.eventType,
      }),
    )

    return {
      carrier: 'fedex',
      trackingNumber,
      status: trackResult.latestStatusDetail?.statusByLocale || 'Unknown',
      statusDescription: trackResult.latestStatusDetail?.description || '',
      estimatedDelivery:
        trackResult.estimatedDeliveryTimeWindow?.window?.ends || null,
      actualDelivery: trackResult.actualDeliveryDate || null,
      signedBy: trackResult.deliveryDetails?.receivedByName || null,
      events,
    }
  }

  private getMockTracking(trackingNumber: string): TrackingInfo {
    const now = new Date()
    const events: TrackingEvent[] = [
      {
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
        location: 'Los Angeles, CA',
        description: 'Out for Delivery',
        status: 'OFD',
      },
      {
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 8).toISOString(),
        location: 'Los Angeles, CA',
        description: 'At local FedEx facility',
        status: 'AR',
      },
      {
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
        location: 'Phoenix, AZ',
        description: 'In transit',
        status: 'IT',
      },
      {
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString(),
        location: 'Dallas, TX',
        description: 'Departed FedEx location',
        status: 'DP',
      },
      {
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 72).toISOString(),
        location: 'Memphis, TN',
        description: 'Picked up',
        status: 'PU',
      },
    ]

    return {
      carrier: 'fedex',
      trackingNumber,
      status: 'In Transit',
      statusDescription: 'Package is out for delivery',
      estimatedDelivery: new Date(
        now.getTime() + 1000 * 60 * 60 * 6,
      ).toISOString(),
      actualDelivery: null,
      signedBy: null,
      events,
    }
  }

  async createShipment(request: ShipmentRequest): Promise<ShipmentLabel> {
    if (!this.apiKey) {
      return this.getMockLabel(request)
    }

    try {
      const token = await this.getAccessToken()

      const requestedPackageLineItems = request.packages.map((pkg, index) => ({
        sequenceNumber: index + 1,
        weight: {
          value: this.convertWeight(pkg.weight, pkg.weightUnit, 'lb'),
          units: 'LB',
        },
        dimensions: {
          length: Math.round(
            this.convertDimensions(pkg.length, pkg.dimensionUnit, 'in'),
          ),
          width: Math.round(
            this.convertDimensions(pkg.width, pkg.dimensionUnit, 'in'),
          ),
          height: Math.round(
            this.convertDimensions(pkg.height, pkg.dimensionUnit, 'in'),
          ),
          units: 'IN',
        },
      }))

      const response = await fetch(`${this.baseUrl}/ship/v1/shipments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          labelResponseOptions: 'LABEL',
          requestedShipment: {
            shipper: {
              contact: {
                personName: request.from.name,
                phoneNumber: request.from.phone,
                emailAddress: request.from.email,
              },
              address: {
                streetLines: [
                  request.from.street1,
                  request.from.street2,
                ].filter(Boolean),
                city: request.from.city,
                stateOrProvinceCode: request.from.state,
                postalCode: request.from.postalCode,
                countryCode: request.from.country,
              },
            },
            recipients: [
              {
                contact: {
                  personName: request.to.name,
                  phoneNumber: request.to.phone,
                  emailAddress: request.to.email,
                },
                address: {
                  streetLines: [request.to.street1, request.to.street2].filter(
                    Boolean,
                  ),
                  city: request.to.city,
                  stateOrProvinceCode: request.to.state,
                  postalCode: request.to.postalCode,
                  countryCode: request.to.country,
                },
              },
            ],
            pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
            serviceType: request.serviceCode,
            packagingType: 'YOUR_PACKAGING',
            labelSpecification: {
              labelFormatType: 'COMMON2D',
              imageType: request.labelFormat || 'PDF',
            },
            requestedPackageLineItems,
            shippingDocumentSpecification: {
              shippingDocumentTypes: ['LABEL'],
            },
          },
          accountNumber: { value: this.accountNumber },
        }),
      })

      const data = (await response.json()) as FedExErrorResponse &
        FedExShipmentOutput

      if (!response.ok) {
        throw new Error(
          data.errors?.[0]?.message || 'Failed to create shipment',
        )
      }

      const shipmentResponse = data.output?.transactionShipments?.[0]
      const pieceResponse = shipmentResponse?.pieceResponses?.[0]

      return {
        trackingNumber: pieceResponse?.trackingNumber || '',
        labelData: pieceResponse?.packageDocuments?.[0]?.encodedLabel || '',
        labelFormat: request.labelFormat || 'PDF',
        carrier: 'fedex',
        serviceCode: request.serviceCode,
        cost:
          shipmentResponse?.completedShipmentDetail?.shipmentRating
            ?.totalNetCharge?.amount || 0,
      }
    } catch (error) {
      logger.error('FedEx create shipment error:', error)
      throw error
    }
  }

  private getMockLabel(request: ShipmentRequest): ShipmentLabel {
    const trackingNumber = `7489${Math.random().toString().slice(2, 14)}`

    return {
      trackingNumber,
      labelData: 'MOCK_LABEL_DATA_BASE64',
      labelFormat: request.labelFormat || 'PDF',
      carrier: 'fedex',
      serviceCode: request.serviceCode,
      cost: 15.99,
    }
  }

  async validateAddress(
    address: ShippingAddress,
  ): Promise<{ valid: boolean; suggestions?: ShippingAddress[] }> {
    if (!this.apiKey) {
      return { valid: true }
    }

    try {
      const token = await this.getAccessToken()

      const response = await fetch(
        `${this.baseUrl}/address/v1/addresses/resolve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            addressesToValidate: [
              {
                address: {
                  streetLines: [address.street1, address.street2].filter(
                    Boolean,
                  ),
                  city: address.city,
                  stateOrProvinceCode: address.state,
                  postalCode: address.postalCode,
                  countryCode: address.country,
                },
              },
            ],
          }),
        },
      )

      const data = (await response.json()) as FedExAddressOutput

      if (!response.ok) {
        return { valid: false }
      }

      const result = data.output?.resolvedAddresses?.[0]
      if (!result) {
        return { valid: false }
      }

      return {
        valid: result.classification === 'RESOLVED',
        suggestions: result.effectiveAddress
          ? [
              {
                name: address.name,
                company: address.company,
                street1:
                  result.effectiveAddress.streetLinesToken?.[0] ||
                  address.street1,
                street2: result.effectiveAddress.streetLinesToken?.[1],
                city: result.effectiveAddress.city || address.city,
                state:
                  result.effectiveAddress.stateOrProvinceCode || address.state,
                postalCode:
                  result.effectiveAddress.postalCode || address.postalCode,
                country: result.effectiveAddress.countryCode || address.country,
                phone: address.phone,
                email: address.email,
              },
            ]
          : undefined,
      }
    } catch (error) {
      logger.error('FedEx address validation error:', error)
      return { valid: false }
    }
  }

  async cancelShipment(trackingNumber: string): Promise<boolean> {
    if (!this.apiKey) {
      return true
    }

    try {
      const token = await this.getAccessToken()

      const response = await fetch(`${this.baseUrl}/ship/v1/shipments/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accountNumber: { value: this.accountNumber },
          trackingNumber,
        }),
      })

      return response.ok
    } catch (error) {
      logger.error('FedEx cancel shipment error:', error)
      return false
    }
  }

  private getServiceName(code: string): string {
    const services: Record<string, string> = {
      FEDEX_GROUND: 'FedEx Ground',
      FEDEX_HOME_DELIVERY: 'FedEx Home Delivery',
      FEDEX_EXPRESS_SAVER: 'FedEx Express Saver',
      FEDEX_2_DAY: 'FedEx 2Day',
      FEDEX_2_DAY_AM: 'FedEx 2Day A.M.',
      PRIORITY_OVERNIGHT: 'FedEx Priority Overnight',
      STANDARD_OVERNIGHT: 'FedEx Standard Overnight',
      FIRST_OVERNIGHT: 'FedEx First Overnight',
      FEDEX_FREIGHT_ECONOMY: 'FedEx Freight Economy',
      FEDEX_FREIGHT_PRIORITY: 'FedEx Freight Priority',
      FEDEX_INTERNATIONAL_ECONOMY: 'FedEx International Economy',
      FEDEX_INTERNATIONAL_PRIORITY: 'FedEx International Priority',
      INTERNATIONAL_FIRST: 'FedEx International First',
    }
    return services[code] || code
  }

  static getServices(): { code: string; name: string }[] {
    return [
      { code: 'FEDEX_GROUND', name: 'FedEx Ground' },
      { code: 'FEDEX_HOME_DELIVERY', name: 'FedEx Home Delivery' },
      { code: 'FEDEX_EXPRESS_SAVER', name: 'FedEx Express Saver' },
      { code: 'FEDEX_2_DAY', name: 'FedEx 2Day' },
      { code: 'FEDEX_2_DAY_AM', name: 'FedEx 2Day A.M.' },
      { code: 'PRIORITY_OVERNIGHT', name: 'FedEx Priority Overnight' },
      { code: 'STANDARD_OVERNIGHT', name: 'FedEx Standard Overnight' },
      { code: 'FIRST_OVERNIGHT', name: 'FedEx First Overnight' },
      {
        code: 'FEDEX_INTERNATIONAL_ECONOMY',
        name: 'FedEx International Economy',
      },
      {
        code: 'FEDEX_INTERNATIONAL_PRIORITY',
        name: 'FedEx International Priority',
      },
    ]
  }
}
