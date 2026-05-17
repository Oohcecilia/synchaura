import { useState, useEffect } from "react";
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
  }, [loading, user]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      
      <div className="text-center space-y-4">

        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />

        <h1 className="text-xl font-semibold">
          Setting up your workspace
        </h1>

        <p className="text-sm text-gray-500">
          {loading
            ? "Loading your data..."
            : "Almost ready..."}
        </p>

      </div>

    </div>
  );
}