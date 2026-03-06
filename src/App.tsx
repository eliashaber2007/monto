import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DarkModeProvider } from "@/contexts/DarkModeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <DarkModeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </DarkModeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
