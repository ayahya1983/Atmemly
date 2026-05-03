import { useEffect, useState } from "react";
import {
  useAdminGetSsoSettings,
  useAdminUpdateSsoSettings,
  getAdminGetSsoSettingsQueryKey,
} from "@workspace/api-client-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin";
import { Save } from "lucide-react";
import { BRAND } from "@workspace/branding";

export default function AdminSsoSettings() {
  const { data, isLoading } = useAdminGetSsoSettings();
  const updateMut = useAdminUpdateSsoSettings();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [allowLocalPassword, setAllowLocalPassword] = useState(true);
  const [defaultLoginMethod, setDefaultLoginMethod] = useState<"password" | "sso">("password");
  const [forceSsoForOrganizations, setForceSsoForOrganizations] = useState(false);

  useEffect(() => {
    if (!data) return;
    setAllowLocalPassword(data.allowLocalPassword ?? true);
    setDefaultLoginMethod((data.defaultLoginMethod as "password" | "sso") ?? "password");
    setForceSsoForOrganizations(data.forceSsoForOrganizations ?? false);
  }, [data]);

  const onSave = async () => {
    await updateMut.mutateAsync({
      data: { allowLocalPassword, defaultLoginMethod, forceSsoForOrganizations },
    });
    await qc.invalidateQueries({ queryKey: getAdminGetSsoSettingsQueryKey() });
    toast({ title: "ATMEMLY SSO settings saved" });
  };

  if (isLoading) return <p className="p-8 text-muted-foreground">Loading…</p>;

  return (
    <div className="container mx-auto py-8 max-w-2xl space-y-6">
      <PageHeader
        title="ATMEMLY SSO settings"
        description={`Global SSO behaviour for ${BRAND.name}.`}
      />
      <Card>
        <CardHeader>
          <CardTitle>Login methods</CardTitle>
          <CardDescription>
            Control whether email/password and SSO are both available across {BRAND.name}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Allow email + password login</Label>
              <p className="text-xs text-muted-foreground">
                Disable to force everyone through an SSO provider.
              </p>
            </div>
            <Switch
              checked={allowLocalPassword}
              onCheckedChange={setAllowLocalPassword}
              data-testid="switch-allow-local-password"
            />
          </div>
          <div className="space-y-2">
            <Label>Default login method shown first</Label>
            <Select
              value={defaultLoginMethod}
              onValueChange={(v) => setDefaultLoginMethod(v as "password" | "sso")}
            >
              <SelectTrigger data-testid="select-default-method"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="password">Email + password</SelectItem>
                <SelectItem value="sso">SSO providers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Force SSO for organization-managed users</Label>
              <p className="text-xs text-muted-foreground">
                Members of an organization with SSO configured cannot use a password.
              </p>
            </div>
            <Switch
              checked={forceSsoForOrganizations}
              onCheckedChange={setForceSsoForOrganizations}
              data-testid="switch-force-sso-orgs"
            />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={updateMut.isPending} data-testid="button-save-settings">
          <Save className="w-4 h-4 mr-2" />
          Save settings
        </Button>
      </div>
    </div>
  );
}
