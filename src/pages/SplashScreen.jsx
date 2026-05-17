import { useEffect } from "react";
import { useAuth } from '@/lib/AuthContext';
import { useAppData } from "@/lib/DataProvider";
import { useNavigate } from "react-router-dom";


export default function SetupPage() {
  const { user, session, isAuthenticated } = useAuth();
  const { loading } = useAppData();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) return;

    if (!loading) {
      const timer = setTimeout(() => {
        navigate("/");
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Setting up your workspace...</p>
      </div>
    </div>
  );
}
