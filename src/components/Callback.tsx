import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

/**
 * Callback component to handle Auth0 redirect after login
 * This component is rendered at the callback URL configured in Auth0
 * It processes the authentication result and redirects the user
 */
const Callback = () => {
  const { isAuthenticated, isLoading, error } = useAuth0();
  const navigate = useNavigate();
  console.log("Callback component rendered", isAuthenticated, isLoading, error);

  useEffect(() => {
    if (error) {
      console.error("Auth0 callback error:", error);
      // Redirect to login on error
      navigate("/login", { replace: true });
      return;
    }

    // Once authenticated, redirect to home or dashboard
    if (!isLoading && isAuthenticated) {
      // Get returnTo from sessionStorage if available (set during login)
      const returnTo = sessionStorage.getItem("auth0:returnTo") || "/";
      sessionStorage.removeItem("auth0:returnTo");
      navigate(returnTo, { replace: true });
    }
  }, [isAuthenticated, isLoading, error, navigate]);

  // Show loading state while processing callback
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-zinc-600 dark:text-zinc-400">Completing login...</p>
      </div>
    </div>
  );
};

export default Callback;
