import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { api } from "../../lib/api";
import { apiErrorMessage } from "../../lib/utils";
import { Button, Card, CardBody, CardHeader, Field, Input, PageLoader } from "../../components/ui";
import { useAuth } from "../../lib/auth";

export function AdvSettingsPage() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const saveProfile = useMutation({
    mutationFn: async () => {
      await api.patch("/api/users/me", { name, phone: phone || null });
    },
    onSuccess: async () => {
      await refresh();
      setMsg("Profile updated.");
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const changePassword = useMutation({
    mutationFn: () => api.post("/api/auth/change-password", { currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setMsg("Password changed.");
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (!user) return <PageLoader />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Account Settings</h1>
        <p className="mt-1 text-sm text-ink-500">Manage your advertiser profile and security.</p>
      </div>

      {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Card>
        <CardHeader title="Profile" />
        <CardBody className="space-y-4">
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <div>
            <Button onClick={() => saveProfile.mutate()} loading={saveProfile.isPending}>Save profile</Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Change password" />
        <CardBody className="space-y-4">
          <Field label="Current password">
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </Field>
          <Field label="New password" hint="Minimum 8 characters">
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <Button icon={<KeyRound className="h-4 w-4" />} onClick={() => changePassword.mutate()} loading={changePassword.isPending}>Update password</Button>
        </CardBody>
      </Card>
    </div>
  );
}
