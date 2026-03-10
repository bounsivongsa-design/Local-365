import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertBusinessSchema } from "@shared/schema";
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
import { Shield, FileCheck, Scale } from "lucide-react";

interface Props {
  onSuccess: () => void;
}

const formSchema = insertBusinessSchema;
type FormValues = z.infer<typeof formSchema>;

export function CreateBusinessForm({ onSuccess }: Props) {
  const createBusiness = useCreateBusiness();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      address: "",
      category: "Retail",
      imageUrl: "",
      hasInsurance: false,
      hasLLC: false,
      isLicensed: false,
    },
  });

  const onSubmit = (data: FormValues) => {
    // Basic Unsplash placeholder logic if empty (usually handled on backend or just use a generic one)
    if (!data.imageUrl) {
      data.imageUrl = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop"; 
      // <!-- generic shop -->
    }

    createBusiness.mutate(data, {
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Business added to directory!",
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
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. The Local Coffee Spot" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Food">Food & Dining</SelectItem>
                  <SelectItem value="Retail">Retail & Shopping</SelectItem>
                  <SelectItem value="Service">Services</SelectItem>
                  <SelectItem value="Entertainment">Entertainment</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input placeholder="123 Main St..." {...field} />
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
                <Textarea placeholder="Tell us about this business..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Image URL (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3 rounded-xl border border-border p-4 bg-white/50 dark:bg-gray-900/50">
          <p className="text-sm font-semibold text-foreground">Business Credentials</p>
          <FormField
            control={form.control}
            name="hasInsurance"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-has-insurance"
                  />
                </FormControl>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <FormLabel className="text-sm font-normal cursor-pointer">Insured</FormLabel>
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="hasLLC"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-has-llc"
                  />
                </FormControl>
                <div className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-blue-600" />
                  <FormLabel className="text-sm font-normal cursor-pointer">LLC Registered</FormLabel>
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isLicensed"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-is-licensed"
                  />
                </FormControl>
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-purple-600" />
                  <FormLabel className="text-sm font-normal cursor-pointer">Licensed</FormLabel>
                </div>
              </FormItem>
            )}
          />
        </div>

        <div className="pt-4 flex justify-end">
          <Button type="submit" disabled={createBusiness.isPending} className="w-full sm:w-auto">
            {createBusiness.isPending ? "Adding..." : "Add Business"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
