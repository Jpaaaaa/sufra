/**
 * API Retry Utility with Exponential Backoff
 * 
 * Handles retries for network errors and connection refused errors.
 * Used for production reliability when backend may start after frontend.
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,
  initialDelay: 500, // 500ms
  maxDelay: 5000, // 5 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    'ERR_CONNECTION_REFUSED',
    'ECONNREFUSED',
    'Failed to fetch',
    'NetworkError',
    'Network request failed',
  ],
};

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || error.toString() || '';
  const errorCode = error.code || '';
  
  const retryableErrors = DEFAULT_OPTIONS.retryableErrors;
  
  // Check error message
  for (const retryableError of retryableErrors) {
    if (errorMessage.includes(retryableError)) {
      return true;
    }
  }
  
  // Check error code
  if (retryableErrors.includes(errorCode)) {
    return true;
  }
  
  // Network errors are generally retryable
  if (errorMessage.includes('network') || errorMessage.includes('Network')) {
    return true;
  }
  
  return false;
}

/**
 * Calculate delay for exponential backoff
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const delay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt);
  return Math.min(delay, options.maxDelay);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on last attempt
      if (attempt === opts.maxRetries) {
        break;
      }
      
      // Only retry retryable errors
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt, opts);
      
      // Log retry attempt (only in dev or for debugging)
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[API Retry] Attempt ${attempt + 1}/${opts.maxRetries + 1} failed, retrying in ${delay}ms...`,
          error.message || error
        );
      }
      
      await sleep(delay);
    }
  }
  
  // All retries exhausted
  throw lastError;
}

/**
 * Enhanced fetch with retry logic
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  return retryWithBackoff(async () => {
    const response = await fetch(input, init);
    
    // Don't retry on client errors (4xx) except 408 (timeout)
    if (response.status >= 400 && response.status < 500 && response.status !== 408) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Retry on server errors (5xx) and timeouts
    if (response.status >= 500 || response.status === 408) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  }, retryOptions);
}

