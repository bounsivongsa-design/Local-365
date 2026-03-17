import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertBusinessSchema } from "@shared/schema";
import { BUSINESS_CATEGORIES } from "@shared/config/categories";
import { useCreateBusiness } from "@/hooks/use-businesses";
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
} from "lucide-react";

interface Props {
  onSuccess: () => void;
  membershipTier?: string;
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

function getCategoryLimit(tier: string): number {
  switch (tier) {
    case "basic":
      return 1;
    case "standard":
      return 3;
    case "premium":
      return 5;
    default:
      return 1;
  }
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

const formSchema = insertBusinessSchema.extend({
  name: z.string().min(2, "Business name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  ownerName: z.string().min(2, "Owner name is required"),
  email: z.string().email("Valid email address is required"),
  phone: z.string().min(7, "Valid phone number is required"),
  category: z.string().min(1, "Please select a primary category"),
  establishedYear: z.coerce
    .number({ invalid_type_error: "Established year is required" })
    .min(1800, "Please enter a valid year")
    .max(new Date().getFullYear(), "Year cannot be in the future"),
  establishedZipCode: z.string().min(5, "Zip code is required"),
  servicesResidential: z.boolean().optional(),
  servicesCommercial: z.boolean().optional(),
  searchKeywords: z
    .string()
    .max(250, "Keywords must be 250 characters or less")
    .optional(),
  localOperationDescription: z.string().min(20, "Please describe how your business is independently owned and locally operated (at least 20 characters)"),
  policyAcknowledged: z.literal(true, { errorMap: () => ({ message: "You must acknowledge the Local Vendor Eligibility Policy to proceed" }) }),
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
}: Props) {
  const createBusiness = useCreateBusiness();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [businessHours, setBusinessHours] =
    useState<BusinessHours>(defaultHours);
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

  const categoryLimit = getCategoryLimit(membershipTier);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      address: "",
      category: "",
      imageUrl: "",
      hasInsurance: false,
      hasLLC: false,
      isLicensed: false,
      isVeteran: false,
      ownerName: "",
      email: "",
      phone: "",
      websiteUrl: "",
      establishedYear: "",
      establishedZipCode: "",
      servicesResidential: false,
      servicesCommercial: false,
      searchKeywords: "",
      logoUrl: "",
      localOperationDescription: "",
      policyAcknowledged: false as any,
    },
  });

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
        const submitData = {
          ...restData,
          imageUrl:
            restData.imageUrl ||
            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop",
          address: restData.address || `${restData.establishedZipCode}`,
          businessHours: JSON.stringify(businessHours),
          socialMediaUrls:
            Object.keys(socialMediaUrls).length > 0
              ? JSON.stringify(socialMediaUrls)
              : undefined,
          additionalCategories: selectedCategories,
        };

        createBusiness.mutate(submitData, {
          onSuccess: () => {
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
        const step3Fields = ["category"];

        if (errorFields.some((f) => step0Fields.includes(f))) {
          setStep(0);
        } else if (errorFields.some((f) => step1Fields.includes(f))) {
          setStep(1);
        } else if (errorFields.some((f) => step2Fields.includes(f))) {
          setStep(2);
        } else if (errorFields.some((f) => step3Fields.includes(f))) {
          setStep(3);
        }

        toast({
          title: "Missing Information",
          description: "Please fill in all required fields before submitting.",
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

      <div className="space-y-3 rounded-xl border border-border p-4 bg-white/50 dark:bg-gray-900/50">
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

      <div className="rounded-xl border-2 border-[#0a4a82] bg-[#0a4a82]/5 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-[#0a4a82] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-base font-bold text-[#0a4a82]">Local Vendor Eligibility Policy</h4>
            <p className="text-sm text-gray-700 mt-1 leading-relaxed">
              Local List 365 is exclusively for <strong>independently owned and locally operated businesses</strong> serving Currituck County. National chains, franchises, and corporate-controlled operations are <strong>not eligible</strong>.
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
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border border-[#0a4a82]/20 bg-white p-3">
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

      <FormField
        control={form.control}
        name="logoUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Business Logo URL (Optional)</FormLabel>
            <FormControl>
              <Input
                placeholder="https://..."
                {...field}
                value={field.value || ""}
                data-testid="input-logo-url"
              />
            </FormControl>
            <FormDescription>
              Upload your logo via your profile after sign-up
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="imageUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cover Image URL (Optional)</FormLabel>
            <FormControl>
              <Input
                placeholder="https://..."
                {...field}
                value={field.value || ""}
                data-testid="input-image-url"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
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

      <div className="space-y-4 rounded-xl border border-border p-4 bg-white/50 dark:bg-gray-900/50">
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

      <div className="space-y-3 rounded-xl border border-border p-4 bg-white/50 dark:bg-gray-900/50">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4 text-[#0a4a82]" />
          <p className="text-sm font-semibold text-foreground">
            Business Hours (Optional)
          </p>
        </div>
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
      </div>
    </div>
  );

  const renderStep3 = () => {
    const primaryCategory = form.watch("category");
    const totalSelected = 1 + selectedCategories.length;

    return (
      <div className="space-y-5">
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

        {categoryLimit > 1 && (
          <div className="space-y-3 rounded-xl border border-border p-4 bg-white/50 dark:bg-gray-900/50">
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

        <FormField
          control={form.control}
          name="searchKeywords"
          render={({ field }) => {
            const charCount = (field.value || "").length;
            return (
              <FormItem>
                <FormLabel>
                  <div className="flex items-center gap-2">
                    <Tags className="h-4 w-4" />
                    Search Keywords / Tags (Optional)
                  </div>
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Electric, Electrical, Electrician, Local, Veteran, Hometown..."
                    rows={2}
                    {...field}
                    value={field.value || ""}
                    data-testid="input-keywords"
                  />
                </FormControl>
                <div className="flex justify-between">
                  <FormDescription>
                    Comma-separated keywords to help customers find you
                  </FormDescription>
                  <span
                    className={`text-xs ${charCount > 250 ? "text-red-500" : "text-muted-foreground"}`}
                  >
                    {charCount}/250
                  </span>
                </div>
                <FormMessage />
              </FormItem>
            );
          }}
        />
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

      <div className="space-y-4 rounded-xl border border-border p-4 bg-white/50 dark:bg-gray-900/50">
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
    </div>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 0:
        return renderStep0();
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return null;
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="space-y-6"
        data-testid="create-business-form"
      >
        {renderStepIndicator()}

        <div className="min-h-[350px]">{renderCurrentStep()}</div>

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
