import React, { useState, useEffect } from 'react';
import { AdminUser, getCurrentUser, onAuthStateChange } from '@/services/authService';
import AdminAuth from './AdminAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST (critical for catching login events)
    const { data: { subscription } } = onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
    });

    // THEN check for existing session
    getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle successful login - the auth state listener will update user automatically
  const handleLoginSuccess = () => {
    // Re-fetch the current user immediately after successful login
    getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AdminAuth onSuccess={handleLoginSuccess} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
