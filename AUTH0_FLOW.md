# Auth0 Authentication Flow Documentation

This document explains the Auth0 authentication implementation in this React + TypeScript application.

## Overview

The application uses Auth0 for authentication, providing secure user login, logout, and protected routes. The implementation follows Auth0's best practices and includes proper error handling, loading states, and TypeScript types.

## Key Implementation Details

- **Auth0Provider Location:** Configured in `main.tsx` at the root level for optimal performance
- **Login Page:** Styled UI page with gradient background that displays before redirecting to Auth0
- **Navigation:** Conditionally hidden on `/login` and `/callback` pages for cleaner UX
- **Route Protection:** All main routes (including home `/`) require authentication
- **Token Storage:** Tokens cached in memory for enhanced security

## Authentication Flow

### 1. Initial Setup

- User visits the application
- `Auth0Provider` wraps the entire app in `main.tsx` and initializes Auth0 SDK
- Environment variables are loaded to configure Auth0 connection
- Navigation bar is hidden on `/login` and `/callback` pages for cleaner UI

### 2. Login Flow

1. User clicks "Login" or navigates to `/login`
2. `Login` component displays a styled login page with gradient background
3. User sees a welcome message and "Sign in" button
4. When user clicks "Sign in" button, `login()` function is called
5. User is redirected to Auth0's hosted login page
6. User enters credentials (or uses social login)
7. Auth0 authenticates the user
8. User is redirected back to `/callback` route
9. `Callback` component processes the authentication result
10. User is redirected to their original destination (or home page)

### 3. Protected Routes

- When user tries to access a protected route (e.g., `/`, `/dashboard`, `/profile`)
- `ProtectedRoute` component checks authentication status
- If not authenticated: redirects to `/login` (styled login page)
- If authenticated: renders the protected component
- Shows loading state while checking authentication
- **Note:** The home page (`/`) is now a protected route requiring authentication

### 4. API Calls

- When making authenticated API calls, `useApi` hook is used
- Hook automatically retrieves access token using `getAccessTokenSilently()`
- Token is included in `Authorization: Bearer <token>` header
- API calls fail gracefully if user is not authenticated

### 5. Logout Flow

1. User clicks "Logout" button
2. `logout()` function is called
3. Auth0 session is cleared
4. User is redirected to home page

## File Structure and Purpose

### Environment Variables (`.env`)

**Required Variables:**

- `VITE_AUTH0_DOMAIN`: Your Auth0 domain (e.g., `your-tenant.us.auth0.com`)
- `VITE_AUTH0_CLIENT_ID`: Your Auth0 application client ID
- `VITE_AUTH0_AUDIENCE`: Your API audience identifier (for API access)
- `VITE_AUTH0_SCOPE`: OAuth scopes (default: `openid profile email`)

**Setup:**

1. Copy `.env.example` to `.env`
2. Fill in your Auth0 credentials from the Auth0 Dashboard
3. Configure callback URL in Auth0 Dashboard: `http://localhost:5173/callback` (or your production URL)

### Core Files

#### `src/main.tsx`

**Purpose:** Application entry point that sets up Auth0Provider at the root level

**Key Features:**

- Wraps entire app with `Auth0Provider` for Auth0 context
- Configures Auth0 with environment variables
- Initializes Auth0 SDK before rendering the app
- Validates required environment variables on startup

**Configuration:**

- Reads Auth0 config from environment variables
- Sets up callback URL, audience, and scopes
- Uses memory cache for tokens (more secure)
- Enables refresh tokens for better UX

#### `src/App.tsx`

**Purpose:** Main application component that sets up routing and navigation

**Key Features:**

- Sets up React Router with public and protected routes
- Conditionally shows/hides navigation bar based on route
- Navigation is hidden on `/login` and `/callback` pages
- Includes navigation with auth-aware links

**Routes:**

- `/` - Protected home page (requires authentication)
- `/login` - Styled login page (public, shows UI before redirecting to Auth0)
- `/callback` - Auth0 callback handler (public, no navigation)
- `/dashboard` - Protected route (requires authentication)
- `/profile` - Protected route (requires authentication)

#### `src/hooks/useAuthUser.ts`

**Purpose:** Custom hook that wraps `useAuth0` and provides simplified interface

**Returns:**

- `user` - Full user object from Auth0
- `userId` - User's unique identifier (`user.sub`)
- `email` - User's email address
- `name` - User's display name
- `picture` - User's profile picture URL
- `isAuthenticated` - Boolean indicating if user is logged in
- `isLoading` - Boolean indicating if auth state is being checked
- `error` - Any authentication errors
- `login()` - Function to initiate login
- `logout()` - Function to log out user
- `getAccessToken()` - Function to get access token for API calls

**Usage:**

```typescript
const { user, isAuthenticated, login, logout } = useAuthUser();
```

#### `src/hooks/useApi.ts`

**Purpose:** Hook for making authenticated API calls with Bearer token

**Returns:**

- `get(url)` - Make GET request
- `post(url, data)` - Make POST request
- `put(url, data)` - Make PUT request
- `delete(url)` - Make DELETE request
- `authenticatedFetch(url, options)` - Low-level fetch with auth headers

**Usage:**

```typescript
const api = useApi();
const data = await api.get("/api/user");
await api.post("/api/data", { name: "John" });
```

**Features:**

- Automatically includes `Authorization: Bearer <token>` header
- Handles token retrieval silently
- Throws error if user is not authenticated
- Proper error handling and logging

### Components

#### `src/components/Login.tsx`

**Purpose:** Styled login page component that displays UI before redirecting to Auth0

**Features:**

- Displays a beautiful styled login page with gradient background
- Shows welcome message: "Welcome back! Please sign in to continue."
- Prominent "Sign in" button that triggers Auth0 redirect
- Footer text: "Protected by Auth0 • Secure login"
- Redirects authenticated users to home page automatically
- Responsive design with dark mode support
- Loading state on button click

**Design:**

- Gradient background (light green to light blue)
- Centered white card with rounded corners and shadow
- Clean, modern UI matching Auth0 branding
- No navigation bar on login page

**Usage:**

- Accessed via `/login` route
- User clicks "Sign in" button to initiate Auth0 login flow
- Automatically redirects if user is already authenticated

#### `src/components/LogoutButton.tsx`

**Purpose:** Reusable logout button component

**Props:**

- `className` (optional) - Custom CSS classes
- `children` (optional) - Custom button content

**Features:**

- Only renders if user is authenticated
- Handles logout with proper redirect
- Shows disabled state while loading
- Default styling with Tailwind CSS

**Usage:**

```tsx
<LogoutButton />
<LogoutButton className="custom-class">Sign Out</LogoutButton>
```

#### `src/components/ProtectedRoute.tsx`

**Purpose:** Higher-order component that protects routes requiring authentication

**Props:**

- `children` - React node to render if authenticated

**Features:**

- Checks authentication status
- Shows loading state while checking
- Redirects to `/login` if not authenticated
- Renders children if authenticated

**Usage:**

```tsx
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  }
/>
```

#### `src/components/Callback.tsx`

**Purpose:** Handles Auth0 redirect after login

**Features:**

- Processes authentication result from Auth0
- Handles errors gracefully
- Redirects to original destination or home page
- Shows loading state during processing

**Usage:**

- Configured as `/callback` route
- Must match callback URL in Auth0 Dashboard

#### `src/components/UserProfile.tsx`

**Purpose:** Example component showing user profile information

**Features:**

- Displays user information (name, email, picture, etc.)
- Shows loading and error states
- Includes logout button
- Shows full user object in development mode
- Responsive design with Tailwind CSS

**Usage:**

- Accessed via `/profile` route (protected)
- Demonstrates how to use `useAuthUser` hook

## Configuration Steps

### 1. Auth0 Dashboard Setup

1. **Create Auth0 Application:**

   - Go to Auth0 Dashboard → Applications → Create Application
   - Choose "Single Page Application"
   - Note your Domain and Client ID

2. **Configure Callback URLs:**

   - Allowed Callback URLs: `http://localhost:5173/callback, https://your-domain.com/callback`
   - Allowed Logout URLs: `http://localhost:5173, https://your-domain.com`
   - Allowed Web Origins: `http://localhost:5173, https://your-domain.com`

3. **Create API (Optional, for API access):**
   - Go to APIs → Create API
   - Set Identifier (this is your Audience)
   - Enable "Allow Offline Access" if using refresh tokens

### 2. Environment Variables Setup

Create a `.env` file in the project root:

```env
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
VITE_AUTH0_AUDIENCE=https://your-api-identifier
VITE_AUTH0_SCOPE=openid profile email
```

### 3. Install Dependencies

```bash
npm install @auth0/auth0-react
```

## Usage Examples

### Using Authentication State

```typescript
import { useAuthUser } from "./hooks/useAuthUser";
import { Navigate } from "react-router-dom";

function MyComponent() {
  const { isAuthenticated, user, login, logout } = useAuthUser();

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div>
      <p>Welcome, {user?.name}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Login Page Implementation

```typescript
import { useAuthUser } from "../hooks/useAuthUser";
import { Navigate } from "react-router-dom";

const Login = () => {
  const { login, isLoading, isAuthenticated } = useAuthUser();

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = () => {
    login(); // Redirects to Auth0 login page
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      {/* Styled login UI */}
      <button onClick={handleSignIn}>Sign in</button>
    </div>
  );
};
```

### Making Authenticated API Calls

```typescript
import { useApi } from "./hooks/useApi";
import { useEffect, useState } from "react";

function DataComponent() {
  const api = useApi();
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await api.get("/api/data");
        setData(result);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };

    fetchData();
  }, [api]);

  return <div>{/* Render data */}</div>;
}
```

### Protecting a Route

```typescript
import { Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import MyProtectedComponent from "./components/MyProtectedComponent";

<Route
  path="/protected"
  element={
    <ProtectedRoute>
      <MyProtectedComponent />
    </ProtectedRoute>
  }
/>;
```

## Security Considerations

1. **Token Storage:** Tokens are stored in memory (not localStorage) for better security
2. **HTTPS:** Always use HTTPS in production
3. **Environment Variables:** Never commit `.env` file to version control
4. **Token Refresh:** Refresh tokens are enabled for better UX
5. **Error Handling:** All components handle errors gracefully

## Troubleshooting

### Common Issues

1. **"Missing Auth0 configuration" error:**

   - Check that `.env` file exists and has correct variable names
   - Restart development server after creating/updating `.env`
   - Ensure variables start with `VITE_` prefix

2. **Redirect loop:**

   - Verify callback URL matches Auth0 Dashboard configuration
   - Check that callback route is properly configured

3. **"Invalid state" error:**

   - Clear browser cookies and localStorage
   - Ensure callback URL is correctly configured

4. **Token not available:**
   - Check that API audience is configured correctly
   - Verify API exists in Auth0 Dashboard
   - Check browser console for detailed error messages

## Architecture Notes

### Provider Hierarchy

```
main.tsx (Root)
  └── Auth0Provider (Auth0 context)
      └── App
          └── RecordingProvider (App context)
              └── BrowserRouter
                  └── AppContent
                      ├── Navigation (conditionally rendered)
                      └── Routes
```

### Navigation Visibility

- Navigation bar is **hidden** on:
  - `/login` - For cleaner login experience
  - `/callback` - During authentication processing
- Navigation bar is **shown** on:
  - All other routes (protected and public)

### Route Protection

- All main application routes are protected by default
- `/login` and `/callback` are public routes
- Unauthenticated users are redirected to `/login` (styled page)
- Authenticated users accessing `/login` are redirected to `/`

## Best Practices

1. **Always use ProtectedRoute for sensitive pages**
2. **Handle loading and error states in components**
3. **Use useApi hook for all authenticated API calls**
4. **Never store tokens manually - use Auth0 SDK methods**
5. **Test authentication flow in both development and production**
6. **Monitor Auth0 Dashboard for authentication logs**
7. **Keep Auth0Provider at root level (main.tsx) for better performance**
8. **Use styled login page for better UX instead of auto-redirect**

## Additional Resources

- [Auth0 React SDK Documentation](https://auth0.com/docs/libraries/auth0-react)
- [Auth0 Quick Start Guide](https://auth0.com/docs/quickstart/spa/react)
- [Auth0 Dashboard](https://manage.auth0.com/)
