import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../Auth/AuthContext";
import Loader from "../Loader";
export default function AuthCallback() {
  const { refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    refresh().then((me) => {
      if (!cancelled) navigate(me ? "/dashboard" : "/login?error=session", { replace: true });
    });
    return () => { cancelled = true; };
  }, [refresh, navigate]);

  return <Loader label="Signing you in" />;
}