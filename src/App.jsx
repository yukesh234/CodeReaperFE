// App.jsx
import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import RequireAuth from "./Auth/RequireAuth";
import RepoChat from "./pages/RepoChat";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Landing />} /> {/* backend failure redirect lands here */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/repos/:id" element={<RequireAuth><RepoChat /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}