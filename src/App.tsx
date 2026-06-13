import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DarkModeProvider } from "@/contexts/DarkModeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import CookieBanner from "@/components/CookieBanner";
import { clearPendingInvite } from "@/lib/inviteJoin";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import MyPots from "./pages/MyPots";
import PotDetail from "./pages/PotDetail";
import JoinPot from "./pages/JoinPot";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import PotArchive from "./pages/PotArchive";
import PotSuccess from "./pages/PotSuccess";
import FAQ from "./pages/FAQ";
import WithdrawalExpenses from "./pages/WithdrawalExpenses";
import Onboarding from "./pages/Onboarding";
import Verified from "./pages/Verified";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import TermsConsent from "./pages/TermsConsent";
import NotFound from "./pages/NotFound";
import SplashScreen from "./components/SplashScreen";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cached data is shown instantly on repeat visits; revalidated in background
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 10, // 10 minutes in cache
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

function RootCleaner() {
  const location = useLocation();

  useEffect(() => {
    // Nuclear clear: on every fresh page load to root URL, clear all invite tokens
    // This prevents stale invite tokens from causing auto-join loops
    if (location.pathname === '/') {
      console.log('[App] Root URL detected - nuclear clearing all invite tokens');
      clearPendingInvite();
    }
  }, [location.pathname]);

  return null;
}

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  return (
  <QueryClientProvider client={queryClient}>
    {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
    <AuthProvider>
      <DarkModeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <RootCleaner />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MyPots />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pots/:id"
              element={
                <ProtectedRoute>
                  <PotDetail />
                </ProtectedRoute>
              }
            />
            <Route path="/join/:potId" element={<JoinPot />} />
            <Route path="/invite/:potId" element={<JoinPot />} />
            <Route
              path="/pot-success"
              element={
                <ProtectedRoute>
                  <PotSuccess />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/archive"
              element={
                <ProtectedRoute>
                  <PotArchive />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/faq"
              element={
                <ProtectedRoute>
                  <FAQ />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses/:withdrawalId"
              element={
                <ProtectedRoute>
                  <WithdrawalExpenses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding"
              element={<Onboarding />}
            />
            <Route path="/verified" element={<Verified />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/terms-consent" element={<TermsConsent />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <CookieBanner />
      </TooltipProvider>
      </DarkModeProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
