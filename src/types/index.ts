export type UserRole = 'admin' | 'resident' | 'guest' | 'superadmin'

export type BlockId = 'A' | 'B' | 'C' | 'COMMON'

export interface User {
  id: string
  email: string
  displayName: string
  role: UserRole
  flatId?: string
  societyId?: string
}

export interface Flat {
  id: string
  block: BlockId
  unit: string
  label: string
}

export interface MeterReading {
  id: string
  flatId: string
  month: string
  openingReading: number
  closingReading: number
  consumptionLiters: number
  consumptionKL: number
  enteredBy: string
  enteredByRole: UserRole
  createdAt: string
  updatedAt: string
  auditTrail: AuditEntry[]
}

/** One billable row per flat per month — derived from all readings in that month. */
export interface MonthlyFlatSummary {
  flatId: string
  month: string
  openingReading: number
  closingReading: number
  consumptionLiters: number
  consumptionKL: number
  readingCount: number
  lastUpdated: string
  enteredBy: string
  readings: MeterReading[]
}

export interface AuditEntry {
  action: 'create' | 'update' | 'delete'
  userId: string
  userName: string
  timestamp: string
  previousValues?: Partial<MeterReading>
}

export interface BillingConfig {
  id: string
  month: string
  tankerCapacityLiters: number
  tankerCost: number
  tankerCount: number
  maintenanceSurcharge: number
  locked: boolean
  lockedAt?: string
  lockedBy?: string
  billsGeneratedAt?: string
  billsGeneratedBy?: string
}

export interface FlatBill {
  flatId: string
  flat: Flat
  month: string
  openingReading: number
  closingReading: number
  consumptionLiters: number
  consumptionKL: number
  effectiveRatePerKL: number
  maintenanceShare: number
  waterCharge: number
  finalBill: number
  efficiencyScore: number
  lastUpdated: string
  enteredBy: string
}

/** Persisted snapshot of a flat bill at generation time. */
export interface StoredFlatBill extends FlatBill {
  id: string
  generatedAt: string
  generatedBy: string
}

export interface SocietyStats {
  month: string
  totalConsumptionKL: number
  totalConsumptionLiters: number
  totalWaterCost: number
  effectiveRatePerKL: number
  blockConsumption: Record<BlockId, number>
  topConsumers: Array<{ flat: Flat; consumptionKL: number }>
  dailyTrend: Array<{ date: string; consumptionKL: number }>
  tankerCount: number
  flatCount: number
}

export type AlertType =
  | 'consumption_spike'
  | 'sudden_drop'
  | 'meter_reset'
  | 'leakage_suspicion'
  | 'unusual_usage'

export interface Alert {
  id: string
  flatId: string
  flatLabel: string
  type: AlertType
  message: string
  severity: 'low' | 'medium' | 'high'
  month: string
  createdAt: string
  acknowledged: boolean
}

export interface FlatAnalytics {
  flat: Flat
  month: string
  currentConsumptionKL: number
  rolling3MonthAvgKL: number
  societyAvgKL: number
  blockAvgKL: number
  estimatedBill: number
  estimatedTankers: number
  efficiencyScore: number
  timeline: Array<{ month: string; consumptionKL: number; bill: number }>
  spikes: Array<{ month: string; percentIncrease: number }>
  anomalies: Alert[]
}

export interface InvoiceRow {
  block: string
  unit: string
  chargeType: string
  chargeDescription: string
  chargeDate: string
  payByDate: string
  amount: number
}

export interface CacheEntry<T = unknown> {
  key: string
  data: T
  expiresAt: number
  createdAt: number
}

export interface CacheConfig {
  ttlMs: number
  useIndexedDB: boolean
}

export const BLOCK_LABELS: Record<BlockId, string> = {
  A: 'Block A',
  B: 'Block B',
  C: 'Block C',
  COMMON: 'Common / Pool',
}

export const ALERT_LABELS: Record<AlertType, string> = {
  consumption_spike: 'Consumption Spike',
  sudden_drop: 'Sudden Drop',
  meter_reset: 'Meter Reset',
  leakage_suspicion: 'Leakage Suspicion',
  unusual_usage: 'Unusual Usage',
}

export type TankerOrderStatus = 'planned' | 'ordered' | 'delivered' | 'cancelled'

export interface TankerVendor {
  id: string
  name: string
  contactPerson: string
  phone: string
  defaultCapacityLiters: number
  defaultCostPerTanker: number
  active: boolean
}

export interface TankerDelivery {
  id: string
  month: string
  deliveryDate: string
  vendorId: string
  vendorName: string
  tankerCount: number
  capacityLiters: number
  costPerTanker: number
  totalLiters: number
  totalCost: number
  invoiceNumber?: string
  /** Compressed JPEG as a data URL — embedded in Firestore, no Storage needed. */
  vehicleSnapshotUrl?: string
  status: TankerOrderStatus
  notes?: string
  orderedBy: string
  createdAt: string
  updatedAt: string
}

export interface TankerProcurementSummary {
  month: string
  totalTankers: number
  totalLiters: number
  totalCost: number
  avgCostPerTanker: number
  capacityLiters: number
  deliveryCount: number
  deliveredCount: number
  plannedCount: number
  requiredLiters: number
  requiredTankers: number
  procurementGapLiters: number
  procurementGapTankers: number
  coveragePercent: number
}

export const TANKER_STATUS_LABELS: Record<TankerOrderStatus, string> = {
  planned: 'Planned',
  ordered: 'Ordered',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}
