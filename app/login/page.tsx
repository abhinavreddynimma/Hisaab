import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getAuthContext } from "@/lib/auth";

export default async function LoginPage() {
  const auth = await getAuthContext();

  if (!auth.sessionsEnabled) {
    redirect("/dashboard");
  }
  if (auth.user) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Welcome back</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Sign in to continue.
      </p>
      <LoginForm />
    </div>
  );
}
