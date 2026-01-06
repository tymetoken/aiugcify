import type {
  ApiResponse,
  ApiErrorResponse,
  AuthResponse,
  AuthTokens,
  UserPublic,
  CreditPackage,
  CreditTransaction,
  SubscriptionPlan,
  UserSubscription,
  Video,
  VideoListItem,
  GenerateScriptResponse,
  ProductData,
  VideoStyle,
  PaginationMeta,
} from '@aiugcify/shared-types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onTokenRefresh?: (tokens: AuthTokens) => void;

  setTokens(accessToken: string | null, refreshToken: string | null) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  setOnTokenRefresh(callback: (tokens: AuthTokens) => void) {
    this.onTokenRefresh = callback;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiErrorResponse;

      // Handle token expiry
      if (response.status === 401 && error.error.code === 'TOKEN_EXPIRED' && this.refreshToken) {
        const newTokens = await this.refreshTokens();
        if (newTokens) {
          // Retry with new token
          (headers as Record<string, string>)['Authorization'] = `Bearer ${newTokens.accessToken}`;
          const retryResponse = await fetch(url, { ...options, headers });
          const retryData = await retryResponse.json();

          if (!retryResponse.ok) {
            throw new Error((retryData as ApiErrorResponse).error.message);
          }
          return (retryData as ApiResponse<T>).data;
        }
      }

      throw new Error(error.error.message);
    }

    return (data as ApiResponse<T>).data;
  }

  private async refreshTokens(): Promise<AuthTokens | null> {
    if (!this.refreshToken) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        this.accessToken = null;
        this.refreshToken = null;
        return null;
      }

      const data = await response.json();
      const tokens = (data as ApiResponse<{ tokens: AuthTokens }>).data.tokens;

      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;

      if (this.onTokenRefresh) {
        this.onTokenRefresh(tokens);
      }

      return tokens;
    } catch {
      return null;
    }
  }

  // Auth endpoints
  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });
  }

  async getMe(): Promise<{ user: UserPublic }> {
    return this.request<{ user: UserPublic }>('/auth/me');
  }

  async googleAuth(idToken: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  }

  // Credits endpoints
  async getPackages(): Promise<{ packages: CreditPackage[] }> {
    return this.request<{ packages: CreditPackage[] }>('/credits/packages');
  }

  async getBalance(): Promise<{ balance: number }> {
    return this.request<{ balance: number }>('/credits/balance');
  }

  async createCheckout(packageId: string): Promise<{ sessionId: string; checkoutUrl: string }> {
    // Use API hosted pages for Stripe redirects (chrome-extension:// URLs don't work)
    const baseUrl = API_BASE_URL.replace('/api/v1', '');
    return this.request<{ sessionId: string; checkoutUrl: string }>('/credits/checkout', {
      method: 'POST',
      body: JSON.stringify({
        packageId,
        successUrl: `${baseUrl}/checkout/success`,
        cancelUrl: `${baseUrl}/checkout/cancelled`,
      }),
    });
  }

  async getHistory(
    page = 1,
    limit = 20
  ): Promise<{ transactions: CreditTransaction[]; meta: PaginationMeta }> {
    const response = await fetch(
      `${API_BASE_URL}/credits/history?page=${page}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );
    const data = await response.json();
    return {
      transactions: data.data.transactions,
      meta: data.meta,
    };
  }

  // Subscription endpoints
  async getSubscriptionPlans(): Promise<{ plans: SubscriptionPlan[] }> {
    return this.request<{ plans: SubscriptionPlan[] }>('/credits/subscription/plans');
  }

  async getSubscriptionStatus(): Promise<{ subscription: UserSubscription | null }> {
    return this.request<{ subscription: UserSubscription | null }>('/credits/subscription/status');
  }

  async createSubscriptionCheckout(
    planId: string,
    interval: 'monthly' | 'yearly'
  ): Promise<{ sessionId: string; checkoutUrl: string }> {
    // Use API hosted pages for Stripe redirects (chrome-extension:// URLs don't work)
    const baseUrl = API_BASE_URL.replace('/api/v1', '');
    return this.request<{ sessionId: string; checkoutUrl: string }>('/credits/subscription/checkout', {
      method: 'POST',
      body: JSON.stringify({
        planId,
        interval,
        successUrl: `${baseUrl}/checkout/success`,
        cancelUrl: `${baseUrl}/checkout/cancelled`,
      }),
    });
  }

  async cancelSubscription(cancelAtPeriodEnd = true): Promise<void> {
    await this.request('/credits/subscription/cancel', {
      method: 'POST',
      body: JSON.stringify({ cancelAtPeriodEnd }),
    });
  }

  async resumeSubscription(): Promise<void> {
    await this.request('/credits/subscription/resume', { method: 'POST' });
  }

  // Videos endpoints
  async generateScript(
    productData: ProductData,
    videoStyle: VideoStyle,
    options?: {
      tone?: 'casual' | 'professional' | 'enthusiastic' | 'humorous';
      targetDuration?: number;
      additionalNotes?: string;
    }
  ): Promise<GenerateScriptResponse> {
    return this.request<GenerateScriptResponse>('/videos/generate-script', {
      method: 'POST',
      body: JSON.stringify({ productData, videoStyle, options }),
    });
  }

  async updateScript(videoId: string, script: string): Promise<{ video: Video }> {
    return this.request<{ video: Video }>(`/videos/${videoId}/script`, {
      method: 'PUT',
      body: JSON.stringify({ script }),
    });
  }

  async confirmGeneration(videoId: string): Promise<{ video: Video }> {
    return this.request<{ video: Video }>(`/videos/${videoId}/confirm`, {
      method: 'POST',
    });
  }

  async getVideo(videoId: string): Promise<{ video: Video }> {
    return this.request<{ video: Video }>(`/videos/${videoId}`);
  }

  async getVideos(
    page = 1,
    limit = 20
  ): Promise<{ videos: VideoListItem[]; meta: PaginationMeta }> {
    const response = await fetch(
      `${API_BASE_URL}/videos?page=${page}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );
    const data = await response.json();
    return {
      videos: data.data.videos,
      meta: data.meta,
    };
  }

  async getDownloadUrl(videoId: string): Promise<{ downloadUrl: string }> {
    return this.request<{ downloadUrl: string }>(`/videos/${videoId}/download`);
  }

  async cancelVideo(videoId: string): Promise<void> {
    await this.request(`/videos/${videoId}`, { method: 'DELETE' });
  }

  async retryVideo(videoId: string): Promise<{ video: Video }> {
    return this.request<{ video: Video }>(`/videos/${videoId}/retry`, {
      method: 'POST',
    });
  }
}

export const apiClient = new ApiClient();
