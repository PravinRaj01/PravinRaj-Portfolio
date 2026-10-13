import React, { useState, useEffect } from 'react';
import {
  AdminUser,
  getCurrentUser,
  onAuthStateChange,
  onSessionExpired,
  startSessionKeepAlive,
} from '@/services/authService';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import AdminAuth from './AdminAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    // Set up the auth state listener FIRST (critical for catching login
    // events from other tabs -- see authService.ts's onAuthStateChange).
    const unsubscribe = onAuthStateChange((user) => {
      if (user) setSessionExpired(false); // signed in again, here or in another tab
      setUser(user);
      setLoading(false);
    });

    // THEN check for an existing session (a stored token from a prior visit).
    getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const isSignedIn = Boolean(user);

  // While signed in, renew the token in the background and listen for it
  // expiring anyway (idle for an hour, laptop asleep, 7-day cap reached).
  useEffect(() => {
    if (!isSignedIn) return;
    const stopKeepAlive = startSessionKeepAlive();
    const stopListening = onSessionExpired(() => setSessionExpired(true));
    return () => {
      stopKeepAlive();
      stopListening();
    };
  }, [isSignedIn]);

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

  return (
    <>
      {children}
      {/* A dialog, not a plain overlay: the admin's own edit forms are Radix
          dialogs, which make everything outside themselves unclickable. A
          newer dialog stacks above them and keeps its inputs usable. The
          admin tree stays mounted underneath, so unsaved edits survive. */}
      <Dialog open={sessionExpired}>
        <DialogContent
          hideCloseButton
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="z-[60] h-screen w-screen max-w-none translate-x-0 translate-y-0 left-0 top-0 rounded-none border-0 p-0"
        >
          <DialogTitle className="sr-only">Session expired</DialogTitle>
          <DialogDescription className="sr-only">
            Sign in again to keep working. Your unsaved changes are still on the page.
          </DialogDescription>
          <AdminAuth
            notice="Your session expired. Sign in again to continue; anything you had not saved is still here."
            onSuccess={() => {
              setSessionExpired(false);
              handleLoginSuccess();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProtectedRoute;
