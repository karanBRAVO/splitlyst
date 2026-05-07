export interface User {
  id: string
  email: string
  name: string
  avatar?: string | null
  currency: string
  timezone: string
  isPro: boolean
  phone?: string | null
  bio?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Group {
  id: string
  name: string
  description?: string | null
  avatar?: string | null
  currency: string
  category: string
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
  members?: GroupMember[]
  expenses?: Expense[]
  _count?: { members: number; expenses: number }
}

export interface GroupMember {
  id: string
  userId: string
  groupId: string
  role: string
  joinedAt: Date
  user?: User
  group?: Group
}

export interface Friendship {
  id: string
  userAId: string
  userBId: string
  status: string
  createdAt: Date
  userA?: User
  userB?: User
}

export interface Expense {
  id: string
  description: string
  amount: number
  currency: string
  category: string
  date: Date
  groupId?: string | null
  paidById: string
  splitType: SplitType
  notes?: string | null
  receiptUrl?: string | null
  isRecurring: boolean
  recurringId?: string | null
  exchangeRate?: number | null
  originalAmount?: number | null
  originalCurrency?: string | null
  createdAt: Date
  updatedAt: Date
  group?: Group | null
  paidBy?: User
  splits?: ExpenseSplit[]
  comments?: Comment[]
  attachments?: Attachment[]
}

export interface ExpenseSplit {
  id: string
  expenseId: string
  userId: string
  amount: number
  percentage?: number | null
  shares?: number | null
  isPaid: boolean
  user?: User
  expense?: Expense
}

export interface Payment {
  id: string
  payerId: string
  receiverId: string
  amount: number
  currency: string
  groupId?: string | null
  notes?: string | null
  createdAt: Date
  payer?: User
  receiver?: User
  group?: Group | null
}

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  read: boolean
  data?: Record<string, unknown> | null
  createdAt: Date
}

export interface Activity {
  id: string
  userId: string
  groupId?: string | null
  expenseId?: string | null
  type: ActivityType
  description: string
  metadata?: Record<string, unknown> | null
  createdAt: Date
  user?: User
  group?: Group | null
  expense?: Expense | null
}

export interface Comment {
  id: string
  expenseId: string
  userId: string
  text: string
  createdAt: Date
  user?: User
}

export interface Attachment {
  id: string
  expenseId: string
  url: string
  filename: string
  mimeType: string
  size: number
  createdAt: Date
}

export interface RecurringTemplate {
  id: string
  userId: string
  description: string
  amount: number
  currency: string
  category: string
  splitType: string
  interval: string
  nextRunAt: Date
  isActive: boolean
  groupId?: string | null
  data?: Record<string, unknown> | null
  createdAt: Date
}

export type SplitType = 'equal' | 'percentage' | 'shares' | 'custom'

export type ActivityType =
  | 'expense_added'
  | 'expense_updated'
  | 'expense_deleted'
  | 'payment_recorded'
  | 'group_created'
  | 'member_added'
  | 'member_removed'
  | 'friend_added'
  | 'settled_up'

export type ExpenseCategory =
  | 'general'
  | 'food'
  | 'transport'
  | 'entertainment'
  | 'utilities'
  | 'rent'
  | 'groceries'
  | 'healthcare'
  | 'travel'
  | 'shopping'
  | 'sports'
  | 'education'
  | 'gifts'
  | 'other'

export interface Balance {
  userId: string
  name: string
  avatar?: string | null
  owes: number
  owed: number
  net: number
}

export interface GroupBalance {
  groupId: string
  groupName: string
  balances: Balance[]
}

export interface DebtSimplification {
  from: User
  to: User
  amount: number
}

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
] as const

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; emoji: string }[] = [
  { value: 'general', label: 'General', emoji: '🧾' },
  { value: 'food', label: 'Food & Drink', emoji: '🍔' },
  { value: 'transport', label: 'Transportation', emoji: '🚗' },
  { value: 'entertainment', label: 'Entertainment', emoji: '🎬' },
  { value: 'utilities', label: 'Utilities', emoji: '💡' },
  { value: 'rent', label: 'Rent & Housing', emoji: '🏠' },
  { value: 'groceries', label: 'Groceries', emoji: '🛒' },
  { value: 'healthcare', label: 'Healthcare', emoji: '🏥' },
  { value: 'travel', label: 'Travel', emoji: '✈️' },
  { value: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { value: 'sports', label: 'Sports & Fitness', emoji: '⚽' },
  { value: 'education', label: 'Education', emoji: '📚' },
  { value: 'gifts', label: 'Gifts', emoji: '🎁' },
  { value: 'other', label: 'Other', emoji: '📦' },
]

export const GROUP_CATEGORIES = [
  { value: 'home', label: 'Home', emoji: '🏠' },
  { value: 'trip', label: 'Trip', emoji: '✈️' },
  { value: 'couple', label: 'Couple', emoji: '💑' },
  { value: 'friends', label: 'Friends', emoji: '👫' },
  { value: 'work', label: 'Work', emoji: '💼' },
  { value: 'family', label: 'Family', emoji: '👨‍👩‍👧‍👦' },
  { value: 'other', label: 'Other', emoji: '📦' },
]
