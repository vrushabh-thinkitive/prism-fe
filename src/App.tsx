import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import BrowserValidation from "./components/BrowserValidation";
import PermissionChecklist from "./components/PermissionChecklist";
import ScreenRecorder from "./components/ScreenRecorder";
import RecordingDashboard from "./pages/RecordingDashboard";
import {
  RecordingProvider,
  useRecordingState,
} from "./contexts/RecordingContext";

function Navigation() {
  const location = useLocation();
  const { recordingState } = useRecordingState();
  const isRecordingActive =
    recordingState === "recording" || recordingState === "paused";

  return (
    <nav className="w-full max-w-6xl mx-auto px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            location.pathname === "/"
              ? "bg-blue-600 text-white dark:bg-blue-500"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          🎥 Record
        </Link>
        {isRecordingActive ? (
          <span
            className="px-4 py-2 rounded-lg font-medium text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
            title="Dashboard disabled during recording"
          >
            📹 Dashboard
          </span>
        ) : (
          <Link
            to="/dashboard"
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              location.pathname === "/dashboard"
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            📹 Dashboard
          </Link>
        )}
      </div>
    </nav>
  );
}

function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-8 space-y-8">
      <BrowserValidation />
      <PermissionChecklist />
      <ScreenRecorder />
    </div>
  );
}

function App() {
  return (
    <RecordingProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-zinc-50 dark:bg-black">
          <Navigation />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<RecordingDashboard />} />
          </Routes>
        </div>
      </BrowserRouter>
    </RecordingProvider>
  );
}

export default App;
