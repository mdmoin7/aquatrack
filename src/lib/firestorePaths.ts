const DEFAULT_SOCIETY_ID = import.meta.env.VITE_SOCIETY_ID ?? 'default'

let activeSocietyId = DEFAULT_SOCIETY_ID

export function setActiveSocietyId(id: string): void {
  activeSocietyId = id
}

export function getActiveSocietyId(): string {
  return activeSocietyId
}

export function societyPath(...segments: string[]): string {
  return ['societies', activeSocietyId, ...segments].join('/')
}

export const Collections = {
  users: () => 'users',
  society: () => `societies/${activeSocietyId}`,
  flats: () => `societies/${activeSocietyId}/flats`,
  flat: (id: string) => `societies/${activeSocietyId}/flats/${id}`,
  readings: () => `societies/${activeSocietyId}/readings`,
  reading: (id: string) => `societies/${activeSocietyId}/readings/${id}`,
  billingConfigs: () => `societies/${activeSocietyId}/billingConfigs`,
  billingConfig: (month: string) => `societies/${activeSocietyId}/billingConfigs/${month}`,
  flatBills: () => `societies/${activeSocietyId}/flatBills`,
  flatBill: (month: string, flatId: string) =>
    `societies/${activeSocietyId}/flatBills/${month}__${flatId}`,
  alerts: () => `societies/${activeSocietyId}/alerts`,
  alert: (id: string) => `societies/${activeSocietyId}/alerts/${id}`,
  tankerDeliveries: () => `societies/${activeSocietyId}/tankerDeliveries`,
  tankerDelivery: (id: string) => `societies/${activeSocietyId}/tankerDeliveries/${id}`,
  tankerVendors: () => `societies/${activeSocietyId}/tankerVendors`,
  tankerVendor: (id: string) => `societies/${activeSocietyId}/tankerVendors/${id}`,
  expenses: () => `societies/${activeSocietyId}/expenses`,
  expense: (id: string) => `societies/${activeSocietyId}/expenses/${id}`,
  expenseProvisions: () => `societies/${activeSocietyId}/expenseProvisions`,
  expenseProvision: (month: string) => `societies/${activeSocietyId}/expenseProvisions/${month}`,
  fundCollections: () => `societies/${activeSocietyId}/fundCollections`,
  fundCollection: (id: string) => `societies/${activeSocietyId}/fundCollections/${id}`,
} as const
