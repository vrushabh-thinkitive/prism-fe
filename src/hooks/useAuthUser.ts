import { useAuth0 } from "@auth0/auth0-react";
import { useMemo } from "react";

/**
 * Custom hook that wraps useAuth0 and provides a simplified interface
 * with commonly used authentication properties and methods.
 *
 * @returns Object containing user data, authentication state, and auth methods
 */
export const useAuthUser = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  /**
   * Login function that redirects to Auth0 login page
   */
  const login = () => {
    loginWithRedirect({
      appState: {
        returnTo: window.location.pathname,
      },
    });
  };

  /**
   * Logout function that clears Auth0 session
   */
  const handleLogout = () => {
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  /**
   * Get access token for API calls
   * @returns Promise<string> - The access token
   */
  const getAccessToken = async (): Promise<string> => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: import.meta.env.VITE_AUTH0_SCOPE,
        },
      });
      return token;
    } catch (error) {
      console.error("Error getting access token:", error);
      throw error;
    }
  };

  // Memoize user properties for performance
  const userId = useMemo(() => user?.sub || null, [user]);
  const email = useMemo(() => user?.email || null, [user]);
  const name = useMemo(() => user?.name || null, [user]);
  const picture = useMemo(() => user?.picture || null, [user]);

  return {
    // User data
    user,
    userId,
    email,
    name,
    picture,

    // Authentication state
    isAuthenticated,
    isLoading,
    error,

    // Auth methods
    login,
    logout: handleLogout,
    getAccessToken,
  };
};
