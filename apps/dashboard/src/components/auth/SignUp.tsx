import { Button } from "@keiri/ui/components/button";
import { toast } from "@keiri/ui/components/goey-toaster";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@keiri/ui/components/input-group";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { AtSignIcon, ChevronLeftIcon, KeyRoundIcon, Loader2Icon, UserIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { AuthDivider } from "@/components/auth/AuthDivider";
import { AuthShades } from "@/components/auth/AuthShades";
import { SocialLogins } from "@/components/auth/AuthSocial";
import { Logo } from "@/components/Logo";
import { signUp, useSession } from "@/lib/AuthClient";

export function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    const { error } = await signUp.email({
      email,
      password,
      name,
    });

    setIsLoading(false);
    if (error) {
      toast.error(error.message || "Failed to sign up");
    } else {
      window.location.href = redirectPath;
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center px-8">
      <AuthShades variant="flipped" />
      <Button className="absolute top-7 left-5" variant="ghost" render={<Link to="/" />} nativeButton={false}>
        <ChevronLeftIcon data-icon="inline-start" />
        Home
      </Button>

      <div className="mx-auto flex flex-col gap-y-6 sm:w-sm">
        <Logo className="h-4.5 lg:hidden mx-auto" />
        <div className="flex flex-col gap-y-1 text-center">
          <h1 className="font-semibold text-2xl tracking-wide">Create your account</h1>
          <p className="text-sm text-muted-foreground">Enter your details below to create your account</p>
        </div>

        <form className="flex flex-col gap-y-2" onSubmit={handleSignUp}>
          <InputGroup>
            <InputGroupInput
              placeholder="Name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <InputGroupAddon align="inline-start">
              <UserIcon />
            </InputGroupAddon>
          </InputGroup>

          <InputGroup>
            <InputGroupInput
              placeholder="m@example.com"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <InputGroupAddon align="inline-start">
              <AtSignIcon />
            </InputGroupAddon>
          </InputGroup>

          <div className="grid grid-cols-2 gap-2">
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
            <InputGroup>
              <InputGroupInput
                placeholder="Confirm Password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <InputGroupAddon align="inline-start">
                <KeyRoundIcon />
              </InputGroupAddon>
            </InputGroup>
          </div>

          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {isLoading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <AuthDivider>OR CONTINUE WITH</AuthDivider>

        <SocialLogins />

        <div className="flex flex-col gap-y-4 mt-8 text-center">
          <p className="text-muted-foreground text-sm">
            By signing up, you agree to our{" "}
            {/* biome-ignore lint/a11y/useValidAnchor: placeholder pending T&C content URL */}
            <a className="underline underline-offset-4 hover:text-primary" href="/terms">
              Terms
            </a>{" "}
            and {/* biome-ignore lint/a11y/useValidAnchor: placeholder pending privacy-policy content URL */}
            <a className="underline underline-offset-4 hover:text-primary" href="/privacy">
              Privacy
            </a>
            .
          </p>

          <p className="text-muted-foreground text-sm">
            Already have an account?{" "}
            <Link
              className="font-semibold text-primary underline underline-offset-4"
              to="/sign-in"
              search={{ redirect: search.redirect }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
