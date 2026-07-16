"use client";

import { TopNav } from "@/components/layout/top-nav";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <>
      <TopNav title="Settings" subtitle="Account and system preferences" />
      <div className="p-8 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>User Profile</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Full Name</label>
              <Input defaultValue={user?.full_name} />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Email</label>
              <Input defaultValue={user?.email} disabled />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Role</label>
              <Input defaultValue={user?.role} disabled />
            </div>
            <Button onClick={() => toast.success("Profile updated")}>Save Changes</Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your login credentials</CardDescription>
          </CardHeader>
          <div className="space-y-4">
            <Input type="password" placeholder="Current password" />
            <Input type="password" placeholder="New password" />
            <Input type="password" placeholder="Confirm new password" />
            <Button variant="secondary" onClick={() => toast.success("Password updated")}>Update Password</Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
            <CardDescription>Fleet organization details</CardDescription>
          </CardHeader>
          <div className="space-y-4">
            <Input defaultValue="FleetVision Logistics Pvt. Ltd." placeholder="Company name" />
            <Input defaultValue="Chennai, Tamil Nadu" placeholder="Location" />
            <Button variant="outline" onClick={() => toast.success("Company info saved")}>Save</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
