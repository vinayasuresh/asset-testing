import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { FloatingAIAssistant } from "@/components/ai/floating-ai-assistant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Search,
  Filter,
  Globe,
  Building,
  Landmark,
  CreditCard,
  FileText,
  ChevronRight,
  ExternalLink
} from "lucide-react";

// Framework definitions
interface Framework {
  id: string;
  name: string;
  shortName: string;
  region: string;
  category: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  controlCount: number;
  color: string;
  regulator?: string;
}

const frameworks: Framework[] = [
  {
    id: "iso27001",
    name: "ISO 27001:2022",
    shortName: "ISO 27001",
    region: "Global",
    category: "Information Security",
    description: "International standard for information security management systems",
    icon: Shield,
    controlCount: 93,
    color: "blue",
  },
  {
    id: "soc2",
    name: "SOC 2 Type II",
    shortName: "SOC 2",
    region: "Global",
    category: "Trust Services",
    description: "Service organization controls for security, availability, and confidentiality",
    icon: CheckCircle2,
    controlCount: 64,
    color: "purple",
  },
  {
    id: "gdpr",
    name: "GDPR",
    shortName: "GDPR",
    region: "Europe",
    category: "Data Protection",
    description: "General Data Protection Regulation for EU data privacy",
    icon: Globe,
    controlCount: 45,
    color: "indigo",
  },
  {
    id: "dpdp",
    name: "DPDP Act 2023",
    shortName: "DPDP",
    region: "India",
    category: "Data Protection",
    description: "Digital Personal Data Protection Act for India",
    icon: Shield,
    controlCount: 38,
    color: "orange",
    regulator: "MeitY",
  },
  {
    id: "sebi_cscrf",
    name: "SEBI CSCRF",
    shortName: "SEBI",
    region: "India",
    category: "Financial Services",
    description: "Cyber Security and Cyber Resilience Framework for stock brokers and depositories",
    icon: Landmark,
    controlCount: 27,
    color: "green",
    regulator: "SEBI",
  },
  {
    id: "rbi_cyber",
    name: "RBI Cyber Security Framework",
    shortName: "RBI",
    region: "India",
    category: "Banking",
    description: "Cyber security framework for banks and financial institutions",
    icon: Building,
    controlCount: 32,
    color: "red",
    regulator: "RBI",
  },
  {
    id: "irdai_cyber",
    name: "IRDAI Cyber Security Guidelines",
    shortName: "IRDAI",
    region: "India",
    category: "Insurance",
    description: "Information and cyber security guidelines for insurers",
    icon: Shield,
    controlCount: 27,
    color: "teal",
    regulator: "IRDAI",
  },
  {
    id: "pci_dss",
    name: "PCI DSS v4.0",
    shortName: "PCI DSS",
    region: "Global",
    category: "Payment Security",
    description: "Payment Card Industry Data Security Standard",
    icon: CreditCard,
    controlCount: 78,
    color: "amber",
  },
  {
    id: "hipaa",
    name: "HIPAA",
    shortName: "HIPAA",
    region: "USA",
    category: "Healthcare",
    description: "Health Insurance Portability and Accountability Act",
    icon: FileText,
    controlCount: 54,
    color: "cyan",
  },
];

// Control status types
type ControlStatus = "compliant" | "non_compliant" | "partial" | "not_applicable" | "unknown";

interface Control {
  id: string;
  name: string;
  description: string;
  category: string;
  status: ControlStatus;
  evidence?: string;
  lastAssessed?: string;
}

// Mock control data for demonstration
const mockControls: Record<string, Control[]> = {
  sebi_cscrf: [
    { id: "SEBI-1.1", name: "Cyber Security Policy", description: "Establish and maintain cyber security policy", category: "Governance", status: "compliant", lastAssessed: "2024-01-15" },
    { id: "SEBI-1.2", name: "CISO Appointment", description: "Designate a Chief Information Security Officer", category: "Governance", status: "compliant", lastAssessed: "2024-01-15" },
    { id: "SEBI-2.1", name: "Asset Inventory", description: "Maintain inventory of information assets", category: "Asset Management", status: "compliant", lastAssessed: "2024-01-10" },
    { id: "SEBI-3.1", name: "Access Control", description: "Implement role-based access control", category: "Access Control", status: "partial", lastAssessed: "2024-01-12" },
    { id: "SEBI-4.1", name: "Network Security", description: "Implement network segmentation", category: "Network Security", status: "compliant", lastAssessed: "2024-01-08" },
    { id: "SEBI-5.1", name: "Incident Response", description: "Establish incident response procedures", category: "Incident Management", status: "partial", lastAssessed: "2024-01-05" },
    { id: "SEBI-6.1", name: "Data Classification", description: "Classify data based on sensitivity", category: "Data Protection", status: "non_compliant", lastAssessed: "2024-01-03" },
  ],
  rbi_cyber: [
    { id: "RBI-1.1", name: "Board Oversight", description: "Board-level oversight of cyber security", category: "Governance", status: "compliant", lastAssessed: "2024-01-15" },
    { id: "RBI-2.1", name: "SOC Operations", description: "Establish Security Operations Center", category: "Operations", status: "partial", lastAssessed: "2024-01-14" },
    { id: "RBI-3.1", name: "Vulnerability Assessment", description: "Regular vulnerability assessments", category: "Assessment", status: "compliant", lastAssessed: "2024-01-12" },
    { id: "RBI-4.1", name: "Data Localization", description: "Store critical data within India", category: "Data Protection", status: "compliant", lastAssessed: "2024-01-10" },
    { id: "RBI-5.1", name: "Third Party Risk", description: "Assess third-party vendor risks", category: "Vendor Management", status: "partial", lastAssessed: "2024-01-08" },
  ],
  irdai_cyber: [
    { id: "IRDAI-1.1", name: "Information Security Policy", description: "Documented IS policy approved by board", category: "Governance", status: "compliant", lastAssessed: "2024-01-15" },
    { id: "IRDAI-2.1", name: "Risk Assessment", description: "Annual cyber risk assessment", category: "Risk Management", status: "compliant", lastAssessed: "2024-01-14" },
    { id: "IRDAI-3.1", name: "Encryption Standards", description: "Encryption for data at rest and transit", category: "Data Protection", status: "partial", lastAssessed: "2024-01-12" },
    { id: "IRDAI-4.1", name: "Audit Trail", description: "Maintain audit trails for all transactions", category: "Audit", status: "compliant", lastAssessed: "2024-01-10" },
  ],
};

const getStatusColor = (status: ControlStatus) => {
  switch (status) {
    case "compliant": return "text-green-600 bg-green-100 dark:bg-green-900/30";
    case "non_compliant": return "text-red-600 bg-red-100 dark:bg-red-900/30";
    case "partial": return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30";
    case "not_applicable": return "text-gray-600 bg-gray-100 dark:bg-gray-900/30";
    default: return "text-gray-500 bg-gray-100 dark:bg-gray-900/30";
  }
};

const getStatusIcon = (status: ControlStatus) => {
  switch (status) {
    case "compliant": return <CheckCircle2 className="h-4 w-4" />;
    case "non_compliant": return <XCircle className="h-4 w-4" />;
    case "partial": return <AlertTriangle className="h-4 w-4" />;
    case "not_applicable": return <HelpCircle className="h-4 w-4" />;
    default: return <HelpCircle className="h-4 w-4" />;
  }
};

export default function ComplianceFrameworks() {
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Filter frameworks
  const filteredFrameworks = frameworks.filter((fw) => {
    const matchesRegion = regionFilter === "all" || fw.region === regionFilter;
    const matchesSearch = fw.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fw.shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fw.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRegion && matchesSearch;
  });

  // Get unique regions
  const regions = [...new Set(frameworks.map((fw) => fw.region))];

  // Calculate compliance stats for selected framework
  const selectedControls = selectedFramework ? mockControls[selectedFramework] || [] : [];
  const complianceStats = {
    compliant: selectedControls.filter((c) => c.status === "compliant").length,
    partial: selectedControls.filter((c) => c.status === "partial").length,
    nonCompliant: selectedControls.filter((c) => c.status === "non_compliant").length,
    unknown: selectedControls.filter((c) => c.status === "unknown" || c.status === "not_applicable").length,
  };
  const compliancePercentage = selectedControls.length > 0
    ? Math.round((complianceStats.compliant / selectedControls.length) * 100)
    : 0;

  return (
    <div className="flex h-screen bg-background page-enter">
      <Sidebar />

      <main className="flex-1 md:ml-64 overflow-auto">
        <TopBar
          title="Compliance Frameworks"
          description="Manage regulatory compliance across global and Indian frameworks"
          showAddButton={false}
        />

        <div className="p-6 space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search frameworks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {regions.map((region) => (
                  <SelectItem key={region} value={region}>{region}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Frameworks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{frameworks.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Indian Regulations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {frameworks.filter((f) => f.region === "India").length}
                </div>
                <div className="text-xs text-muted-foreground">SEBI, RBI, IRDAI, DPDP</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Global Standards</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {frameworks.filter((f) => f.region === "Global").length}
                </div>
                <div className="text-xs text-muted-foreground">ISO, SOC2, PCI DSS</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {frameworks.reduce((sum, f) => sum + f.controlCount, 0)}
                </div>
                <div className="text-xs text-muted-foreground">Across all frameworks</div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Framework List */}
            <div className="lg:col-span-1 space-y-3">
              <h3 className="font-semibold text-lg">Frameworks</h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                {filteredFrameworks.map((fw) => {
                  const Icon = fw.icon;
                  const isSelected = selectedFramework === fw.id;

                  return (
                    <Card
                      key={fw.id}
                      className={`cursor-pointer transition-all ${
                        isSelected ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/50"
                      }`}
                      onClick={() => setSelectedFramework(fw.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-${fw.color}-100 dark:bg-${fw.color}-900/30`}>
                              <Icon className={`h-5 w-5 text-${fw.color}-600`} />
                            </div>
                            <div>
                              <h4 className="font-medium">{fw.shortName}</h4>
                              <p className="text-xs text-muted-foreground">{fw.name}</p>
                            </div>
                          </div>
                          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? "rotate-90" : ""}`} />
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Badge variant="outline" className="text-xs">{fw.region}</Badge>
                          <Badge variant="secondary" className="text-xs">{fw.controlCount} controls</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Framework Details */}
            <div className="lg:col-span-2">
              {selectedFramework ? (
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>
                          {frameworks.find((f) => f.id === selectedFramework)?.name}
                        </CardTitle>
                        <CardDescription>
                          {frameworks.find((f) => f.id === selectedFramework)?.description}
                        </CardDescription>
                      </div>
                      {frameworks.find((f) => f.id === selectedFramework)?.regulator && (
                        <Badge variant="outline">
                          Regulator: {frameworks.find((f) => f.id === selectedFramework)?.regulator}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Compliance Overview */}
                    {selectedControls.length > 0 && (
                      <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium">Compliance Score</span>
                          <span className="text-2xl font-bold">{compliancePercentage}%</span>
                        </div>
                        <Progress value={compliancePercentage} className="h-2 mb-3" />
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div>
                            <div className="font-semibold text-green-600">{complianceStats.compliant}</div>
                            <div className="text-muted-foreground">Compliant</div>
                          </div>
                          <div>
                            <div className="font-semibold text-yellow-600">{complianceStats.partial}</div>
                            <div className="text-muted-foreground">Partial</div>
                          </div>
                          <div>
                            <div className="font-semibold text-red-600">{complianceStats.nonCompliant}</div>
                            <div className="text-muted-foreground">Non-Compliant</div>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-600">{complianceStats.unknown}</div>
                            <div className="text-muted-foreground">Unknown</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Controls Table */}
                    <div>
                      <h4 className="font-medium mb-3">Controls</h4>
                      {selectedControls.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[100px]">ID</TableHead>
                                <TableHead>Control</TableHead>
                                <TableHead className="w-[120px]">Category</TableHead>
                                <TableHead className="w-[120px]">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedControls.map((control) => (
                                <TableRow key={control.id}>
                                  <TableCell className="font-mono text-sm">{control.id}</TableCell>
                                  <TableCell>
                                    <div>
                                      <div className="font-medium">{control.name}</div>
                                      <div className="text-xs text-muted-foreground">{control.description}</div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">{control.category}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(control.status)}`}>
                                      {getStatusIcon(control.status)}
                                      {control.status.replace("_", " ")}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>Control assessments coming soon</p>
                          <p className="text-sm">This framework has {frameworks.find((f) => f.id === selectedFramework)?.controlCount} controls to assess</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full flex items-center justify-center">
                  <CardContent className="text-center py-12">
                    <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-medium mb-2">Select a Framework</h3>
                    <p className="text-muted-foreground">
                      Choose a compliance framework from the list to view controls and assessment status
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>

      <FloatingAIAssistant />
    </div>
  );
}
