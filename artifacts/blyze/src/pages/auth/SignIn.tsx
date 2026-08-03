import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { getApiUrl } from "@/lib/api";

export default function SignInPage() {
  const [, setLocation] = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(getApiUrl("/api/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Login failed at:", getApiUrl("/api/login"), "Status:", res.status, "Data:", data);
        throw new Error(data.error || "Login failed");
      }

      setAuth(data.token, data.user);
      toast.success("Welcome back!");
      setLocation("/live");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center py-12 px-4 relative z-10">
        <div className="w-full max-w-md space-y-8 bg-[#0f0f12] p-8 border border-white/10 rounded-2xl shadow-2xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold font-display text-white">Welcome Back</h2>
            <p className="mt-2 text-muted-foreground">Sign in to your Kryv account</p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">Username or Email</Label>
                <Input
                  id="identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="bg-black/20 border-white/10 text-white focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Enter your username or email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-black/20 border-white/10 text-white focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-6 rounded-xl transition-all shadow-[0_0_20px_rgba(0,255,255,0.2)]"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/sign-up" className="text-primary hover:text-primary/80 font-medium">
                Sign up
              </Link>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
