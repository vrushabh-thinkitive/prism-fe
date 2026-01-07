import { useCallback } from 'react';
import { useAuthUser } from './useAuthUser';

/**
 * Custom hook for making authenticated API calls with Bearer token
 * Automatically includes the access token in the Authorization header
 * 
 * @returns Object with methods for making authenticated API calls
 */
export const useApi = () => {
  const { getAccessToken, isAuthenticated } = useAuthUser();

  /**
   * Make an authenticated API call
   * @param url - The API endpoint URL
   * @param options - Fetch options (method, body, headers, etc.)
   * @returns Promise<Response> - The fetch response
   */
  const authenticatedFetch = useCallback(
    async (
      url: string,
      options: RequestInit = {}
    ): Promise<Response> => {
      if (!isAuthenticated) {
        throw new Error('User is not authenticated');
      }

      try {
        const token = await getAccessToken();
        
        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${token}`);
        headers.set('Content-Type', 'application/json');

        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (!response.ok) {
          throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }

        return response;
      } catch (error) {
        console.error('Authenticated API call failed:', error);
        throw error;
      }
    },
    [isAuthenticated, getAccessToken]
  );

  /**
   * Make a GET request
   * @param url - The API endpoint URL
   * @returns Promise<T> - The parsed JSON response
   */
  const get = useCallback(
    async <T = unknown>(url: string): Promise<T> => {
      const response = await authenticatedFetch(url, {
        method: 'GET',
      });
      return response.json();
    },
    [authenticatedFetch]
  );

  /**
   * Make a POST request
   * @param url - The API endpoint URL
   * @param data - The data to send in the request body
   * @returns Promise<T> - The parsed JSON response
   */
  const post = useCallback(
    async <T = unknown>(url: string, data?: unknown): Promise<T> => {
      const response = await authenticatedFetch(url, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      });
      return response.json();
    },
    [authenticatedFetch]
  );

  /**
   * Make a PUT request
   * @param url - The API endpoint URL
   * @param data - The data to send in the request body
   * @returns Promise<T> - The parsed JSON response
   */
  const put = useCallback(
    async <T = unknown>(url: string, data?: unknown): Promise<T> => {
      const response = await authenticatedFetch(url, {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
      });
      return response.json();
    },
    [authenticatedFetch]
  );

  /**
   * Make a DELETE request
   * @param url - The API endpoint URL
   * @returns Promise<T> - The parsed JSON response
   */
  const del = useCallback(
    async <T = unknown>(url: string): Promise<T> => {
      const response = await authenticatedFetch(url, {
        method: 'DELETE',
      });
      return response.json();
    },
    [authenticatedFetch]
  );

  return {
    get,
    post,
    put,
    delete: del,
    authenticatedFetch,
  };
};

