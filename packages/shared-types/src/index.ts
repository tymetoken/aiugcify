// User Types
export interface User {
  id: string;
  email: string;
  name: string | null;
  creditBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPublic {
  id: string;
  email: string;
  name: string | null;
  creditBalance: number;
  hasActiveSubscription: boolean;
  subscription?: UserSubscription;
}

// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: UserPublic;
  tokens: AuthTokens;
}

// Platform Types
export type Platform =
  | 'TIKTOK_SHOP'
  | 'YOUTUBE_SHORTS'
  | 'FACEBOOK_REELS'
  | 'INSTAGRAM_REELS'
  | 'AMAZON'
  | 'SHOPIFY';

// Product Types (scraped from multiple platforms)
export interface ProductReview {
  rating: number;
  text: string;
  author?: string;
  date?: string;
}

export interface VideoMetadata {
  videoId?: string;
  duration?: number;
  viewCount?: string;
  likeCount?: string;
  creator?: string;
  creatorHandle?: string;
  hashtags?: string[];
  productMentions?: string[];
}

export interface AffiliateLink {
  type: 'product' | 'creator' | 'shop';
  url: string;
  label?: string;
}

export interface ProductVariant {
  id: string;
  title: string;
  price: string;
  available: boolean;
  options?: Record<string, string>;
}

export interface ProductData {
  platform?: Platform;
  url: string;
  title: string;
  description: string;
  price: string;
  originalPrice?: string;
  discount?: string;
  images: string[];
  reviews?: ProductReview[];
  rating?: number;
  soldCount?: string;
  specifications?: Record<string, string>;
  shopName?: string;
  // Platform-specific fields
  videoMetadata?: VideoMetadata;
  affiliateLinks?: AffiliateLink[];
  variants?: ProductVariant[];
  bulletPoints?: string[];
}

// AI Analysis Types (from GPT-4 product analysis)
export interface VisualAnalysis {
  colors: string[];
  materials: string[];
  shape: string;
  size: string;
  textures: string[];
  style: string;
}

export interface AnalyzedProduct {
  productName: string;
  productDescription: string;
  keyFeatures: string[];
  keyBenefits: string[];
  targetCustomer: string;
  problemsSolved: string[];
  uniqueSellingPoints: string[];
  masterProductSummary: string;
  imageUrl: string;
  visualAnalysis?: VisualAnalysis;
  priceInfo: {
    currentPrice: string;
    originalPrice?: string;
    discount?: string;
  };
}

// Video Types
export type VideoStatus =
  | 'PENDING_SCRIPT'
  | 'SCRIPT_READY'
  | 'QUEUED'
  | 'GENERATING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type VideoStyle = 'PRODUCT_SHOWCASE' | 'TALKING_HEAD' | 'LIFESTYLE';

export interface Video {
  id: string;
  userId: string;
  status: VideoStatus;
  platform: Platform;
  productData: ProductData;
  productTitle: string;
  productUrl: string;
  productImages: string[];
  generatedScript: string | null;
  editedScript: string | null;
  finalScript: string | null;
  videoStyle: VideoStyle;
  soraJobId: string | null;
  videoDuration: number | null;
  cloudinaryPublicId: string | null;
  cloudinaryUrl: string | null;
  downloadUrl: string | null;
  downloadExpiresAt: Date | null;
  thumbnailUrl: string | null;
  errorMessage: string | null;
  creditsUsed: number;
  createdAt: Date;
  completedAt: Date | null;
}

export interface VideoListItem {
  id: string;
  status: VideoStatus;
  platform: Platform;
  productTitle: string;
  videoStyle: VideoStyle;
  thumbnailUrl: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

// Script Generation Types
export interface GenerateScriptRequest {
  productData: ProductData;
  videoStyle: VideoStyle;
  platform?: Platform;
  options?: {
    tone?: 'casual' | 'professional' | 'enthusiastic' | 'humorous';
    targetDuration?: 15 | 20 | 25 | 30;
    includeCallToAction?: boolean;
    highlightFeatures?: string[];
    additionalNotes?: string;
  };
}

export interface GenerateScriptResponse {
  videoId: string;
  script: string;
  estimatedDuration: number;
  suggestedScenes: SceneSuggestion[];
}

export interface SceneSuggestion {
  timestamp: string;
  description: string;
  visualSuggestion: string;
}

export interface UpdateScriptRequest {
  script: string;
}

// Credit Types
export type TransactionType =
  | 'PURCHASE'
  | 'CONSUMPTION'
  | 'REFUND'
  | 'BONUS'
  | 'ADJUSTMENT'
  | 'SUBSCRIPTION_CREDIT'
  | 'SUBSCRIPTION_BONUS';

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceInCents: number;
  bonusCredits: number;
  badgeText: string | null;
}

export interface CreditTransaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: Date;
}

export interface CheckoutRequest {
  packageId: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutResponse {
  sessionId: string;
  checkoutUrl: string;
}

// Subscription Types
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED';
export type SubscriptionInterval = 'MONTHLY' | 'YEARLY';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  monthlyPriceInCents: number;
  monthlyCredits: number;
  yearlyPriceInCents: number;
  yearlyCredits: number;
  yearlyBonusCredits: number;
  features: string[];
  badgeText: string | null;
}

export interface UserSubscription {
  id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  interval: SubscriptionInterval;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  creditsPerPeriod: number;
  creditsUsedThisPeriod: number;
  creditsRemaining: number;
}

export interface SubscriptionCheckoutRequest {
  planId: string;
  interval: 'monthly' | 'yearly';
  successUrl?: string;
  cancelUrl?: string;
}

export interface SubscriptionCheckoutResponse {
  sessionId: string;
  checkoutUrl: string;
}

// Billing/Invoice Types
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';

export interface Invoice {
  id: string;
  number: string | null;
  status: InvoiceStatus | null;
  amountDue: number;
  amountPaid: number;
  currency: string;
  created: Date;
  periodStart: Date | null;
  periodEnd: Date | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  description: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

// Video Generation Progress
export interface VideoProgress {
  videoId: string;
  status: VideoStatus;
  progress: number; // 0-100
  message?: string;
}

// Extension Message Types
export type ExtensionMessageType =
  | 'GET_AUTH_STATUS'
  | 'LOGIN'
  | 'LOGOUT'
  | 'SCRAPE_PRODUCT'
  | 'PRODUCT_DATA'
  | 'GENERATE_SCRIPT'
  | 'CONFIRM_VIDEO'
  | 'GET_VIDEO_STATUS'
  | 'API_REQUEST';

export interface ExtensionMessage<T = unknown> {
  type: ExtensionMessageType;
  payload?: T;
}

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
