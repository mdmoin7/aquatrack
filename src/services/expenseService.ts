import { cacheInvalidate } from '@/lib/cache'
import { dataStore } from '@/services/dataStore'
import { getNextMonth } from '@/lib/billing'
import type { ExpenseCategory, FundCollection, MonthlyExpenseProvision, SocietyExpense } from '@/types'

export async function getExpenses(month: string): Promise<SocietyExpense[]> {
  const expenses = await dataStore.getExpenses(month)
  return expenses.sort((a, b) => b.expenseDate.localeCompare(a.expenseDate))
}

export async function saveExpense(
  input: {
    month: string
    expenseDate: string
    category: ExpenseCategory
    description: string
    amount: number
    vendor?: string
    referenceNumber?: string
    notes?: string
    createdBy: string
  },
  existingId?: string,
): Promise<SocietyExpense> {
  const description = input.description.trim()
  if (!description) throw new Error('A description is required.')
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Enter an amount greater than zero.')
  }

  const existing = existingId ? (await dataStore.getExpenses()).find((item) => item.id === existingId) : undefined
  if (existingId && !existing) throw new Error('Expense not found.')
  const now = new Date().toISOString()
  const expense: SocietyExpense = {
    id: existingId ?? crypto.randomUUID(),
    ...input,
    description,
    vendor: input.vendor?.trim() || undefined,
    referenceNumber: input.referenceNumber?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  await dataStore.upsertExpense(expense)
  await cacheInvalidate(`dashboard:${input.month}`)
  return expense
}

export async function getExpenseProvision(month: string): Promise<MonthlyExpenseProvision> {
  const provision = await dataStore.getExpenseProvision(month)
  return provision ?? {
    id: month,
    billingMonth: month,
    collectionMonth: getNextMonth(month),
    paymentMonth: getNextMonth(month),
    updatedBy: '',
    updatedAt: '',
  }
}

export async function saveExpenseProvision(input: {
  billingMonth: string
  collectionMonth: string
  paymentMonth: string
  residentNote?: string
  updatedBy: string
  snapshotGeneratedAt?: string
  snapshotCutoffDate?: string
  surplusCarriedForward?: number
  carryForwardMonth?: string
}): Promise<MonthlyExpenseProvision> {
  const provision: MonthlyExpenseProvision = {
    id: input.billingMonth,
    ...input,
    residentNote: input.residentNote?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  }
  await dataStore.upsertExpenseProvision(provision)
  return provision
}

export async function getFundCollections(month: string): Promise<FundCollection[]> {
  const collections = await dataStore.getFundCollections(month)
  return collections.sort((a, b) => b.collectedDate.localeCompare(a.collectedDate))
}

export async function saveFundCollection(input: {
  billingMonth: string
  collectedDate: string
  amount: number
  source: string
  referenceNumber?: string
  notes?: string
  recordedBy: string
}): Promise<FundCollection> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Enter a collected amount greater than zero.')
  if (!input.source.trim()) throw new Error('Enter the collection source.')
  const collection: FundCollection = {
    id: crypto.randomUUID(),
    ...input,
    source: input.source.trim(),
    referenceNumber: input.referenceNumber?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
  }
  await dataStore.upsertFundCollection(collection)
  return collection
}

export async function deleteFundCollection(id: string): Promise<void> {
  await dataStore.deleteFundCollection(id)
}

export function calculateFundCollectionTotal(collections: FundCollection[]): number {
  return collections.reduce((total, collection) => total + collection.amount, 0)
}

/** Correct an accidentally selected billing month without losing its activity. */
export async function moveProvisioningMonth(fromMonth: string, toMonth: string): Promise<void> {
  if (fromMonth === toMonth) return
  const [expenses, collections, provision] = await Promise.all([
    dataStore.getExpenses(fromMonth),
    dataStore.getFundCollections(fromMonth),
    dataStore.getExpenseProvision(fromMonth),
  ])
  await Promise.all([
    ...expenses.map((expense) => dataStore.upsertExpense({ ...expense, month: toMonth, updatedAt: new Date().toISOString() })),
    ...collections.map((collection) => dataStore.upsertFundCollection({ ...collection, billingMonth: toMonth })),
  ])
  if (provision) {
    await dataStore.upsertExpenseProvision({
      ...provision,
      id: toMonth,
      billingMonth: toMonth,
      carryForwardMonth: provision.carryForwardMonth === getNextMonth(fromMonth) ? getNextMonth(toMonth) : provision.carryForwardMonth,
      updatedAt: new Date().toISOString(),
    })
    await dataStore.deleteExpenseProvision(fromMonth)
  }
}

export async function deleteExpense(id: string): Promise<void> {
  const expense = (await dataStore.getExpenses()).find((item) => item.id === id)
  if (!expense) throw new Error('Expense not found.')
  await dataStore.deleteExpense(id)
  await cacheInvalidate(`dashboard:${expense.month}`)
}

export function calculateExpenseTotal(expenses: SocietyExpense[]): number {
  return expenses.reduce((total, expense) => total + expense.amount, 0)
}

export function groupExpensesByCategory(expenses: SocietyExpense[]): Array<{ category: ExpenseCategory; amount: number }> {
  const totals = new Map<ExpenseCategory, number>()
  expenses.forEach((expense) => totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount))
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}
