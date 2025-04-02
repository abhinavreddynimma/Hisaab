import { redirect } from "next/navigation";
import { SetupAdminForm } from "@/components/auth/setup-admin-form";
import { getAccessControlConfig, isSetupTokenValid } from "@/lib/auth";

interface SetupPageProps {
  params: Promise<{ token: string }>;
}

export default async function SetupPage({ params }: SetupPageProps) {
  const { token } = await params;
  const config = await getAccessControlConfig();

  if (config.sessionsEnabled) {
    redirect("/login");
  }

  const validToken = await isSetupTokenValid(token);
  if (!validToken) {
    return (
      <div className="mx-auto max-w-md py-10">
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Invalid setup link</h1>
        <p className="text-sm text-muted-foreground">
          This link is invalid or has expired. Generate a new setup link from settings.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Set up access</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Create the first admin account to enable user sessions.
      </p>
      <SetupAdminForm token={token} />
    </div>
  );
}
