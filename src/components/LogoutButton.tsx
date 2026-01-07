import { useAuthUser } from '../hooks/useAuthUser';

interface LogoutButtonProps {
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Optional children to render inside the button
   */
  children?: React.ReactNode;
}

/**
 * LogoutButton component that handles user logout
 * Provides a button to log out the current user
 */
const LogoutButton = ({ className, children }: LogoutButtonProps) => {
  const { logout, isLoading, isAuthenticated } = useAuthUser();

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = () => {
    logout();
  };

  const defaultClassName =
    'px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className={className || defaultClassName}
    >
      {children || 'Logout'}
    </button>
  );
};

export default LogoutButton;

