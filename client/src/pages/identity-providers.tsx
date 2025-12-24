import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { FloatingAIAssistant } from "@/components/ai/floating-ai-assistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { authenticatedRequest } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { getRolePermissions } from "@/lib/permissions";
import { Shield, Search, Edit, Trash2, Eye, Loader2, CheckCircle, XCircle, Key, ArrowLeft, Check } from "lucide-react";

const PROVIDER_TYPE_OPTIONS = [
  // Enterprise IdPs
  "azure-ad",
  "okta",
  "google-workspace",
  "onelogin",
  "jumpcloud",
  "ping-identity",
  // Social/OAuth Providers (for Shadow IT detection)
  "google-oauth",
  "linkedin",
  "facebook",
  "twitter",
  "github",
  "zoho",
  "salesforce",
  "other"
] as const;
type ProviderType = typeof PROVIDER_TYPE_OPTIONS[number];

// Pre-configured templates for common identity providers
interface IdpTemplate {
  name: string;
  providerType: ProviderType;
  category: 'enterprise' | 'social';
  description: string;
  logoColor: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  scopes: string;
  docUrl: string;
}

const IDP_TEMPLATES: IdpTemplate[] = [
  // Enterprise IdPs
  {
    name: "Microsoft Entra ID (Azure AD)",
    providerType: "azure-ad",
    category: "enterprise",
    description: "Microsoft's cloud identity platform for enterprise SSO",
    logoColor: "#0078d4",
    authorizationUrl: "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
    userInfoUrl: "https://graph.microsoft.com/v1.0/me",
    scopes: "openid profile email User.Read Directory.Read.All",
    docUrl: "https://learn.microsoft.com/en-us/entra/identity-platform/",
  },
  {
    name: "Okta",
    providerType: "okta",
    category: "enterprise",
    description: "Leading workforce identity cloud for enterprise",
    logoColor: "#007dc1",
    authorizationUrl: "https://{domain}.okta.com/oauth2/default/v1/authorize",
    tokenUrl: "https://{domain}.okta.com/oauth2/default/v1/token",
    userInfoUrl: "https://{domain}.okta.com/oauth2/default/v1/userinfo",
    scopes: "openid profile email groups",
    docUrl: "https://developer.okta.com/docs/",
  },
  {
    name: "Google Workspace",
    providerType: "google-workspace",
    category: "enterprise",
    description: "Google's enterprise identity and access management",
    logoColor: "#4285f4",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    scopes: "openid profile email https://www.googleapis.com/auth/admin.directory.user.readonly",
    docUrl: "https://developers.google.com/identity/protocols/oauth2",
  },
  {
    name: "OneLogin",
    providerType: "onelogin",
    category: "enterprise",
    description: "Unified access management platform",
    logoColor: "#1f2937",
    scopes: "openid profile email groups",
    docUrl: "https://developers.onelogin.com/",
  },
  {
    name: "JumpCloud",
    providerType: "jumpcloud",
    category: "enterprise",
    description: "Cloud directory platform for identity management",
    logoColor: "#38b2ac",
    scopes: "openid profile email",
    docUrl: "https://jumpcloud.com/support/api",
  },
  {
    name: "Ping Identity",
    providerType: "ping-identity",
    category: "enterprise",
    description: "Enterprise identity security platform",
    logoColor: "#b21c1c",
    scopes: "openid profile email",
    docUrl: "https://docs.pingidentity.com/",
  },
  // Social OAuth Providers (Shadow IT Detection)
  {
    name: "Google OAuth",
    providerType: "google-oauth",
    category: "social",
    description: "Detect Google account logins to SaaS apps",
    logoColor: "#ea4335",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    scopes: "openid profile email",
    docUrl: "https://developers.google.com/identity/protocols/oauth2",
  },
  {
    name: "LinkedIn",
    providerType: "linkedin",
    category: "social",
    description: "Detect LinkedIn SSO usage for business apps",
    logoColor: "#0a66c2",
    authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    userInfoUrl: "https://api.linkedin.com/v2/userinfo",
    scopes: "openid profile email",
    docUrl: "https://learn.microsoft.com/en-us/linkedin/shared/authentication/",
  },
  {
    name: "Facebook",
    providerType: "facebook",
    category: "social",
    description: "Track Facebook login usage for app discovery",
    logoColor: "#1877f2",
    authorizationUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    userInfoUrl: "https://graph.facebook.com/me?fields=id,name,email",
    scopes: "email public_profile",
    docUrl: "https://developers.facebook.com/docs/facebook-login/",
  },
  {
    name: "GitHub",
    providerType: "github",
    category: "social",
    description: "Monitor GitHub authentication for developer tools",
    logoColor: "#24292e",
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    scopes: "read:user user:email",
    docUrl: "https://docs.github.com/en/developers/apps/building-oauth-apps",
  },
  {
    name: "Twitter/X",
    providerType: "twitter",
    category: "social",
    description: "Track Twitter/X OAuth usage",
    logoColor: "#1da1f2",
    scopes: "tweet.read users.read offline.access",
    docUrl: "https://developer.twitter.com/en/docs/authentication",
  },
  {
    name: "Zoho",
    providerType: "zoho",
    category: "social",
    description: "Monitor Zoho suite and third-party integrations",
    logoColor: "#d14836",
    authorizationUrl: "https://accounts.zoho.com/oauth/v2/auth",
    tokenUrl: "https://accounts.zoho.com/oauth/v2/token",
    userInfoUrl: "https://accounts.zoho.com/oauth/user/info",
    scopes: "openid profile email",
    docUrl: "https://www.zoho.com/accounts/protocol/oauth.html",
  },
  {
    name: "Salesforce",
    providerType: "salesforce",
    category: "enterprise",
    description: "Salesforce identity and connected apps",
    logoColor: "#00a1e0",
    authorizationUrl: "https://login.salesforce.com/services/oauth2/authorize",
    tokenUrl: "https://login.salesforce.com/services/oauth2/token",
    userInfoUrl: "https://login.salesforce.com/services/oauth2/userinfo",
    scopes: "openid profile email api",
    docUrl: "https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth.htm",
  },
];

const idpSchema = z.object({
  name: z.string().min(1, "Provider name is required"),
  providerType: z.enum(PROVIDER_TYPE_OPTIONS),
  tenantId: z.string().optional(),
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client secret is required"),
  redirectUri: z.string().url("Invalid redirect URI").optional().or(z.literal("")),
  scopes: z.string().optional(),
  enabled: z.boolean().default(true),
  syncInterval: z.number().min(0).optional(),
  lastSyncAt: z.string().optional(),
  metadata: z.string().optional(),
});

type IdpData = z.infer<typeof idpSchema>;

interface IdentityProvider {
  id: string;
  tenantId: string;
  name: string;
  providerType: ProviderType;
  providerTenantId?: string;
  clientId: string;
  clientSecret: string; // Will be redacted in list view
  redirectUri?: string;
  scopes?: string;
  enabled: boolean;
  syncInterval?: number;
  lastSyncAt?: string;
  metadata?: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_FORM_VALUES: IdpData = {
  name: "",
  providerType: "azure-ad",
  tenantId: "",
  clientId: "",
  clientSecret: "",
  redirectUri: "",
  scopes: "openid profile email",
  enabled: true,
  syncInterval: 3600,
  lastSyncAt: "",
  metadata: "",
};

function IdpForm({
  onSuccess,
  onCancel,
  editingIdp,
  initialValues,
}: {
  onSuccess: () => void;
  onCancel: () => void;
  editingIdp?: IdentityProvider;
  initialValues: IdpData;
}) {
  const { toast } = useToast();

  const form = useForm<IdpData>({
    resolver: zodResolver(idpSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

  const createOrUpdateIdp = useMutation({
    mutationFn: async (data: IdpData) => {
      const payload = {
        name: data.name,
        providerType: data.providerType,
        providerTenantId: data.tenantId || undefined,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        redirectUri: data.redirectUri || undefined,
        scopes: data.scopes || undefined,
        enabled: data.enabled,
        syncInterval: data.syncInterval,
        metadata: data.metadata || undefined,
      };
      const endpoint = editingIdp ? `/api/identity-providers/${editingIdp.id}` : "/api/identity-providers";
      const method = editingIdp ? "PUT" : "POST";
      const response = await apiRequest(method, endpoint, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/identity-providers"] });
      toast({
        title: editingIdp ? "Provider updated!" : "Provider created!",
        description: editingIdp
          ? "The identity provider has been updated successfully."
          : "A new identity provider has been added.",
      });
      form.reset();
      onSuccess();
    },
    onError: (error: any) => {
      console.error("IdP mutation error:", error);
      toast({
        title: "Error",
        description: error.message || `Failed to ${editingIdp ? 'update' : 'create'} identity provider.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: IdpData) => {
    createOrUpdateIdp.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provider Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Corporate Azure AD" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="providerType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provider Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PROVIDER_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="tenantId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tenant ID (for Azure AD)</FormLabel>
              <FormControl>
                <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" {...field} />
              </FormControl>
              <FormDescription>
                Azure AD tenant ID (directory ID)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client ID *</FormLabel>
                <FormControl>
                  <Input placeholder="Application (client) ID" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="clientSecret"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Secret *</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Client secret value" {...field} />
                </FormControl>
                <FormDescription>
                  Encrypted at rest with AES-256-GCM
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="redirectUri"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Redirect URI</FormLabel>
              <FormControl>
                <Input placeholder="https://yourdomain.com/auth/callback" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="scopes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>OAuth Scopes</FormLabel>
              <FormControl>
                <Input placeholder="openid profile email" {...field} />
              </FormControl>
              <FormDescription>
                Space-separated list of OAuth scopes
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="syncInterval"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sync Interval (seconds)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  placeholder="3600"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                />
              </FormControl>
              <FormDescription>
                How often to sync user data (0 = manual only)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Enable this provider</FormLabel>
                <FormDescription>
                  Disabled providers will not sync or authenticate users
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="metadata"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Metadata (JSON)</FormLabel>
              <FormControl>
                <Textarea placeholder='{"key": "value"}' {...field} />
              </FormControl>
              <FormDescription>
                Optional JSON metadata for custom configurations
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={createOrUpdateIdp.isPending}>
            {createOrUpdateIdp.isPending ? "Saving..." : editingIdp ? "Update Provider" : "Create Provider"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function IdentityProviders() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIdp, setEditingIdp] = useState<IdentityProvider | null>(null);
  const [idpFormValues, setIdpFormValues] = useState<IdpData>(DEFAULT_FORM_VALUES);
  const [showTemplates, setShowTemplates] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const permissions = getRolePermissions(user?.role);

  const isNewIdp = window.location.pathname === "/identity-providers/new";

  // Check for setup query parameter (from marketplace signup redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setupType = params.get('setup');

    if (setupType) {
      const template = IDP_TEMPLATES.find(t => t.providerType === setupType);
      if (template) {
        handleSelectTemplate(template);
        // Clear the query parameter from URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  // Fetch identity providers
  const { data: providers, isLoading } = useQuery({
    queryKey: ["/api/identity-providers"],
    queryFn: async () => {
      const response = await authenticatedRequest("GET", "/api/identity-providers");
      return response.json();
    },
  });

  // Handle template selection - pre-fill form with template values
  const handleSelectTemplate = (template: IdpTemplate) => {
    setIdpFormValues({
      ...DEFAULT_FORM_VALUES,
      name: template.name,
      providerType: template.providerType,
      scopes: template.scopes,
      metadata: JSON.stringify({
        authorizationUrl: template.authorizationUrl,
        tokenUrl: template.tokenUrl,
        userInfoUrl: template.userInfoUrl,
        docUrl: template.docUrl,
      }, null, 2),
    });
    setEditingIdp(null);
    setShowAddForm(true);
  };

  // Get configured provider types with counts
  const configuredTypeCounts = (providers || []).reduce((acc: Record<string, number>, p: IdentityProvider) => {
    acc[p.providerType] = (acc[p.providerType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const configuredTypes = new Set(Object.keys(configuredTypeCounts));

  // Show all templates (users can add multiple instances)
  const enterpriseTemplates = IDP_TEMPLATES.filter(t => t.category === 'enterprise');
  const socialTemplates = IDP_TEMPLATES.filter(t => t.category === 'social');

  const deleteIdp = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/identity-providers/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/identity-providers"] });
      toast({
        title: "Provider deleted!",
        description: "The identity provider has been removed.",
      });
    },
    onError: (error: any) => {
      console.error("IdP deletion error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete identity provider.",
        variant: "destructive",
      });
    },
  });

  const testConnection = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/identity-providers/${id}/test`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Connection test successful!",
        description: "The identity provider is configured correctly.",
      });
    },
    onError: (error: any) => {
      console.error("Connection test error:", error);
      toast({
        title: "Connection test failed",
        description: error.message || "Please check your configuration.",
        variant: "destructive",
      });
    },
  });

  const triggerSync = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/identity-providers/${id}/sync`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/identity-providers"] });
      toast({
        title: "Sync initiated!",
        description: "User data sync has been started.",
      });
    },
    onError: (error: any) => {
      console.error("Sync error:", error);
      toast({
        title: "Sync failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (isNewIdp) {
      if (user?.role === "admin" || user?.role === "super-admin") {
        setShowAddForm(true);
      } else {
        toast({
          title: "Insufficient permissions",
          description: "Only admins can manage identity providers.",
          variant: "destructive",
        });
        setLocation("/identity-providers");
      }
    }
  }, [isNewIdp, user?.role, setLocation, toast]);

  const handleAddIdp = () => {
    setEditingIdp(null);
    setIdpFormValues({ ...DEFAULT_FORM_VALUES });
    setShowAddForm(true);
    if (!isNewIdp) {
      setLocation("/identity-providers/new");
    }
  };

  const handleEditIdp = async (idp: IdentityProvider) => {
    // Fetch full details including decrypted secret (admin only)
    try {
      const response = await authenticatedRequest("GET", `/api/identity-providers/${idp.id}`);
      const fullIdp = await response.json();

      setEditingIdp(fullIdp);
      setIdpFormValues({
        name: fullIdp.name,
        providerType: fullIdp.providerType,
        tenantId: fullIdp.providerTenantId || "",
        clientId: fullIdp.clientId,
        clientSecret: fullIdp.clientSecret,
        redirectUri: fullIdp.redirectUri || "",
        scopes: fullIdp.scopes || "openid profile email",
        enabled: fullIdp.enabled,
        syncInterval: fullIdp.syncInterval,
        lastSyncAt: fullIdp.lastSyncAt || "",
        metadata: fullIdp.metadata || "",
      });
      setShowAddForm(true);
    } catch (error: any) {
      console.error("Failed to load IdP details:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load provider details.",
        variant: "destructive",
      });
    }
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingIdp(null);
    setIdpFormValues({ ...DEFAULT_FORM_VALUES });
    if (isNewIdp) {
      setLocation("/identity-providers");
    }
  };

  const filteredProviders = providers?.filter((idp: IdentityProvider) =>
    idp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    idp.providerType.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Check admin access
  if (user?.role !== "admin" && user?.role !== "super-admin") {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 md:ml-64 flex items-center justify-center p-6">
          <Card className="max-w-md text-center">
            <CardHeader>
              <CardTitle>Access Restricted</CardTitle>
              <CardDescription>Only administrators can manage identity providers.</CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  if (showAddForm) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />

        <main className="flex-1 md:ml-64 overflow-auto">
          <TopBar
            title={editingIdp ? "Edit Identity Provider" : "Add Identity Provider"}
            description={editingIdp
              ? "Update identity provider configuration"
              : "Configure a new identity provider for SSO and user sync"
            }
            showAddButton={false}
          />
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              {/* Back Button */}
              <Button
                variant="ghost"
                onClick={handleCloseForm}
                className="mb-4 gap-2 hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Identity Providers
              </Button>
              <Card>
                <CardContent className="pt-6">
                  <IdpForm
                    onSuccess={handleCloseForm}
                    onCancel={handleCloseForm}
                    editingIdp={editingIdp || undefined}
                    initialValues={idpFormValues}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background page-enter">
      <Sidebar />

      <main className="flex-1 md:ml-64 overflow-auto">
        <TopBar
          title="Identity Providers"
          description="Manage SSO and identity provider integrations"
          showAddButton={true}
          addButtonText="Add Provider"
          onAddClick={handleAddIdp}
        />
        <div className="p-6">
          {/* Search */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search providers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
            >
              {showTemplates ? 'Hide' : 'Show'} Quick Setup
            </Button>
          </div>

          {/* Available Provider Templates */}
          {showTemplates && (
            <div className="mb-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Quick Setup - Identity Providers</h3>
                <p className="text-sm text-muted-foreground">
                  Click to configure (you can add multiple instances)
                </p>
              </div>

              {/* Enterprise IdPs */}
              {enterpriseTemplates.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Enterprise Identity Providers</h4>
                  <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                    {enterpriseTemplates.map((template) => {
                      const isConfigured = configuredTypes.has(template.providerType);
                      const count = configuredTypeCounts[template.providerType] || 0;
                      return (
                        <Card
                          key={template.providerType}
                          className={`cursor-pointer hover:border-primary hover:shadow-md transition-all relative ${
                            isConfigured ? 'border-green-200 bg-green-50/30' : ''
                          }`}
                          onClick={() => handleSelectTemplate(template)}
                        >
                          {isConfigured && (
                            <div className="absolute top-2 right-2">
                              <div className="flex items-center gap-1 bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-xs font-medium">
                                <Check className="w-3 h-3" />
                                {count > 1 ? `${count} configured` : 'Configured'}
                              </div>
                            </div>
                          )}
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${template.logoColor}15` }}
                              >
                                <Shield className="w-5 h-5" style={{ color: template.logoColor }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{template.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Social OAuth Providers */}
              {socialTemplates.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Social OAuth Providers
                    <span className="ml-2 text-xs text-orange-600">(For Shadow IT Detection)</span>
                  </h4>
                  <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                    {socialTemplates.map((template) => {
                      const isConfigured = configuredTypes.has(template.providerType);
                      const count = configuredTypeCounts[template.providerType] || 0;
                      return (
                        <Card
                          key={template.providerType}
                          className={`cursor-pointer hover:border-primary hover:shadow-md transition-all relative ${
                            isConfigured ? 'border-green-200 bg-green-50/30' : ''
                          }`}
                          onClick={() => handleSelectTemplate(template)}
                        >
                          {isConfigured && (
                            <div className="absolute top-2 right-2">
                              <div className="flex items-center gap-1 bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-xs font-medium">
                                <Check className="w-3 h-3" />
                                {count > 1 ? `${count} configured` : 'Configured'}
                              </div>
                            </div>
                          )}
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${template.logoColor}15` }}
                              >
                                <Key className="w-5 h-5" style={{ color: template.logoColor }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{template.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Configured Providers */}
          {(providers?.length > 0 || !showTemplates) && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Configured Providers</h3>
            </div>
          )}

          {/* Providers Grid */}
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : filteredProviders.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No identity providers configured</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm
                    ? "No providers match your search criteria"
                    : "Add your first identity provider to enable SSO and user sync"
                  }
                </p>
                {!searchTerm && (
                  <Button onClick={handleAddIdp}>
                    Add Your First Provider
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProviders.map((idp: IdentityProvider) => (
                <Card key={idp.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Shield className="w-5 h-5 text-muted-foreground" />
                          {idp.name}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {idp.providerType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditIdp(idp)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Identity Provider</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{idp.name}"? This will disable SSO for this provider.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteIdp.mutate(idp.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={idp.enabled ? "default" : "secondary"}>
                        {idp.enabled ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Enabled
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 mr-1" />
                            Disabled
                          </>
                        )}
                      </Badge>
                    </div>

                    {idp.clientId && (
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Client ID: {idp.clientId.substring(0, 12)}...
                      </div>
                    )}

                    {idp.lastSyncAt && (
                      <div className="text-sm text-muted-foreground">
                        Last sync: {new Date(idp.lastSyncAt).toLocaleString()}
                      </div>
                    )}

                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => testConnection.mutate(idp.id)}
                        disabled={testConnection.isPending}
                      >
                        {testConnection.isPending ? "Testing..." : "Test"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => triggerSync.mutate(idp.id)}
                        disabled={triggerSync.isPending || !idp.enabled}
                      >
                        {triggerSync.isPending ? "Syncing..." : "Sync"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <FloatingAIAssistant />
    </div>
  );
}
