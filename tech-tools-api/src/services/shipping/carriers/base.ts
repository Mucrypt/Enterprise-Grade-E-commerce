/**
 * Base Carrier Interface
 * Abstract class that all carrier implementations must extend
 */

import {
  ShippingAddress,
  Package,
  ShippingRate,
  TrackingInfo,
  ShipmentRequest,
  ShipmentLabel,
} from '../index'

export abstract class BaseCarrier {
  protected sandbox: boolean = true
  protected credentials: any = {}

  abstract setCredentials(credentials: any): void
  abstract getRates(
    from: ShippingAddress,
    to: ShippingAddress,
    packages: Package[],
  ): Promise<ShippingRate[]>
  abstract track(trackingNumber: string): Promise<TrackingInfo>
  abstract createShipment(request: ShipmentRequest): Promise<ShipmentLabel>
  abstract validateAddress(
    address: ShippingAddress,
  ): Promise<{ valid: boolean; suggestions?: ShippingAddress[] }>
  abstract cancelShipment(trackingNumber: string): Promise<boolean>

  protected calculateDimensionalWeight(
    length: number,
    width: number,
    height: number,
    dimFactor: number = 139, // Standard DIM factor for domestic US
  ): number {
    return (length * width * height) / dimFactor
  }

  protected convertWeight(
    weight: number,
    fromUnit: 'lb' | 'kg' | 'oz' | 'g',
    toUnit: 'lb' | 'kg',
  ): number {
    // Convert to kg first
    let weightInKg: number
    switch (fromUnit) {
      case 'lb':
        weightInKg = weight * 0.453592
        break
      case 'oz':
        weightInKg = weight * 0.0283495
        break
      case 'g':
        weightInKg = weight / 1000
        break
      default:
        weightInKg = weight
    }

    // Convert to target unit
    return toUnit === 'kg' ? weightInKg : weightInKg * 2.20462
  }

  protected convertDimensions(
    value: number,
    fromUnit: 'in' | 'cm',
    toUnit: 'in' | 'cm',
  ): number {
    if (fromUnit === toUnit) return value
    return fromUnit === 'in' ? value * 2.54 : value / 2.54
  }
}
