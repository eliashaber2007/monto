import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Signup() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Use at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // ✅ Do NOT insert into `profiles` from the client.
    // The database trigger creates the profiles row when auth.users is created.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Store first name in Auth metadata (raw_user_meta_data)
        data: { first_name: firstName },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setLoading(false);
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      return;
    }

    setLoading(false);

    // Depending on your Supabase email confirmation setting,
    // data.user may exist but session may be null.
    toast({
      title: "Account created!",
      description: data.session
        ? "You’re signed up. You can now sign in."
        : "Check your email to verify your account, then sign in.",
    });

    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-pill">
            <span className="text-primary-foreground font-bold text-xl">M</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
          <p className="text-muted-foreground text-sm mt-1">Start saving together with Monto</p>
        </div>

        <div className="bg-card rounded-2xl shadow-card p-6 border border-border space-y-4">
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="Alex"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 rounded-xl"
              />
            </div>

            <Button type="submit" className="w-full h-11 rounded-xl mt-2" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
