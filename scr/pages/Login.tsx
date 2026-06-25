import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { login } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { TechBackground } from "@/components/TechBackground";
import { AppLogoIcon } from "@/components/AppLogo";
import { Loader2 } from "lucide-react";

export function Login() {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password) {
      showToast("Please fill in all fields", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await login(usernameOrEmail.trim(), password);
      if (res.token && res.user) {
        authLogin(res.token, res.user);
        showToast("Login successful", "success");
        const ref = searchParams.get("ref");
        if (ref) {
          navigate(`/signup?ref=${ref}`);
        } else {
          navigate("/dashboard");
        }
      } else {
        showToast(res.error || "Invalid credentials", "error");
      }
    } catch {
      showToast("Login failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <TechBackground />
      <div className="min-h-screen flex items-center justify-center p-4 relative z-[1]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <AppLogoIcon className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Login to manage your bots</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username or Email</Label>
              <Input
                id="username"
                value={usernameOrEmail}
                onChange={e => setUsernameOrEmail(e.target.value)}
                placeholder="Enter username or email"
                autoComplete="username"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Login
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
