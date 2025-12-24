import React, { useState, useEffect, useRef } from "react";
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
import { Shield, Search, Edit, Trash2, Eye, Loader2, CheckCircle, XCircle, AlertTriangle, Zap, Download, Upload, FileText, Sparkles, ArrowLeft, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const POLICY_TYPE_OPTIONS = ["approval-required", "auto-deny", "risk-threshold", "compliance-check", "spend-limit", "user-limit", "custom"] as const;
const ACTION_OPTIONS = ["notify", "block", "approve", "deny", "escalate", "custom"] as const;

// ISO 27001:2022 Policy Templates
const ISO_27001_TEMPLATES = [
  {
    id: "iso-a5-access-control",
    name: "A.5 - Information Security Policy",
    isoControl: "A.5.1",
    description: "Require approval for all new SaaS applications to ensure alignment with information security policies",
    policyType: "approval-required" as const,
    conditions: '{"approvalStatus": "pending"}',
    actions: '{"action": "notify", "recipients": ["admin", "it-manager"], "message": "New SaaS application requires security review per ISO 27001 A.5.1"}',
    priority: 90,
  },
  {
    id: "iso-a8-asset-management",
    name: "A.8 - Asset Management Policy",
    isoControl: "A.8.1",
    description: "Track and classify all SaaS applications as organizational assets with proper ownership",
    policyType: "compliance-check" as const,
    conditions: '{"$or": [{"primaryOwner": null}, {"primaryOwner": ""}, {"dataClassification": null}]}',
    actions: '{"action": "notify", "recipients": ["it-manager"], "message": "SaaS application missing asset classification or ownership per ISO 27001 A.8.1"}',
    priority: 80,
  },
  {
    id: "iso-a9-access-control",
    name: "A.9 - Access Control Policy",
    isoControl: "A.9.1",
    description: "Deny high-risk applications that lack proper access control mechanisms",
    policyType: "risk-threshold" as const,
    conditions: '{"riskScore": {"$gte": 80}, "complianceLevel": {"$ne": "compliant"}}',
    actions: '{"action": "deny", "message": "Application denied due to high risk score and non-compliance with access control requirements per ISO 27001 A.9"}',
    priority: 95,
  },
  {
    id: "iso-a12-operations",
    name: "A.12 - Operations Security Policy",
    isoControl: "A.12.1",
    description: "Monitor and alert on applications with low utilization for operational efficiency",
    policyType: "custom" as const,
    conditions: '{"monthlyActiveUsers": {"$lt": 5}, "userCount": {"$gt": 20}}',
    actions: '{"action": "notify", "recipients": ["it-manager"], "message": "Low utilization detected - review operational necessity per ISO 27001 A.12.1"}',
    priority: 60,
  },
  {
    id: "iso-a13-communications",
    name: "A.13 - Communications Security Policy",
    isoControl: "A.13.1",
    description: "Ensure all communication and collaboration tools meet encryption requirements",
    policyType: "compliance-check" as const,
    conditions: '{"category": "collaboration", "complianceLevel": {"$in": ["non-compliant", "unknown"]}}',
    actions: '{"action": "escalate", "recipients": ["admin"], "message": "Collaboration tool requires encryption compliance review per ISO 27001 A.13.1"}',
    priority: 85,
  },
  {
    id: "iso-a14-development",
    name: "A.14 - System Development Policy",
    isoControl: "A.14.2",
    description: "Security review required for development and CI/CD tools",
    policyType: "approval-required" as const,
    conditions: '{"category": "development", "approvalStatus": "pending"}',
    actions: '{"action": "notify", "recipients": ["admin", "security-team"], "message": "Development tool requires security review per ISO 27001 A.14.2"}',
    priority: 88,
  },
  {
    id: "iso-a15-supplier",
    name: "A.15 - Supplier Relationships Policy",
    isoControl: "A.15.1",
    description: "Verify vendor security practices and compliance for all SaaS providers",
    policyType: "compliance-check" as const,
    conditions: '{"vendor": {"$exists": true}, "complianceLevel": "unknown"}',
    actions: '{"action": "notify", "recipients": ["it-manager"], "message": "Vendor compliance verification required per ISO 27001 A.15.1"}',
    priority: 75,
  },
  {
    id: "iso-a18-compliance",
    name: "A.18 - Compliance Policy",
    isoControl: "A.18.1",
    description: "Block applications that handle sensitive data without proper compliance certification",
    policyType: "auto-deny" as const,
    conditions: '{"dataClassification": "confidential", "complianceLevel": "non-compliant"}',
    actions: '{"action": "block", "message": "Application blocked: handles confidential data without compliance certification per ISO 27001 A.18.1"}',
    priority: 100,
  },
  {
    id: "iso-spend-governance",
    name: "SaaS Spend Governance Policy",
    isoControl: "A.8.3",
    description: "Monitor and control SaaS spending with approval thresholds",
    policyType: "spend-limit" as const,
    conditions: '{"annualCost": {"$gte": 10000}}',
    actions: '{"action": "escalate", "recipients": ["admin", "finance"], "message": "High-value SaaS contract requires financial review per organizational policy"}',
    priority: 70,
  },
  {
    id: "iso-shadow-it",
    name: "Shadow IT Detection Policy",
    isoControl: "A.8.1",
    description: "Automatically flag and review unapproved applications discovered through IdP",
    policyType: "approval-required" as const,
    conditions: '{"discoveryMethod": "idp_sync", "approvalStatus": "pending"}',
    actions: '{"action": "notify", "recipients": ["admin", "it-manager"], "message": "Shadow IT detected via IdP - requires immediate review per ISO 27001 A.8.1"}',
    priority: 92,
  },
];

type PolicyType = typeof POLICY_TYPE_OPTIONS[number];
type ActionType = typeof ACTION_OPTIONS[number];

const policySchema = z.object({
  name: z.string().min(1, "Policy name is required"),
  description: z.string().optional(),
  policyType: z.enum(POLICY_TYPE_OPTIONS),
  enabled: z.boolean().default(true),
  conditions: z.string().min(1, "Conditions are required"),
  actions: z.string().min(1, "Actions are required"),
  priority: z.number().min(0).max(100).default(50),
  notificationEmails: z.string().optional(),
});

type PolicyData = z.infer<typeof policySchema>;

interface GovernancePolicy {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  policyType: PolicyType;
  enabled: boolean;
  conditions: string;
  actions: string;
  priority: number;
  executionCount: number;
  lastExecutedAt?: string;
  notificationEmails?: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_FORM_VALUES: PolicyData = {
  name: "",
  description: "",
  policyType: "approval-required",
  enabled: true,
  conditions: '{"riskScore": {"$gte": 70}}',
  actions: '{"action": "notify", "recipients": ["it-manager"]}',
  priority: 50,
  notificationEmails: "",
};

function PolicyForm({
  onSuccess,
  onCancel,
  editingPolicy,
  initialValues,
}: {
  onSuccess: () => void;
  onCancel: () => void;
  editingPolicy?: GovernancePolicy;
  initialValues: PolicyData;
}) {
  const { toast } = useToast();

  const form = useForm<PolicyData>({
    resolver: zodResolver(policySchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

  const createOrUpdatePolicy = useMutation({
    mutationFn: async (data: PolicyData) => {
      // Validate JSON fields
      try {
        JSON.parse(data.conditions);
        JSON.parse(data.actions);
      } catch (e) {
        throw new Error("Conditions and actions must be valid JSON");
      }

      const endpoint = editingPolicy ? `/api/governance-policies/${editingPolicy.id}` : "/api/governance-policies";
      const method = editingPolicy ? "PUT" : "POST";
      const response = await apiRequest(method, endpoint, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance-policies"] });
      toast({
        title: editingPolicy ? "Policy updated!" : "Policy created!",
        description: editingPolicy
          ? "The governance policy has been updated successfully."
          : "A new governance policy has been created.",
      });
      form.reset();
      onSuccess();
    },
    onError: (error: any) => {
      console.error("Policy mutation error:", error);
      toast({
        title: "Error",
        description: error.message || `Failed to ${editingPolicy ? 'update' : 'create'} policy.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PolicyData) => {
    createOrUpdatePolicy.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Policy Name *</FormLabel>
              <FormControl>
                <Input placeholder="e.g. High-Risk App Approval Required" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Brief description of what this policy does" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="policyType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Policy Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {POLICY_TYPE_OPTIONS.map((option) => (
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

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority (0-100)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormDescription>
                  Higher priority policies are evaluated first
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="conditions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conditions (JSON) *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='{"riskScore": {"$gte": 70}}'
                  className="font-mono text-sm"
                  rows={5}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                JSON object defining when this policy triggers. Examples:
                <br />
                <code className="text-xs">{`{"riskScore": {"$gte": 70}}`}</code> - Apps with risk score ≥ 70
                <br />
                <code className="text-xs">{`{"approvalStatus": "pending"}`}</code> - Pending apps
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="actions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Actions (JSON) *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='{"action": "notify", "recipients": ["it-manager"]}'
                  className="font-mono text-sm"
                  rows={5}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                JSON object defining what happens when policy triggers. Examples:
                <br />
                <code className="text-xs">{`{"action": "notify", "recipients": ["admin"]}`}</code>
                <br />
                <code className="text-xs">{`{"action": "block", "message": "High risk"}`}</code>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notificationEmails"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notification Emails</FormLabel>
              <FormControl>
                <Input placeholder="admin@company.com, security@company.com" {...field} />
              </FormControl>
              <FormDescription>
                Comma-separated list of email addresses to notify
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
                <FormLabel>Enable this policy</FormLabel>
                <FormDescription>
                  Disabled policies will not be evaluated or executed
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={createOrUpdatePolicy.isPending}>
            {createOrUpdatePolicy.isPending ? "Saving..." : editingPolicy ? "Update Policy" : "Create Policy"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function GovernancePolicies() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [editingPolicy, setEditingPolicy] = useState<GovernancePolicy | null>(null);
  const [policyFormValues, setPolicyFormValues] = useState<PolicyData>(DEFAULT_FORM_VALUES);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewPolicy, setViewPolicy] = useState<GovernancePolicy | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [isCreatingFromTemplates, setIsCreatingFromTemplates] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const permissions = getRolePermissions(user?.role);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNewPolicy = window.location.pathname === "/governance-policies/new";

  // Toggle template selection
  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(templateId)) {
        newSet.delete(templateId);
      } else {
        newSet.add(templateId);
      }
      return newSet;
    });
  };

  // Create policies from selected templates
  const createFromTemplates = useMutation({
    mutationFn: async (templates: typeof ISO_27001_TEMPLATES) => {
      const results = [];
      for (const template of templates) {
        const response = await apiRequest("POST", "/api/governance-policies", {
          name: template.name,
          description: template.description,
          policyType: template.policyType,
          enabled: true,
          conditions: template.conditions,
          actions: template.actions,
          priority: template.priority,
          notificationEmails: "",
        });
        results.push(await response.json());
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance-policies"] });
      toast({
        title: "Policies created!",
        description: `${results.length} ISO 27001 policies have been created.`,
      });
      setSelectedTemplates(new Set());
      setIsCreatingFromTemplates(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create policies from templates.",
        variant: "destructive",
      });
      setIsCreatingFromTemplates(false);
    },
  });

  // Handle creating selected templates
  const handleCreateSelectedTemplates = async () => {
    if (selectedTemplates.size === 0) {
      toast({
        title: "No templates selected",
        description: "Please select at least one policy template to create.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingFromTemplates(true);
    const templatesToCreate = ISO_27001_TEMPLATES.filter(t =>
      selectedTemplates.has(t.id) && !getTemplateStatus(t.name)
    );

    if (templatesToCreate.length === 0) {
      toast({
        title: "All selected policies already exist",
        description: "The selected policy templates have already been created.",
      });
      setIsCreatingFromTemplates(false);
      return;
    }

    createFromTemplates.mutate(templatesToCreate);
  };

  // Create all templates at once
  const handleCreateAllTemplates = async () => {
    setIsCreatingFromTemplates(true);
    const templatesToCreate = ISO_27001_TEMPLATES.filter(t => !getTemplateStatus(t.name));

    if (templatesToCreate.length === 0) {
      toast({
        title: "All policies already exist",
        description: "All ISO 27001 policy templates have already been created.",
      });
      setIsCreatingFromTemplates(false);
      return;
    }

    createFromTemplates.mutate(templatesToCreate);
  };

  // Export policy to PDF
  const exportPolicyToPdf = (policy: GovernancePolicy) => {
    // Create PDF content
    const pdfContent = `
GOVERNANCE POLICY DOCUMENT
==========================

Policy Name: ${policy.name}
Policy Type: ${policy.policyType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
Status: ${policy.enabled ? 'Enabled' : 'Disabled'}
Priority: ${policy.priority}

Description:
${policy.description || 'No description provided'}

Conditions (JSON):
${JSON.stringify(JSON.parse(policy.conditions), null, 2)}

Actions (JSON):
${JSON.stringify(JSON.parse(policy.actions), null, 2)}

Notification Emails:
${policy.notificationEmails || 'None configured'}

Execution Statistics:
- Total Executions: ${policy.executionCount}
- Last Executed: ${policy.lastExecutedAt ? new Date(policy.lastExecutedAt).toLocaleString() : 'Never'}

Metadata:
- Created: ${new Date(policy.createdAt).toLocaleString()}
- Last Updated: ${new Date(policy.updatedAt).toLocaleString()}
- Policy ID: ${policy.id}

---
Generated by AssetVault - ISO 27001 Compliant IT Asset Management
    `.trim();

    // Create and download file
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `policy-${policy.name.toLowerCase().replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Policy exported",
      description: "The policy has been exported. You can edit and re-upload it.",
    });
  };

  // Export all policies
  const exportAllPolicies = () => {
    if (!policies || policies.length === 0) {
      toast({
        title: "No policies to export",
        description: "Create some policies first before exporting.",
        variant: "destructive",
      });
      return;
    }

    const allPoliciesContent = policies.map((policy: GovernancePolicy) => `
POLICY: ${policy.name}
Type: ${policy.policyType}
Status: ${policy.enabled ? 'Enabled' : 'Disabled'}
Priority: ${policy.priority}
Description: ${policy.description || 'N/A'}
Conditions: ${policy.conditions}
Actions: ${policy.actions}
Emails: ${policy.notificationEmails || 'N/A'}
---`).join('\n');

    const blob = new Blob([`GOVERNANCE POLICIES EXPORT\n${'='.repeat(50)}\n\nExported: ${new Date().toLocaleString()}\nTotal Policies: ${policies.length}\n\n${allPoliciesContent}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-policies-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "All policies exported",
      description: `${policies.length} policies have been exported.`,
    });
  };

  // Handle file upload for policy import
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      // Parse the uploaded policy file (simple text format)
      // This is a basic parser - in production you might want JSON or proper PDF parsing
      const lines = text.split('\n');
      let policyData: Partial<PolicyData> = {};

      lines.forEach(line => {
        if (line.startsWith('Policy Name:')) {
          policyData.name = line.replace('Policy Name:', '').trim();
        } else if (line.startsWith('Description:')) {
          policyData.description = line.replace('Description:', '').trim();
        } else if (line.startsWith('Priority:')) {
          policyData.priority = parseInt(line.replace('Priority:', '').trim()) || 50;
        }
      });

      // Try to extract JSON conditions and actions
      const conditionsMatch = text.match(/Conditions \(JSON\):\n([\s\S]*?)(?=\n\nActions)/);
      const actionsMatch = text.match(/Actions \(JSON\):\n([\s\S]*?)(?=\n\nNotification)/);

      if (conditionsMatch) {
        policyData.conditions = conditionsMatch[1].trim();
      }
      if (actionsMatch) {
        policyData.actions = actionsMatch[1].trim();
      }

      if (policyData.name) {
        setPolicyFormValues({
          ...DEFAULT_FORM_VALUES,
          ...policyData,
          name: policyData.name + ' (Imported)',
        } as PolicyData);
        setEditingPolicy(null);
        setShowAddForm(true);

        toast({
          title: "Policy imported",
          description: "Review and save the imported policy.",
        });
      } else {
        toast({
          title: "Import failed",
          description: "Could not parse the policy file. Please check the format.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Failed to read the policy file.",
        variant: "destructive",
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Fetch policies
  const { data: policies, isLoading } = useQuery({
    queryKey: ["/api/governance-policies"],
    queryFn: async () => {
      const response = await authenticatedRequest("GET", "/api/governance-policies");
      return response.json();
    },
  });

  // Get already created policy names (must be after useQuery)
  const existingPolicyNames = new Set((policies || []).map((p: GovernancePolicy) => p.name.toLowerCase()));

  // Check which templates are already created
  const getTemplateStatus = (templateName: string) => {
    return existingPolicyNames.has(templateName.toLowerCase());
  };

  const deletePolicy = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/governance-policies/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance-policies"] });
      toast({
        title: "Policy deleted!",
        description: "The governance policy has been removed.",
      });
    },
    onError: (error: any) => {
      console.error("Policy deletion error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete policy.",
        variant: "destructive",
      });
    },
  });

  const togglePolicy = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await apiRequest("PATCH", `/api/governance-policies/${id}/toggle`, { enabled });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance-policies"] });
      toast({
        title: "Policy updated!",
        description: "The policy status has been changed.",
      });
    },
    onError: (error: any) => {
      console.error("Toggle error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to toggle policy.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (isNewPolicy) {
      if (user?.role === "admin" || user?.role === "super-admin") {
        setShowAddForm(true);
      } else {
        toast({
          title: "Insufficient permissions",
          description: "Only admins can manage governance policies.",
          variant: "destructive",
        });
        setLocation("/governance-policies");
      }
    }
  }, [isNewPolicy, user?.role, setLocation, toast]);

  const handleAddPolicy = () => {
    setEditingPolicy(null);
    setPolicyFormValues({ ...DEFAULT_FORM_VALUES });
    setShowAddForm(true);
    if (!isNewPolicy) {
      setLocation("/governance-policies/new");
    }
  };

  const handleEditPolicy = async (policy: GovernancePolicy) => {
    setEditingPolicy(policy);
    setPolicyFormValues({
      name: policy.name,
      description: policy.description || "",
      policyType: policy.policyType,
      enabled: policy.enabled,
      conditions: policy.conditions,
      actions: policy.actions,
      priority: policy.priority,
      notificationEmails: policy.notificationEmails || "",
    });
    setShowAddForm(true);
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingPolicy(null);
    setPolicyFormValues({ ...DEFAULT_FORM_VALUES });
    if (isNewPolicy) {
      setLocation("/governance-policies");
    }
  };

  const handleViewPolicy = (policy: GovernancePolicy) => {
    setViewPolicy(policy);
    setIsViewDialogOpen(true);
  };

  const closeViewDialog = () => {
    setIsViewDialogOpen(false);
    setViewPolicy(null);
  };

  const filteredPolicies = policies?.filter((policy: GovernancePolicy) =>
    policy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    policy.policyType.toLowerCase().includes(searchTerm.toLowerCase())
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
              <CardDescription>Only administrators can manage governance policies.</CardDescription>
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
            title={editingPolicy ? "Edit Governance Policy" : "Add Governance Policy"}
            description={editingPolicy
              ? "Update policy rules and actions"
              : "Create a new automation policy for SaaS governance"
            }
            showAddButton={false}
          />
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardContent className="pt-6">
                  <PolicyForm
                    onSuccess={handleCloseForm}
                    onCancel={handleCloseForm}
                    editingPolicy={editingPolicy || undefined}
                    initialValues={policyFormValues}
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
          title="Governance Policies"
          description="Automate SaaS governance with policy rules"
          showAddButton={true}
          addButtonText="Add Policy"
          onAddClick={handleAddPolicy}
        />
        <div className="p-6">
          {/* Hidden file input for import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".txt,.json"
            className="hidden"
          />

          {/* Action Buttons Row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplates(!showTemplates)}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {showTemplates ? 'Hide' : 'Show'} ISO 27001 Templates
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportAllPolicies}
                disabled={!policies || policies.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Policy
              </Button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search policies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>

          {/* ISO 27001 Templates Section */}
          {showTemplates && (
            <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">ISO 27001:2022 Policy Templates</CardTitle>
                      <CardDescription>
                        Pre-configured governance policies aligned with ISO 27001 security controls
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateSelectedTemplates}
                      disabled={selectedTemplates.size === 0 || isCreatingFromTemplates}
                    >
                      {isCreatingFromTemplates ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Selected ({selectedTemplates.size})
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateAllTemplates}
                      disabled={isCreatingFromTemplates || ISO_27001_TEMPLATES.every(t => getTemplateStatus(t.name))}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Create All Policies
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {ISO_27001_TEMPLATES.map((template) => {
                    const isCreated = getTemplateStatus(template.name);
                    const isSelected = selectedTemplates.has(template.id);

                    return (
                      <div
                        key={template.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                          isCreated
                            ? 'bg-green-50 border-green-200 opacity-75'
                            : isSelected
                            ? 'bg-primary/5 border-primary'
                            : 'hover:bg-muted/50 border-border'
                        }`}
                        onClick={() => !isCreated && toggleTemplateSelection(template.id)}
                      >
                        <div className="pt-0.5">
                          {isCreated ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <div
                              className={`h-5 w-5 rounded border-2 flex items-center justify-center ${
                                isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                              }`}
                            >
                              {isSelected && <CheckCircle className="h-4 w-4 text-white" />}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{template.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {template.isoControl}
                            </Badge>
                            {isCreated && (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                Created
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {template.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {template.policyType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Priority: {template.priority}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Policies Grid */}
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : filteredPolicies.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Zap className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No governance policies configured</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm
                    ? "No policies match your search criteria"
                    : "Create your first automation policy to enforce governance rules"
                  }
                </p>
                {!searchTerm && (
                  <Button onClick={handleAddPolicy}>
                    Add Your First Policy
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPolicies.map((policy: GovernancePolicy) => (
                <Card key={policy.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Zap className="w-5 h-5 text-muted-foreground" />
                          {policy.name}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {policy.policyType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewPolicy(policy)}
                          title="View policy details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPolicy(policy)}
                          title="Edit policy"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => exportPolicyToPdf(policy)}
                          title="Download policy"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Governance Policy</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{policy.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deletePolicy.mutate(policy.id)}
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
                      <Badge variant={policy.enabled ? "default" : "secondary"}>
                        {policy.enabled ? (
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
                      <Badge variant="outline">
                        Priority: {policy.priority}
                      </Badge>
                    </div>

                    {policy.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {policy.description}
                      </p>
                    )}

                    {policy.executionCount > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Executed {policy.executionCount} time{policy.executionCount > 1 ? 's' : ''}
                      </div>
                    )}

                    {policy.lastExecutedAt && (
                      <div className="text-xs text-muted-foreground">
                        Last executed: {new Date(policy.lastExecutedAt).toLocaleString()}
                      </div>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => togglePolicy.mutate({ id: policy.id, enabled: !policy.enabled })}
                      disabled={togglePolicy.isPending}
                    >
                      {policy.enabled ? "Disable" : "Enable"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <FloatingAIAssistant />

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={(open) => {
        if (!open) closeViewDialog();
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewPolicy?.name || "Policy Details"}</DialogTitle>
            <DialogDescription>Complete policy configuration</DialogDescription>
          </DialogHeader>
          {viewPolicy && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Policy Type</p>
                  <p className="font-medium">{viewPolicy.policyType}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Status</p>
                  <Badge variant={viewPolicy.enabled ? "default" : "secondary"}>
                    {viewPolicy.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Priority</p>
                  <p className="font-medium">{viewPolicy.priority}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Execution Count</p>
                  <p className="font-medium">{viewPolicy.executionCount}</p>
                </div>
              </div>

              {viewPolicy.description && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Description</p>
                  <p className="mt-1 text-sm text-muted-foreground">{viewPolicy.description}</p>
                </div>
              )}

              <div>
                <p className="text-xs uppercase text-muted-foreground">Conditions (JSON)</p>
                <pre className="mt-1 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                  {JSON.stringify(JSON.parse(viewPolicy.conditions), null, 2)}
                </pre>
              </div>

              <div>
                <p className="text-xs uppercase text-muted-foreground">Actions (JSON)</p>
                <pre className="mt-1 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                  {JSON.stringify(JSON.parse(viewPolicy.actions), null, 2)}
                </pre>
              </div>

              {viewPolicy.notificationEmails && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Notification Emails</p>
                  <p className="mt-1 text-sm text-muted-foreground">{viewPolicy.notificationEmails}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
