import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/usePots';
import LoadingWithTimeout from '@/components/LoadingWithTimeout';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const { data: profile, isLoading: profileLoading, refetch } = useProfile();
  const location = useLocation();
  const [hasRetried, setHasRetried] = useState(false);

  // If profile fetch returns null after loading, retry once with delay
  useEffect(() => {
    if (!profileLoading && !profile && session && !hasRetried) {
      console.warn('[ProtectedRoute] Profile is null after loading, retrying in 1s...');
      const timer = setTimeout(() => {
        refetch();
        setHasRetried(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [profileLoading, profile, session, hasRetried, refetch]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <LoadingWithTimeout />
      </div>
    );
  }

  // If still loading after retry attempt, show loading spinner
  if (!profile && !hasRetried) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <LoadingWithTimeout />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Check onboarding flags from profile DB column
  // If profile is still null after retry, default to true (assume completed) to prevent redirect loop
  const hasSeenOnboarding = profile?.has_seen_onboarding ?? (profile === null ? true : false);
  const onboardingCompleted = profile?.onboarding_completed ?? (profile === null ? true : false);
  const isOnboardingRoute = location.pathname === '/onboarding';

  // Skip onboarding if user has seen it before, regardless of completion status
  if (!hasSeenOnboarding && !onboardingCompleted && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
