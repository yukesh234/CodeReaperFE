import { Navigate } from "react-router-dom";
import Loader from "../Loader";
import { useAuth } from "./AuthContext";

export default function RequireAuth({ children }) {
  const { status } = useAuth();
  if (status === "loading") return <Loader label="Checking your session" />;
  if (status === "anon") return <Navigate to="/" replace />;
  return children;
}