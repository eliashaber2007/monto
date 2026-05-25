import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/usePots';
import LoadingWithTimeout from '@/components/LoadingWithTimeout';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const location = useLocation();

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <LoadingWithTimeout />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const hasSeenOnboarding = (profile as any)?.has_seen_onboarding ?? false;
  const onboardingCompleted = (profile as any)?.onboarding_completed ?? false;
  const isOnboardingRoute = location.pathname === '/onboarding';

  if (!hasSeenOnboarding && !onboardingCompleted && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
