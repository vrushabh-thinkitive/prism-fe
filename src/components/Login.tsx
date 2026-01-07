import { useAuthUser } from "../hooks/useAuthUser";
import { Navigate } from "react-router-dom";

/**
 * Login component that displays a styled login page
 * Redirects to Auth0 login page when Sign in button is clicked
 */
const Login = () => {
  const { login, isLoading, isAuthenticated } = useAuthUser();

  // Redirect to home if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = () => {
    login();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Gradient background - light green to light blue */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-green-950/20 dark:via-zinc-900 dark:to-blue-950/20"></div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Login Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 md:p-10">

          {/* Welcome Message */}
          <p className="text-center text-zinc-600 dark:text-zinc-400 text-base md:text-lg mb-8">
            Welcome back! Please sign in to continue.
          </p>

          {/* Sign In Button */}
          <button
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 text-base md:text-lg shadow-md hover:shadow-lg"
          >
            {isLoading ? "Loading..." : "Sign in"}
          </button>
        </div>
      </div>

      {/* Auth0 Footer */}
      <div className="absolute bottom-8 left-0 right-0 text-center z-10">
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Protected by Auth0 • Secure login
        </p>
      </div>
    </div>
  );
};

export default Login;
