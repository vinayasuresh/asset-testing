import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { LicenseForm } from "@/components/software/license-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authenticatedRequest } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Code, Search, Plus, Key, Users, Calendar, Edit, Eye, Trash2 } from "lucide-react";
import type { SoftwareLicense, InsertSoftwareLicense } from "@shared/schema";

export default function Software() {
  const [isLicenseFormOpen, setIsLicenseFormOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<SoftwareLicense | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch software licenses
  const { data: licenses = [], isLoading } = useQuery({
    queryKey: ["/api/licenses", typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("type", typeFilter);
      
      const response = await authenticatedRequest("GET", `/api/licenses?${params}`);
      return response.json();
    },
  });

  // Create software license mutation
  const createLicenseMutation = useMutation({
    mutationFn: async (licenseData: InsertSoftwareLicense) => {
      const response = await authenticatedRequest("POST", "/api/licenses", licenseData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      setIsLicenseFormOpen(false);
      setEditingLicense(undefined);
      toast({
        title: "License created",
        description: "The software license has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create license. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddLicense = () => {
    setEditingLicense(undefined);
    setIsLicenseFormOpen(true);
  };

  const handleEditLicense = (license: SoftwareLicense) => {
    setEditingLicense(license);
    setIsLicenseFormOpen(true);
  };

  const handleLicenseSubmit = (licenseData: InsertSoftwareLicense) => {
    createLicenseMutation.mutate(licenseData);
  };

  // Filter licenses based on search term
  const filteredLicenses = licenses.filter((license: SoftwareLicense) =>
    license.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (license.vendor && license.vendor.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusColor = (usedLicenses: number, totalLicenses: number) => {
    const utilization = (usedLicenses / totalLicenses) * 100;
    if (utilization >= 90) return "destructive";
    if (utilization >= 70) return "secondary";
    return "default";
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar 
          title="Software Licenses" 
          description="Manage your software licenses and monitor usage"
          showAddButton={false}
        />
        
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-2" data-testid="page-title">
                  <Code className="h-8 w-8" />
                  Software Licenses
                </h1>
                <p className="text-muted-foreground">
                  Manage your software licenses and monitor usage
                </p>
              </div>
              <Button onClick={handleAddLicense} className="flex items-center gap-2" data-testid="button-add-license">
                <Plus className="h-4 w-4" />
                Add License
              </Button>
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search licenses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              
              <div className="flex gap-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40" data-testid="select-type-filter">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="perpetual">Perpetual</SelectItem>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="volume">Volume</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Software Licenses Grid */}
            {isLoading ? (
              <div className="text-center py-8">Loading software licenses...</div>
            ) : filteredLicenses.length === 0 ? (
              <Card className="text-center py-8">
                <CardContent className="pt-6">
                  <Code className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground">No software licenses found</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {searchTerm ? "Try adjusting your search terms" : "Get started by adding your first software license"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredLicenses.map((license: SoftwareLicense) => (
                  <Card key={license.id} className="hover:shadow-md transition-shadow" data-testid={`card-license-${license.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg" data-testid={`text-license-name-${license.id}`}>
                          {license.name}
                        </CardTitle>
                        <Badge variant={license.licenseType === "perpetual" ? "default" : "secondary"}>
                          {license.licenseType}
                        </Badge>
                      </div>
                      {license.vendor && (
                        <p className="text-sm text-muted-foreground">{license.vendor}</p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* License Usage */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            Usage
                          </span>
                          <span data-testid={`text-usage-${license.id}`}>
                            {license.usedLicenses}/{license.totalLicenses}
                          </span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              getStatusColor(license.usedLicenses, license.totalLicenses) === "destructive"
                                ? "bg-red-500"
                                : getStatusColor(license.usedLicenses, license.totalLicenses) === "secondary"
                                ? "bg-yellow-500"
                                : "bg-green-500"
                            }`}
                            style={{
                              width: `${Math.min((license.usedLicenses / license.totalLicenses) * 100, 100)}%`
                            }}
                          />
                        </div>
                      </div>

                      {/* License Key */}
                      {license.licenseKey && (
                        <div className="flex items-center gap-2 text-sm">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {license.licenseKey.replace(/(.{4})/g, '$1-').slice(0, -1)}
                          </code>
                        </div>
                      )}

                      {/* Renewal Date */}
                      {license.renewalDate && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            Renews: {new Date(license.renewalDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      {/* Cost per License */}
                      {license.costPerLicense && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Cost per license:</span>{" "}
                          <span className="font-medium">${license.costPerLicense}</span>
                        </div>
                      )}

                      <div className="flex justify-end gap-1 mt-4">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleEditLicense(license)}
                          data-testid={`button-edit-${license.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>

        <LicenseForm
          isOpen={isLicenseFormOpen}
          onClose={() => setIsLicenseFormOpen(false)}
          onSubmit={handleLicenseSubmit}
          license={editingLicense}
          isLoading={createLicenseMutation.isPending}
        />
      </div>
    </div>
  );
}