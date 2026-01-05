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

// Product Types (scraped from TikTok Shop)
export interface ProductReview {
  rating: number;
  text: string;
  author?: string;
  date?: string;
}

export interface ProductData {
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
  options?: {
    tone?: 'casual' | 'professional' | 'enthusiastic' | 'humorous';
    targetDuration?: 15 | 20 | 25 | 30;
    includeCallToAction?: boolean;
    highlightFeatures?: string[];
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
export type TransactionType = 'PURCHASE' | 'CONSUMPTION' | 'REFUND' | 'BONUS' | 'ADJUSTMENT';
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
