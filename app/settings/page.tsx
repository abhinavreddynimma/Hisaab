import {
  getUserProfile,
  getLeavePolicy,
  getInvoiceSettings,
} from "@/actions/settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserDetailsForm } from "@/components/settings/user-details-form";
import { LeavePolicyForm } from "@/components/settings/leave-policy-form";
import { InvoiceSettingsForm } from "@/components/settings/invoice-settings-form";

export default async function SettingsPage() {
  const [userProfile, leavePolicy, invoiceSettings] = await Promise.all([
    getUserProfile(),
    getLeavePolicy(),
    getInvoiceSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile, leave policy, and invoice preferences.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="leave-policy">Leave Policy</TabsTrigger>
          <TabsTrigger value="invoice-settings">Invoice Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <UserDetailsForm initialData={userProfile} />
        </TabsContent>

        <TabsContent value="leave-policy">
          <LeavePolicyForm initialData={leavePolicy} />
        </TabsContent>

        <TabsContent value="invoice-settings">
          <InvoiceSettingsForm initialData={invoiceSettings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
