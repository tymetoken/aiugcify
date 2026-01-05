import { config } from '../config/index.js';
import { logger } from './logger.js';

/**
 * Security utilities for input validation and sanitization
 */

// Allowed image domains for external URLs (used when domain allowlist is enabled)
const _ALLOWED_IMAGE_DOMAINS = [
  // TikTok
  'p16-sign-sg.tiktokcdn.com',
  'p16-sign-va.tiktokcdn.com',
  'p16-sign.tiktokcdn-us.com',
  'p19-sign.tiktokcdn-us.com',
  // Common CDNs
  'images.unsplash.com',
  'cdn.shopify.com',
  'i.imgur.com',
  'm.media-amazon.com',
  // Cloudinary (our own)
  'res.cloudinary.com',
];

// Blocked internal/private IP ranges
const BLOCKED_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

/**
 * Validates and sanitizes an image URL for safe use with external services
 * SECURITY: Prevents SSRF attacks by validating URLs before sending to OpenAI/external APIs
 */
export function validateImageUrl(url: string): { valid: boolean; sanitizedUrl: string | null; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, sanitizedUrl: null, error: 'Invalid URL: empty or not a string' };
  }

  try {
    const parsedUrl = new URL(url);

    // SECURITY: Enforce HTTPS in production
    if (config.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') {
      logger.warn({ url: url.substring(0, 100) }, 'Rejected non-HTTPS image URL in production');
      return { valid: false, sanitizedUrl: null, error: 'HTTPS required for image URLs in production' };
    }

    // Allow HTTP only in development
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return { valid: false, sanitizedUrl: null, error: 'Invalid protocol: only HTTP(S) allowed' };
    }

    // SECURITY: Block internal/private IPs to prevent SSRF
    const hostname = parsedUrl.hostname.toLowerCase();
    for (const pattern of BLOCKED_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        logger.warn({ hostname }, 'Blocked internal IP address in image URL');
        return { valid: false, sanitizedUrl: null, error: 'Internal IP addresses are not allowed' };
      }
    }

    // SECURITY: In production, validate against allowed domains (optional strictness)
    // Uncomment to enable domain allowlist:
    // if (config.NODE_ENV === 'production') {
    //   const isAllowedDomain = ALLOWED_IMAGE_DOMAINS.some(domain =>
    //     hostname === domain || hostname.endsWith('.' + domain)
    //   );
    //   if (!isAllowedDomain) {
    //     logger.warn({ hostname }, 'Image URL domain not in allowlist');
    //     return { valid: false, sanitizedUrl: null, error: 'Image domain not allowed' };
    //   }
    // }

    // Validate URL length to prevent DoS
    if (url.length > 2048) {
      return { valid: false, sanitizedUrl: null, error: 'URL exceeds maximum length (2048 characters)' };
    }

    // Return sanitized URL (removes any authentication info)
    const sanitizedUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`;

    return { valid: true, sanitizedUrl };
  } catch {
    return { valid: false, sanitizedUrl: null, error: 'Invalid URL format' };
  }
}

/**
 * Validates multiple image URLs and returns only the valid ones
 * SECURITY: Use this when processing arrays of user-provided image URLs
 */
export function validateImageUrls(urls: string[]): string[] {
  if (!Array.isArray(urls)) {
    return [];
  }

  const validUrls: string[] = [];

  for (const url of urls) {
    const result = validateImageUrl(url);
    if (result.valid && result.sanitizedUrl) {
      validUrls.push(result.sanitizedUrl);
    }
  }

  return validUrls;
}

/**
 * Sanitizes user input string for logging (removes potential injection)
 */
export function sanitizeForLogging(input: string, maxLength = 500): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .substring(0, maxLength)
    .replace(/[\r\n]/g, ' ')  // Remove newlines
    .replace(/[<>]/g, '');    // Remove potential HTML
}

/**
 * Validates that a string doesn't contain potentially dangerous characters
 * for use in shell commands or SQL (defense in depth)
 */
export function isCleanString(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  // Block common injection characters
  const dangerousPatterns = [
    /[;|&`$]/,           // Shell injection
    /['"\\/]/,           // Quote/path injection (be careful, may be too strict)
    /<script/i,          // XSS
    /javascript:/i,      // XSS
    /on\w+=/i,           // Event handlers
  ];

  return !dangerousPatterns.some(pattern => pattern.test(input));
}
