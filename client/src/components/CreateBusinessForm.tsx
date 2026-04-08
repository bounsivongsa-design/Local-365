import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BUSINESS_CATEGORIES } from "@shared/config/categories";
import { MEMBERSHIP_TIERS } from "@shared/config/membership";
import { useCreateBusiness } from "@/hooks/use-businesses";
import { useUpload } from "@/hooks/use-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { CardImagePicker } from "@/components/CardImagePicker";
import { Link } from "react-router-dom";
import {
  Shield,
  FileCheck,
  Scale,
  ChevronRight,
  ChevronLeft,
  Building2,
  User,
  Clock,
  Globe,
  Tags,
  Award,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Upload,
  ImageIcon,
} from "lucide-react";

interface Props {
  onSuccess: () => void;
  membershipTier?: string;
  stripeSessionId?: string;
  initialBusinessName?: string;
  initialOwnerName?: string;
  initialEmail?: string;
}

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type DayHours = {
  open: string;
  close: string;
  closed: boolean;
};

type BusinessHours = Record<string, DayHours>;

const defaultHours: BusinessHours = Object.fromEntries(
  DAYS_OF_WEEK.map((day) => [
    day,
    { open: "09:00", close: "17:00", closed: false },
  ])
);

const TIER_ID_MAP: Record<string, string> = {
  basic: "bronze",
  standard: "silver",
  premium: "gold",
};

function getCategoryLimit(tier: string): number {
  const configId = TIER_ID_MAP[tier] ?? tier;
  const tierConfig = MEMBERSHIP_TIERS.find(t => t.id === configId);
  return tierConfig?.limits.maxCategories ?? MEMBERSHIP_TIERS[0].limits.maxCategories;
}

function getTierDisplayName(tier: string): string {
  switch (tier) {
    case "basic":
      return "Bronze";
    case "standard":
      return "Silver";
    case "premium":
      return "Gold";
    default:
      return "Bronze";
  }
}

const formSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  ownerName: z.string().min(2, "Owner name is required"),
  email: z.string().email("Valid email address is required"),
  phone: z.string().min(7, "Valid phone number is required"),
  category: z.string().min(1, "Please select a primary category"),
  imageUrl: z.string().optional().default(""),
  logoUrl: z.string().optional().default(""),
  websiteUrl: z.string().optional().default(""),
  address: z.string().optional().default(""),
  establishedYear: z.string().min(1, "Established year is required").refine(
    (val) => {
      const num = parseInt(val, 10);
      return !isNaN(num) && num >= 1800 && num <= new Date().getFullYear();
    },
    { message: "Please enter a valid year (1800 or later)" }
  ),
  establishedZipCode: z.string().min(5, "Zip code is required"),
  servicesResidential: z.boolean().optional().default(false),
  servicesCommercial: z.boolean().optional().default(false),
  hasLLC: z.boolean().optional().default(false),
  hasInsurance: z.boolean().optional().default(false),
  isLicensed: z.boolean().optional().default(false),
  isVeteran: z.boolean().optional().default(false),
  searchKeywords: z.string().max(250, "Keywords must be 250 characters or less").optional().default(""),
  localOperationDescription: z.string().min(20, "Please describe how your business is independently owned and locally operated (at least 20 characters)"),
  policyAcknowledged: z.boolean().refine((val) => val === true, { message: "You must acknowledge the Local Vendor Eligibility Policy to proceed" }),
});

type FormValues = z.infer<typeof formSchema>;

const STEPS = [
  { label: "Business Info", icon: Building2 },
  { label: "Owner & Contact", icon: User },
  { label: "Hours & Location", icon: Clock },
  { label: "Categories & Tags", icon: Tags },
  { label: "Credentials", icon: Award },
];

export function CreateBusinessForm({
  onSuccess,
  membershipTier = "basic",
  stripeSessionId,
  initialBusinessName = "",
  initialOwnerName = "",
  initialEmail = "",
}: Props) {
  const createBusiness = useCreateBusiness();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [businessHours, setBusinessHours] =
    useState<BusinessHours>(defaultHours);
  const [hoursMode, setHoursMode] = useState<"specific" | "text">("specific");
  const [hoursNote, setHoursNote] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [socialMedia, setSocialMedia] = useState({
    facebook: "",
    instagram: "",
    twitter: "",
    youtube: "",
    tiktok: "",
    linkedin: "",
  });
  const [serviceTypeError, setServiceTypeError] = useState("");
  const [logoIsDragging, setLogoIsDragging] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile: uploadLogo, isUploading: isLogoUploading, progress: logoProgress } = useUpload();
  const { uploadFile: uploadVerificationDoc, isUploading: isDocUploading } = useUpload();
  const [verificationDocs, setVerificationDocs] = useState<{type: string; fileName: string; fileUrl: string}[]>([]);
  const insuranceInputRef = useRef<HTMLInputElement>(null);
  const licenseInputRef = useRef<HTMLInputElement>(null);

  const categoryLimit = getCategoryLimit(membershipTier);
  const tierConfigId = TIER_ID_MAP[membershipTier] ?? membershipTier;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    shouldUnregister: false,
    defaultValues: {
      name: initialBusinessName || "",
      description: "",
      address: "",
      category: "",
      imageUrl: "",
      hasInsurance: false,
      hasLLC: false,
      isLicensed: false,
      isVeteran: false,
      ownerName: initialOwnerName || "",
      email: initialEmail || "",
      phone: "",
      websiteUrl: "",
      establishedYear: "",
      establishedZipCode: "",
      servicesResidential: false,
      servicesCommercial: false,
      searchKeywords: "",
      logoUrl: "",
      localOperationDescription: "",
      policyAcknowledged: false,
    },
  });

  const handleLogoFile = useCallback(async (file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a JPG, PNG, or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 10MB.", variant: "destructive" });
      return;
    }
    try {
      const result = await uploadLogo(file);
      if (result) {
        form.setValue("logoUrl", result.objectPath);
        toast({ title: "Logo uploaded", description: "Your business logo has been uploaded." });
      } else {
        toast({ title: "Upload failed", description: "Could not upload logo. Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", description: "Could not upload logo. Please try again.", variant: "destructive" });
    }
    if (logoInputRef.current) logoInputRef.current.value = "";
  }, [uploadLogo, form, toast]);

  const handleVerificationDocUpload = useCallback(async (file: File, docType: string) => {
    try {
      const result = await uploadVerificationDoc(file);
      if (result) {
        setVerificationDocs(prev => [...prev, {
          type: docType,
          fileName: file.name,
          fileUrl: result.objectPath,
        }]);
        toast({ title: "Document uploaded", description: `${file.name} uploaded successfully.` });
      }
    } catch {
      toast({ title: "Upload failed", description: "Could not upload document.", variant: "destructive" });
    }
  }, [uploadVerificationDoc, toast]);

  const handleFormSubmit = () => {
    const values = form.getValues();

    if (!values.servicesResidential && !values.servicesCommercial) {
      setServiceTypeError(
        "Please select at least one service type (Residential or Commercial)"
      );
      setStep(0);
      return;
    }
    setServiceTypeError("");

    form.handleSubmit(
      (data) => {
        const socialMediaUrls = Object.fromEntries(
          Object.entries(socialMedia).filter(([, v]) => v.trim() !== "")
        );

        const { policyAcknowledged, ...restData } = data;
        const establishedYearNum = typeof restData.establishedYear === "string"
          ? parseInt(restData.establishedYear, 10)
          : restData.establishedYear;
        const submitData: any = {
          ...restData,
          establishedYear: establishedYearNum,
          imageUrl:
            restData.imageUrl ||
            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop",
          address: restData.address || `${restData.establishedZipCode}`,
          businessHours: JSON.stringify(
            hoursMode === "text"
              ? { _mode: "text", _note: hoursNote }
              : { ...businessHours, _mode: "specific" }
          ),
          socialMediaUrls:
            Object.keys(socialMediaUrls).length > 0
              ? JSON.stringify(socialMediaUrls)
              : undefined,
          additionalCategories: selectedCategories,
        };

        if (stripeSessionId) {
          submitData.stripeSessionId = stripeSessionId;
        }

        createBusiness.mutate(submitData, {
          onSuccess: async (createdBusiness: any) => {
            if (verificationDocs.length > 0 && createdBusiness?.id) {
              for (const doc of verificationDocs) {
                try {
                  await fetch(`/api/businesses/${createdBusiness.id}/verification-documents`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      documentType: doc.type,
                      fileName: doc.fileName,
                      fileUrl: doc.fileUrl,
                    }),
                  });
                } catch { /* non-blocking */ }
              }
            }
            const { queryClient } = await import("@/lib/queryClient");
            await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
            await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
            toast({
              title: "Business Created",
              description:
                "Your business has been added to the directory!",
            });
            onSuccess();
          },
          onError: (error) => {
            toast({
              title: "Error",
              description: error.message,
              variant: "destructive",
            });
          },
        });
      },
      (errors) => {
        const errorFields = Object.keys(errors);
        const step0Fields = ["name", "description", "servicesResidential", "servicesCommercial", "localOperationDescription", "policyAcknowledged"];
        const step1Fields = ["ownerName", "email", "phone"];
        const step2Fields = ["establishedYear", "establishedZipCode"];
        const step3Fields = ["category", "imageUrl"];

        const errorMessages = errorFields.map((f) => {
          const err = errors[f as keyof typeof errors];
          return err?.message || f;
        });

        let targetStep = step;
        let stepName = "";
        if (errorFields.some((f) => step0Fields.includes(f))) {
          targetStep = 0;
          stepName = "Business Info";
        } else if (errorFields.some((f) => step1Fields.includes(f))) {
          targetStep = 1;
          stepName = "Owner & Contact";
        } else if (errorFields.some((f) => step2Fields.includes(f))) {
          targetStep = 2;
          stepName = "Hours & Location";
        } else if (errorFields.some((f) => step3Fields.includes(f))) {
          targetStep = 3;
          stepName = "Categories & Tags";
        }

        setStep(targetStep);

        const description = errorMessages.length <= 3
          ? errorMessages.join(". ")
          : `Please fill in all required fields in "${stepName}" before submitting.`;

        toast({
          title: stepName ? `Missing info in "${stepName}"` : "Missing Information",
          description,
          variant: "destructive",
        });
      }
    )();
  };

  const validateStep = async (): Promise<boolean> => {
    let fieldsToValidate: (keyof FormValues)[] = [];
    switch (step) {
      case 0:
        fieldsToValidate = ["name", "description", "localOperationDescription", "policyAcknowledged"];
        if (!form.getValues("servicesResidential") && !form.getValues("servicesCommercial")) {
          setServiceTypeError("Please select at least one service type");
          return false;
        }
        setServiceTypeError("");
        break;
      case 1:
        fieldsToValidate = ["ownerName", "email", "phone"];
        break;
      case 2:
        fieldsToValidate = ["establishedYear", "establishedZipCode"];
        break;
      case 3:
        if (!form.getValues("category")) {
          form.setError("category", {
            message: "Please select a primary category",
          });
          return false;
        }
        break;
      case 4:
        break;
    }
    const result = await form.trigger(fieldsToValidate);
    return result;
  };

  const nextStep = async () => {
    const valid = await validateStep();
    if (valid && step < STEPS.length - 1) {
      setStep(step + 1);
    } else if (!valid) {
      const stepErrors = form.formState.errors;
      const errorMessages = Object.values(stepErrors)
        .map((err) => err?.message)
        .filter(Boolean);
      if (errorMessages.length > 0) {
        toast({
          title: "Please fix the following",
          description: errorMessages.slice(0, 3).join(". "),
          variant: "destructive",
        });
      }
    }
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleCategoryToggle = (categoryName: string) => {
    const primaryCat = form.getValues("category");
    if (categoryName === primaryCat) return;

    setSelectedCategories((prev) => {
      if (prev.includes(categoryName)) {
        return prev.filter((c) => c !== categoryName);
      }
      const totalSelected = 1 + prev.length;
      if (totalSelected >= categoryLimit) {
        toast({
          title: "Category Limit Reached",
          description: `${getTierDisplayName(membershipTier)} members can select up to ${categoryLimit} ${categoryLimit === 1 ? "category" : "categories"}. Upgrade your membership for more.`,
          variant: "destructive",
        });
        return prev;
      }
      return [...prev, categoryName];
    });
  };

  const handleHoursChange = (
    day: string,
    field: keyof DayHours,
    value: string | boolean
  ) => {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8" data-testid="step-indicator">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const isActive = i === step;
        const isComplete = i < step;
        return (
          <div key={s.label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isComplete
                    ? "bg-green-600 text-white"
                    : isActive
                      ? "bg-[#0a4a82] text-white ring-4 ring-[#0a4a82]/20"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span
                className={`text-xs mt-1 hidden sm:block ${
                  isActive
                    ? "text-[#0a4a82] dark:text-blue-400 font-semibold"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-8 sm:w-12 h-0.5 mx-1 ${
                  isComplete
                    ? "bg-green-600"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderStep0 = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-[#0a4a82] dark:text-blue-300">
        Business Information
      </h3>

      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Business Name <span className="text-red-500">*</span>
            </FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. Coastal Plumbing Solutions"
                {...field}
                data-testid="input-business-name"
              />
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
            <FormLabel>
              Business Description <span className="text-red-500">*</span>
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Describe your business, services, and what makes you stand out..."
                rows={4}
                {...field}
                data-testid="input-business-description"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-3 rounded-xl border border-border p-4 bg-gray-50 dark:bg-gray-900/50">
        <p className="text-sm font-semibold text-foreground">
          Service Type <span className="text-red-500">*</span>
        </p>
        <FormDescription>Select one or both</FormDescription>
        <div className="flex gap-6">
          <FormField
            control={form.control}
            name="servicesResidential"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={(v) => {
                      field.onChange(v);
                      setServiceTypeError("");
                    }}
                    data-testid="checkbox-residential"
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal cursor-pointer">
                  Residential
                </FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="servicesCommercial"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={(v) => {
                      field.onChange(v);
                      setServiceTypeError("");
                    }}
                    data-testid="checkbox-commercial"
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal cursor-pointer">
                  Commercial
                </FormLabel>
              </FormItem>
            )}
          />
        </div>
        {serviceTypeError && (
          <p className="text-sm text-red-500">{serviceTypeError}</p>
        )}
      </div>

      <div className="rounded-xl border-2 border-[#0a4a82]/30 bg-[#f0f6fc] p-5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-[#0a4a82] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-base font-bold text-[#0a4a82]" style={{ color: '#0a4a82' }}>Local Vendor Eligibility Policy</h4>
            <p className="text-sm text-gray-700 mt-1 leading-relaxed">
              Local List 365 is exclusively for <strong>independently owned and locally operated businesses</strong> serving their local community. National chains, franchises, and corporate-controlled operations are <strong>not eligible</strong>.
            </p>
            <Link
              to="/legal?section=vendor-eligibility"
              target="_blank"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#0a4a82] hover:underline mt-2"
              data-testid="link-vendor-eligibility-policy"
            >
              Read Full Eligibility Policy <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <FormField
          control={form.control}
          name="localOperationDescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold text-[#1a1a2e]">
                How is your business independently owned and locally operated? <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe how your business is independently owned and locally operated (e.g., home-based sales, personal customer relationships, locally operated without franchise agreements)."
                  rows={3}
                  {...field}
                  value={field.value || ""}
                  data-testid="input-local-operation-description"
                />
              </FormControl>
              <FormDescription className="text-xs">
                Independent consultants: describe how your business is personally run and community-focused.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="policyAcknowledged"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border border-[#0a4a82]/30 bg-white p-4 shadow-sm">
              <FormControl>
                <Checkbox
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-policy-acknowledged"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-sm font-semibold cursor-pointer text-[#1a1a2e]">
                  I acknowledge and agree to the Local Vendor Eligibility Policy <span className="text-red-500">*</span>
                </FormLabel>
                <p className="text-xs text-muted-foreground">
                  I confirm my business is independently owned, locally operated, and is not a franchise, chain, or corporate-controlled operation.
                </p>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Business Logo (Optional)</label>
        {form.watch("logoUrl") ? (
          <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-[#0a4a82]">
            <img src={form.watch("logoUrl")!} alt="Business logo" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Button type="button" variant="secondary" size="sm" className="shadow-lg text-xs px-2 py-1 h-auto" onClick={() => logoInputRef.current?.click()} disabled={isLogoUploading} data-testid="button-replace-logo">
                <Upload className="h-3 w-3 mr-1" /> Replace
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={`flex items-center gap-3 p-4 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${logoIsDragging ? "border-[#0a4a82] bg-[#0a4a82]/10" : "border-[#0a4a82]/20 bg-[#0a4a82]/5"} hover:border-[#0a4a82]/40 ${isLogoUploading ? "pointer-events-none opacity-60" : ""}`}
            onClick={() => !isLogoUploading && logoInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); setLogoIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) handleLogoFile(file); }}
            onDragOver={(e) => { e.preventDefault(); setLogoIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setLogoIsDragging(false); }}
            data-testid="dropzone-logo"
          >
            <div className="w-10 h-10 rounded-full bg-[#0a4a82]/10 flex items-center justify-center shrink-0">
              <ImageIcon className="h-5 w-5 text-[#0a4a82]" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {logoIsDragging ? "Drop your logo here" : "Drag & drop or click to upload"}
              </p>
              <p className="text-xs text-muted-foreground">JPG, PNG, or WebP · Max 10MB</p>
            </div>
          </div>
        )}
        {isLogoUploading && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Uploading...</span>
              <span className="font-medium text-[#0a4a82]">{logoProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#0a4a82] to-[#d4a373] rounded-full transition-all" style={{ width: `${logoProgress}%` }} />
            </div>
          </div>
        )}
        <input
          ref={logoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLogoFile(file); }}
          data-testid="input-logo-file"
        />
      </div>

    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-[#0a4a82] dark:text-blue-300">
        Owner & Contact Details
      </h3>

      <FormField
        control={form.control}
        name="ownerName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Business Owner's Name <span className="text-red-500">*</span>
            </FormLabel>
            <FormControl>
              <Input
                placeholder="John Smith"
                {...field}
                value={field.value || ""}
                data-testid="input-owner-name"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Email Address <span className="text-red-500">*</span>
            </FormLabel>
            <FormControl>
              <Input
                placeholder="info@yourbusiness.com"
                type="email"
                {...field}
                value={field.value || ""}
                data-testid="input-business-email"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Phone Number <span className="text-red-500">*</span>
            </FormLabel>
            <FormControl>
              <Input
                placeholder="(252) 555-0100"
                type="tel"
                {...field}
                value={field.value || ""}
                data-testid="input-phone"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="websiteUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Website URL (Optional)</FormLabel>
            <FormControl>
              <Input
                placeholder="https://www.yourbusiness.com"
                {...field}
                value={field.value || ""}
                data-testid="input-website"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-4 rounded-xl border border-border p-4 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="h-4 w-4 text-[#0a4a82]" />
          <p className="text-sm font-semibold text-foreground">
            Social Media URLs (Optional)
          </p>
        </div>
        {(
          Object.keys(socialMedia) as Array<keyof typeof socialMedia>
        ).map((platform) => (
          <div key={platform} className="space-y-1">
            <label className="text-sm text-muted-foreground capitalize">
              {platform}
            </label>
            <Input
              placeholder={`https://${platform}.com/yourbusiness`}
              value={socialMedia[platform]}
              onChange={(e) =>
                setSocialMedia((prev) => ({
                  ...prev,
                  [platform]: e.target.value,
                }))
              }
              data-testid={`input-social-${platform}`}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-[#0a4a82] dark:text-blue-300">
        Hours & Location
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="establishedYear"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Established Year <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="2015"
                  type="number"
                  min="1800"
                  max={new Date().getFullYear()}
                  {...field}
                  value={field.value || ""}
                  data-testid="input-established-year"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="establishedZipCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Business Zip Code <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="27958"
                  maxLength={10}
                  {...field}
                  value={field.value || ""}
                  data-testid="input-zip-code"
                />
              </FormControl>
              <FormDescription>
                Required for profile display
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="address"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Full Business Address (Optional for profile display)</FormLabel>
            <FormControl>
              <Input
                placeholder="123 Main St, Moyock, NC 27958"
                {...field}
                data-testid="input-address"
              />
            </FormControl>
            <FormDescription>
              Zip code is always shown; full address display is optional
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-3 rounded-xl border border-border p-4 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4 text-[#0a4a82]" />
          <p className="text-sm font-semibold text-foreground">
            Business Hours (Optional)
          </p>
        </div>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setHoursMode("specific")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${hoursMode === "specific" ? "bg-[#0a4a82] text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}
            data-testid="button-signup-hours-specific"
          >
            Set Specific Hours
          </button>
          <button
            type="button"
            onClick={() => setHoursMode("text")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${hoursMode === "text" ? "bg-[#0a4a82] text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}
            data-testid="button-signup-hours-text"
          >
            Custom Text
          </button>
        </div>
        {hoursMode === "text" ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Describe your availability in your own words (e.g., "Online 24/7", "By appointment only")</p>
            <textarea
              value={hoursNote}
              onChange={(e) => setHoursNote(e.target.value)}
              placeholder="e.g., Online 24/7, By appointment only, Seasonal hours — call for availability"
              className="w-full min-h-[80px] rounded-xl border border-gray-200 p-3 text-sm bg-white focus:ring-2 focus:ring-[#0a4a82]/30 focus:border-[#0a4a82] outline-none resize-y"
              style={{ color: '#1a1a2e', caretColor: '#1a1a2e' }}
              maxLength={200}
              data-testid="input-signup-hours-text"
            />
            <p className="text-xs text-gray-400">{hoursNote.length}/200 characters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {DAYS_OF_WEEK.map((day) => (
              <div
                key={day}
                className="flex items-center gap-3 flex-wrap sm:flex-nowrap"
              >
                <div className="w-24 text-sm font-medium text-muted-foreground">
                  {day}
                </div>
                <Checkbox
                  checked={!businessHours[day].closed}
                  onCheckedChange={(checked) =>
                    handleHoursChange(day, "closed", !checked)
                  }
                  data-testid={`checkbox-hours-${day.toLowerCase()}`}
                />
                <span className="text-xs text-muted-foreground w-10">
                  {businessHours[day].closed ? "Closed" : "Open"}
                </span>
                {!businessHours[day].closed && (
                  <>
                    <Input
                      type="time"
                      value={businessHours[day].open}
                      onChange={(e) =>
                        handleHoursChange(day, "open", e.target.value)
                      }
                      className="w-28 h-8 text-sm"
                      data-testid={`input-hours-open-${day.toLowerCase()}`}
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={businessHours[day].close}
                      onChange={(e) =>
                        handleHoursChange(day, "close", e.target.value)
                      }
                      className="w-28 h-8 text-sm"
                      data-testid={`input-hours-close-${day.toLowerCase()}`}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => {
    const primaryCategory = form.watch("category");
    const totalSelected = 1 + selectedCategories.length;

    return (
      <div className="space-y-5">
        <div className="p-4 bg-gradient-to-r from-[#0a4a82]/5 to-[#d4a373]/5 rounded-xl border border-[#0a4a82]/10">
          <p className="text-xs font-semibold text-[#0a4a82] mb-2">Categories &amp; Features by Membership Tier:</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-white rounded-lg p-2 border border-amber-200">
              <p className="font-bold text-amber-700">Bronze</p>
              <p className="text-slate-500">Up to 4 categories</p>
              <p className="text-slate-400 line-through">No logo/photos</p>
              <p className="text-slate-400 line-through">No keywords</p>
            </div>
            <div className="bg-white rounded-lg p-2 border border-slate-300">
              <p className="font-bold text-slate-600">Silver</p>
              <p className="text-slate-500">Up to 6 categories</p>
              <p className="text-slate-500">Logo + 6 photos</p>
              <p className="text-slate-400 line-through">No keywords</p>
            </div>
            <div className="bg-white rounded-lg p-2 border border-yellow-400">
              <p className="font-bold text-yellow-700">Gold</p>
              <p className="text-slate-500">Up to 8 categories</p>
              <p className="text-slate-500">Logo + 10 photos</p>
              <p className="text-green-600">Search keywords</p>
            </div>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-[#0a4a82] dark:text-blue-300">
          Categories & Search Tags
        </h3>

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Primary Category <span className="text-red-500">*</span>
              </FormLabel>
              <Select
                onValueChange={(val) => {
                  field.onChange(val);
                  setSelectedCategories((prev) =>
                    prev.filter((c) => c !== val)
                  );
                }}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger data-testid="select-primary-category">
                    <SelectValue placeholder="Select your primary category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BUSINESS_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
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
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <CardImagePicker
                  category={primaryCategory}
                  value={field.value || ""}
                  onChange={(url) => field.onChange(url)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {categoryLimit > 1 && (
          <div className="space-y-3 rounded-xl border border-border p-4 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                Additional Categories
              </p>
              <span className="text-xs bg-[#0a4a82]/10 text-[#0a4a82] dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded-full">
                {totalSelected} / {categoryLimit} selected
              </span>
            </div>
            <FormDescription>
              {getTierDisplayName(membershipTier)} members can list in up to{" "}
              {categoryLimit} categories
            </FormDescription>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
              {BUSINESS_CATEGORIES.filter(
                (cat) => cat.name !== primaryCategory
              ).map((cat) => (
                <label
                  key={cat.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                    selectedCategories.includes(cat.name)
                      ? "border-[#0a4a82] bg-[#0a4a82]/5 dark:bg-blue-900/20"
                      : "border-border hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <Checkbox
                    checked={selectedCategories.includes(cat.name)}
                    onCheckedChange={() => handleCategoryToggle(cat.name)}
                    data-testid={`checkbox-category-${cat.id}`}
                  />
                  <span className="truncate">{cat.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="relative">
          {tierConfigId !== "gold" && (
            <div className="absolute -top-1 right-0">
              <span className="text-[10px] font-bold bg-gradient-to-r from-yellow-600 to-amber-500 text-white px-2 py-0.5 rounded-full">GOLD ONLY</span>
            </div>
          )}
          <FormField
            control={form.control}
            name="searchKeywords"
            render={({ field }) => {
              const isGold = tierConfigId === "gold";
              const charCount = (field.value || "").length;
              return (
                <FormItem className={isGold ? "" : "opacity-60"}>
                  <FormLabel>
                    <div className="flex items-center gap-2">
                      <Tags className="h-4 w-4" />
                      Search Keywords / Tags
                    </div>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={isGold ? "plumber, emergency plumbing, water heater, drain cleaning" : "Available with Gold membership — upgrade after creating your listing"}
                      rows={2}
                      {...field}
                      value={field.value || ""}
                      disabled={!isGold}
                      className={isGold ? "bg-white" : ""}
                      style={isGold ? { color: "#1a1a2e", caretColor: "#1a1a2e" } : undefined}
                      data-testid="input-keywords"
                    />
                  </FormControl>
                  <FormDescription>
                    {isGold ? "Comma-separated keywords help your business appear in more searches" : "Gold members can add keywords to appear in more searches"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </div>
      </div>
    );
  };

  const renderStep4 = () => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-[#0a4a82] dark:text-blue-300">
        Business Credentials
      </h3>
      <p className="text-sm text-muted-foreground">
        These badges appear on your public profile and help build trust with
        customers.
      </p>

      <div className="space-y-4 rounded-xl border border-border p-4 bg-gray-50 dark:bg-gray-900/50">
        <FormField
          control={form.control}
          name="hasInsurance"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <FormControl>
                <Checkbox
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-has-insurance"
                />
              </FormControl>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                <div>
                  <FormLabel className="text-sm font-medium cursor-pointer">
                    Insured
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Business carries liability insurance
                  </p>
                </div>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="hasLLC"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <FormControl>
                <Checkbox
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-has-llc"
                />
              </FormControl>
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-blue-600" />
                <div>
                  <FormLabel className="text-sm font-medium cursor-pointer">
                    LLC Registered
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Business is a registered LLC
                  </p>
                </div>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isLicensed"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <FormControl>
                <Checkbox
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-is-licensed"
                />
              </FormControl>
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-purple-600" />
                <div>
                  <FormLabel className="text-sm font-medium cursor-pointer">
                    Licensed
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Holds required professional licenses
                  </p>
                </div>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isVeteran"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <FormControl>
                <Checkbox
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-is-veteran"
                />
              </FormControl>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-600" />
                <div>
                  <FormLabel className="text-sm font-medium cursor-pointer">
                    Veteran-Owned
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Veteran badge displayed on your listing
                  </p>
                </div>
              </div>
            </FormItem>
          )}
        />
      </div>

      <div className="space-y-4 rounded-xl border border-[#0a4a82]/20 p-4 bg-blue-50/50 dark:bg-blue-900/10 mt-6">
        <div className="flex items-center gap-2 mb-1">
          <Upload className="h-4 w-4 text-[#0a4a82]" />
          <p className="text-sm font-semibold text-[#0a4a82] dark:text-blue-300">
            Verification Documents (Optional)
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Upload supporting documents to speed up verification. Our admin team reviews these to confirm your credentials.
        </p>

        {form.watch("hasInsurance") && (
          <div className="space-y-2 p-3 rounded-lg bg-white dark:bg-gray-800 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Insurance Certificate (COI)</span>
              </div>
              {verificationDocs.find(d => d.type === "insurance_certificate") ? (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Uploaded
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insuranceInputRef.current?.click()}
                  disabled={isDocUploading}
                  data-testid="button-upload-insurance"
                >
                  <Upload className="h-3 w-3 mr-1" /> Upload
                </Button>
              )}
            </div>
            <input
              ref={insuranceInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleVerificationDocUpload(file, "insurance_certificate");
                e.target.value = "";
              }}
            />
            <p className="text-xs text-muted-foreground">PDF or image of your Certificate of Insurance</p>
          </div>
        )}

        {form.watch("isLicensed") && (
          <div className="space-y-2 p-3 rounded-lg bg-white dark:bg-gray-800 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Professional License</span>
              </div>
              {verificationDocs.find(d => d.type === "business_license" || d.type === "contractor_license") ? (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Uploaded
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => licenseInputRef.current?.click()}
                  disabled={isDocUploading}
                  data-testid="button-upload-license"
                >
                  <Upload className="h-3 w-3 mr-1" /> Upload
                </Button>
              )}
            </div>
            <input
              ref={licenseInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleVerificationDocUpload(file, "contractor_license");
                e.target.value = "";
              }}
            />
            <p className="text-xs text-muted-foreground">Photo or PDF of your professional or contractor license</p>
          </div>
        )}


        {!form.watch("hasInsurance") && !form.watch("isLicensed") && (
          <p className="text-xs text-muted-foreground italic text-center py-2">
            Check the credentials above to see upload options
          </p>
        )}

        {verificationDocs.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Uploaded documents:</p>
            {verificationDocs.map((doc, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                <span>{doc.fileName}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              LLC claims are automatically verified
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              If you checked "LLC Registered," we'll run an automated check against the NC Secretary of State registry to confirm your registration status.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="space-y-6"
        data-testid="create-business-form"
      >
        {renderStepIndicator()}

        <div className="min-h-[350px]">
          <div style={{ display: step === 0 ? "block" : "none" }}>{renderStep0()}</div>
          <div style={{ display: step === 1 ? "block" : "none" }}>{renderStep1()}</div>
          <div style={{ display: step === 2 ? "block" : "none" }}>{renderStep2()}</div>
          <div style={{ display: step === 3 ? "block" : "none" }}>{renderStep3()}</div>
          <div style={{ display: step === 4 ? "block" : "none" }}>{renderStep4()}</div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={step === 0}
            data-testid="button-prev-step"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>

          <span className="text-sm text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>

          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={nextStep}
              className="bg-[#0a4a82] hover:bg-[#0a4a82]/90"
              data-testid="button-next-step"
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleFormSubmit}
              disabled={createBusiness.isPending}
              className="bg-[#0a4a82] hover:bg-[#0a4a82]/90"
              data-testid="button-submit-business"
            >
              {createBusiness.isPending
                ? "Creating..."
                : "Create Business"}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
