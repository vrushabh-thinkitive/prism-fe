import { useAuthUser } from '../hooks/useAuthUser';
import LogoutButton from './LogoutButton';

/**
 * UserProfile component that displays user information
 * Example component showing how to use the useAuthUser hook
 */
const UserProfile = () => {
  const { user, userId, email, name, picture, isLoading, error } = useAuthUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-zinc-600 dark:text-zinc-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center space-y-4">
          <div className="text-red-600 dark:text-red-400 text-xl font-semibold">
            Error loading profile
          </div>
          <p className="text-zinc-600 dark:text-zinc-400">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-8">
      <div className="max-w-2xl mx-auto px-6">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              User Profile
            </h1>
            <LogoutButton />
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
            <div className="flex items-center space-x-6 mb-6">
              {picture && (
                <img
                  src={picture}
                  alt={name || 'User'}
                  className="w-24 h-24 rounded-full border-4 border-blue-600"
                />
              )}
              <div>
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {name || 'User'}
                </h2>
                {email && (
                  <p className="text-zinc-600 dark:text-zinc-400">{email}</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* <div>
                  <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    User ID
                  </label>
                  <p className="mt-1 text-zinc-900 dark:text-zinc-100 font-mono text-sm break-all">
                    {userId || 'N/A'}
                  </p>
                </div> */}
                <div>
                  <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Email
                  </label>
                  <p className="mt-1 text-zinc-900 dark:text-zinc-100">
                    {email || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Name
                  </label>
                  <p className="mt-1 text-zinc-900 dark:text-zinc-100">
                    {name || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Email Verified
                  </label>
                  <p className="mt-1 text-zinc-900 dark:text-zinc-100">
                    {user?.email_verified ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
            </div>

            {/* Display full user object for debugging (optional) */}
            {/* {import.meta.env.DEV && (
              <details className="mt-6">
                <summary className="cursor-pointer text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300">
                  View Full User Object (Dev Only)
                </summary>
                <pre className="mt-2 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-auto text-xs">
                  {JSON.stringify(user, null, 2)}
                </pre>
              </details>
            )} */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;

