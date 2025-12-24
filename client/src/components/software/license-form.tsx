import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { authenticatedRequest } from "@/lib/auth";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { insertSoftwareLicenseSchema } from "@shared/schema";
import type { SoftwareLicense, InsertSoftwareLicense, MasterData } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const licenseFormSchema = insertSoftwareLicenseSchema.extend({
  renewalDate: z.string().optional(),
});

type LicenseFormData = z.infer<typeof licenseFormSchema>;

interface LicenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InsertSoftwareLicense) => void;
  license?: SoftwareLicense;
  isLoading?: boolean;
}

interface ComboSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  type: string;
  placeholder: string;
  label: string;
  dataTestId: string;
}

function ComboSelect({ value, onValueChange, type, placeholder, label, dataTestId }: ComboSelectProps) {
  const [open, setOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newValue, setNewValue] = useState("");
  const { toast } = useToast();

  const { data: masterData = [], isLoading, error } = useQuery<MasterData[]>({
    queryKey: ['/api/master', type],
  });

  const addMasterDataMutation = useMutation<MasterData, Error, { type: string; value: string }>({
    mutationFn: async (data: { type: string; value: string }) => {
      const response = await authenticatedRequest("POST", `/api/master`, data);
      return response.json() as Promise<MasterData>;
    },
    onSuccess: (newMasterData: MasterData) => {
      queryClient.invalidateQueries({ queryKey: ['/api/master', type] });
      onValueChange(newMasterData.value);
      setShowAddDialog(false);
      setNewValue("");
      setOpen(false);
      toast({
        title: "Added successfully",
        description: `New ${label.toLowerCase()} has been added.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || `Failed to add ${label.toLowerCase()}. You might not have permission to add new items.`,
        variant: "destructive",
      });
    },
  });

  const handleAddNew = () => {
    if (newValue.trim()) {
      addMasterDataMutation.mutate({ type, value: newValue.trim() });
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            data-testid={dataTestId}
          >
            {value ? value : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
            <CommandEmpty>
              <div className="p-2">
                <p>No {label.toLowerCase()} found.</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setShowAddDialog(true)}
                  data-testid={`button-add-new-${type}`}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add new {label.toLowerCase()}
                </Button>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {masterData.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.value}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                  data-testid={`option-${type}-${item.id}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {item.value}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New {label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-value">New {label}</Label>
              <Input
                id="new-value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={`Enter new ${label.toLowerCase()}`}
                data-testid={`input-new-${type}`}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false);
                  setNewValue("");
                }}
                data-testid={`button-cancel-${type}`}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddNew}
                disabled={!newValue.trim() || addMasterDataMutation.isPending}
                data-testid={`button-save-${type}`}
              >
                {addMasterDataMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function LicenseForm({ isOpen, onClose, onSubmit, license, isLoading }: LicenseFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<LicenseFormData>({
    resolver: zodResolver(licenseFormSchema),
    defaultValues: license ? {
      name: license.name,
      vendor: license.vendor || "",
      version: license.version || "",
      licenseKey: license.licenseKey || "",
      licenseType: license.licenseType || "",
      totalLicenses: license.totalLicenses,
      usedLicenses: license.usedLicenses,
      costPerLicense: license.costPerLicense?.toString() || "",
      renewalDate: license.renewalDate ? new Date(license.renewalDate).toISOString().split('T')[0] : "",
      notes: license.notes || "",
    } : {
      totalLicenses: 1,
      usedLicenses: 0,
      costPerLicense: "",
    },
  });

  const handleFormSubmit = (data: LicenseFormData) => {
    const submitData: InsertSoftwareLicense = {
      ...data,
      renewalDate: data.renewalDate ? new Date(data.renewalDate) : undefined,
      costPerLicense: data.costPerLicense ? parseFloat(data.costPerLicense) : undefined,
      tenantId: "", // Will be set by the API
    };
    onSubmit(submitData);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{license ? "Edit Software License" : "Add New Software License"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <Label htmlFor="name">Software Name *</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="e.g., Adobe Creative Suite"
                data-testid="input-license-name"
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="vendor">Vendor</Label>
              <ComboSelect
                value={watch("vendor") || ""}
                onValueChange={(value) => setValue("vendor", value)}
                type="vendor"
                placeholder="Select vendor"
                label="Vendor"
                dataTestId="select-vendor"
              />
            </div>
            
            <div>
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                {...register("version")}
                placeholder="e.g., 2024, v1.0"
                data-testid="input-version"
              />
            </div>
            
            <div>
              <Label htmlFor="licenseType">License Type</Label>
              <Select value={watch("licenseType") || ""} onValueChange={(value) => setValue("licenseType", value)}>
                <SelectTrigger data-testid="select-license-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="perpetual">Perpetual</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                  <SelectItem value="volume">Volume</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="licenseKey">License Key</Label>
              <Input
                id="licenseKey"
                {...register("licenseKey")}
                placeholder="e.g., XXXX-XXXX-XXXX"
                data-testid="input-license-key"
              />
            </div>
            
            <div>
              <Label htmlFor="totalLicenses">Total Licenses *</Label>
              <Input
                id="totalLicenses"
                type="number"
                min="1"
                {...register("totalLicenses", { valueAsNumber: true })}
                data-testid="input-total-licenses"
              />
              {errors.totalLicenses && (
                <p className="text-red-500 text-sm mt-1">{errors.totalLicenses.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="usedLicenses">Used Licenses *</Label>
              <Input
                id="usedLicenses"
                type="number"
                min="0"
                {...register("usedLicenses", { valueAsNumber: true })}
                data-testid="input-used-licenses"
              />
              {errors.usedLicenses && (
                <p className="text-red-500 text-sm mt-1">{errors.usedLicenses.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="costPerLicense">Cost per License ($)</Label>
              <Input
                id="costPerLicense"
                type="number"
                step="0.01"
                min="0"
                {...register("costPerLicense")}
                placeholder="0.00"
                data-testid="input-cost-per-license"
              />
            </div>
            
            <div>
              <Label htmlFor="renewalDate">Renewal Date</Label>
              <Input
                id="renewalDate"
                type="date"
                {...register("renewalDate")}
                data-testid="input-renewal-date"
              />
            </div>
            
            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register("notes")}
                placeholder="Additional information about this license..."
                className="min-h-[80px]"
                data-testid="textarea-notes"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              data-testid="button-submit-license"
            >
              {isLoading ? "Saving..." : license ? "Update License" : "Create License"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}