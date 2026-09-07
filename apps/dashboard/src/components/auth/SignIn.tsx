import { Button } from "@keiri/ui/components/button";
import { toast } from "@keiri/ui/components/goey-toaster";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@keiri/ui/components/input-group";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { AtSignIcon, ChevronLeftIcon, KeyRoundIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { AuthDivider } from "@/components/auth/AuthDivider";
import { AuthShades } from "@/components/auth/AuthShades";
import { SocialLogins } from "@/components/auth/AuthSocial";
import { Logo } from "@/components/Logo";
import { signIn, useSession } from "@/lib/AuthClient";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const redirectPath = search.redirect || "/";
  const { data: session, isPending: isSessionPending } = useSession();
  const [_isTransitionPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isSessionPending && session) {
      startTransition(() => {
        void navigate({ to: redirectPath });
      });
    }
  }, [session, isSessionPending, navigate, redirectPath]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn.email({
      email,
      password,
    });

    setIsLoading(false);
    if (error) {
      toast.error(error.message || "Failed to sign in");
    } else {
      window.location.href = redirectPath;
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center px-8">
      <AuthShades />
      <Button className="absolute top-7 left-5" variant="ghost" render={<Link to="/" />} nativeButton={false}>
        <ChevronLeftIcon data-icon="inline-start" />
        Home
      </Button>

      <div className="mx-auto flex flex-col gap-y-6 sm:w-sm">
        <Logo className="h-4.5 lg:hidden mx-auto" />
        <div className="flex flex-col gap-y-1 text-center">
          <h1 className="font-semibold text-2xl tracking-wide">Sign In or Join Now!</h1>
          <p className="text-base text-muted-foreground">login or create your keiri account.</p>
        </div>

        <SocialLogins />

        <AuthDivider>OR</AuthDivider>

        <form className="flex flex-col gap-y-2 text-center" onSubmit={handleSignIn}>
          <p className="text-muted-foreground text-xs">Enter your credentials to sign in</p>
          <InputGroup>
            <InputGroupInput
              placeholder="your.email@example.com"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <InputGroupAddon align="inline-start">
              <AtSignIcon />
            </InputGroupAddon>
          </InputGroup>

          <InputGroup>
            <InputGroupInput
              placeholder="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <InputGroupAddon align="inline-start">
              <KeyRoundIcon />
            </InputGroupAddon>
          </InputGroup>

          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {isLoading ? "Signing in..." : "Continue With Email"}
          </Button>
        </form>

        <div className="flex flex-col gap-y-4 mt-8 text-center">
          <p className="text-muted-foreground text-sm">
            By clicking continue, you agree to our{" "}
            {/* biome-ignore lint/a11y/useValidAnchor: placeholder pending T&C content URL */}
            <a className="underline underline-offset-4 hover:text-primary" href="/terms">
              Terms of Service
            </a>{" "}
            and {/* biome-ignore lint/a11y/useValidAnchor: placeholder pending privacy-policy content URL */}
            <a className="underline underline-offset-4 hover:text-primary" href="/privacy">
              Privacy Policy
            </a>
            .
          </p>

          <p className="text-muted-foreground text-sm">
            New here?{" "}
            <Link
              className="font-semibold text-primary underline underline-offset-4"
              to="/sign-up"
              search={{ redirect: search.redirect }}
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
