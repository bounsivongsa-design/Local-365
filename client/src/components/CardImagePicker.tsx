import { useState, useRef } from "react";
import { Check, Upload, ImageIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_TEMPLATES: Record<string, string[]> = {
  "Restaurants & Dining": [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop",
  ],
  "Home Services": [
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&h=500&fit=crop",
  ],
  "Automotive": [
    "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&h=500&fit=crop",
  ],
  "Health & Wellness": [
    "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1540555700478-4be289fbec6c?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=500&fit=crop",
  ],
  "Beauty & Personal Care": [
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&h=500&fit=crop",
  ],
  "Real Estate": [
    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=500&fit=crop",
  ],
  "Legal Services": [
    "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1505664194779-8beaceb93744?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800&h=500&fit=crop",
  ],
  "Financial Services": [
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=500&fit=crop",
  ],
  "Education & Tutoring": [
    "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=500&fit=crop",
  ],
  "Fitness & Recreation": [
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&h=500&fit=crop",
  ],
  "Shopping & Retail": [
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800&h=500&fit=crop",
  ],
  "Pet Services": [
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&h=500&fit=crop",
  ],
  "Wedding & Events": [
    "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1471341971476-ae15ff5dd4ea?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=500&fit=crop",
  ],
  "Cleaning Services": [
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1527515637462-cee1cc710d19?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800&h=500&fit=crop",
  ],
  "Landscaping & Lawn Care": [
    "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?w=800&h=500&fit=crop",
  ],
  "Technology & IT": [
    "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=500&fit=crop",
  ],
  "Travel & Tourism": [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=500&fit=crop",
  ],
  "Moving & Storage": [
    "https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1601972602237-8c79241e468b?w=800&h=500&fit=crop",
  ],
  "Pest Control": [
    "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=500&fit=crop",
  ],
  "Photography & Video": [
    "https://images.unsplash.com/photo-1471341971476-ae15ff5dd4ea?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=800&h=500&fit=crop",
  ],
  "Religious & Spiritual": [
    "https://images.unsplash.com/photo-1438032005730-c779502df39b?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1507692049790-de58290a4334?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1473177104440-ffee2f376098?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1519491050282-cf00c82424be?w=800&h=500&fit=crop",
  ],
  "Government & Nonprofit": [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&h=500&fit=crop",
  ],
  "Child Care & Family": [
    "https://images.unsplash.com/photo-1587616211892-f743fcca64f9?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&h=500&fit=crop",
  ],
  "Security Services": [
    "https://images.unsplash.com/photo-1558002038-1055907df827?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=500&fit=crop",
  ],
  "Animal & Pet": [
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&h=500&fit=crop",
  ],
  "Garage Door": [
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&h=500&fit=crop",
  ],
  "Moving & Hauling": [
    "https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1601972602237-8c79241e468b?w=800&h=500&fit=crop",
  ],
  "Metal Work": [
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1632759145351-1d592919f522?w=800&h=500&fit=crop",
  ],
  "Fencing": [
    "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=500&fit=crop",
  ],
  "Woodworking": [
    "https://images.unsplash.com/photo-1611095780322-bbc1f7b9f4ce?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&h=500&fit=crop",
  ],
  "Entertainment Services": [
    "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1471341971476-ae15ff5dd4ea?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=500&fit=crop",
  ],
  "Entertainment Locations": [
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1471341971476-ae15ff5dd4ea?w=800&h=500&fit=crop",
  ],
  "Catering / Food Trucks": [
    "https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=500&fit=crop",
  ],
};

const DEFAULT_TEMPLATES = [
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=500&fit=crop",
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800&h=500&fit=crop",
];

function getTemplatesForCategory(category: string): string[] {
  if (category && CATEGORY_TEMPLATES[category]) {
    return CATEGORY_TEMPLATES[category];
  }
  return DEFAULT_TEMPLATES;
}

interface CardImagePickerProps {
  category: string;
  value: string;
  onChange: (url: string) => void;
}

export function CardImagePicker({ category, value, onChange }: CardImagePickerProps) {
  const [mode, setMode] = useState<"templates" | "upload">(value && !value.includes("unsplash.com") ? "upload" : "templates");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress } = useUpload();

  const templates = getTemplatesForCategory(category);
  const displayLabel = category || "General Business";

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a JPG, PNG, or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be under 10MB.", variant: "destructive" });
      return;
    }
    try {
      const result = await uploadFile(file);
      if (result) {
        onChange(result.objectPath);
        toast({ title: "Image uploaded", description: "Your cover image has been uploaded successfully." });
      } else {
        toast({ title: "Upload failed", description: "Something went wrong uploading your image. Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", description: "Could not upload your image. Please check your connection and try again.", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">Card Cover Image</label>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            type="button"
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${mode === "templates" ? "bg-white text-[#0a4a82] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setMode("templates")}
            data-testid="tab-templates"
          >
            <Sparkles className="h-3 w-3 inline mr-1" />
            Templates
          </button>
          <button
            type="button"
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${mode === "upload" ? "bg-white text-[#0a4a82] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setMode("upload")}
            data-testid="tab-upload"
          >
            <Upload className="h-3 w-3 inline mr-1" />
            Upload
          </button>
        </div>
      </div>

      {mode === "templates" ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {category ? `${displayLabel} templates` : "General templates — pick a category above for industry-specific images"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((img, idx) => (
              <div
                key={img}
                className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all h-24 ${
                  value === img ? "border-[#0a4a82] ring-2 ring-[#0a4a82]/30 shadow-md" : "border-transparent hover:border-[#0a4a82]/30"
                }`}
                onClick={() => onChange(img)}
                data-testid={`template-image-${idx}`}
              >
                <img src={img} alt={`${displayLabel} template ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                {value === img && (
                  <div className="absolute inset-0 bg-[#0a4a82]/30 flex items-center justify-center">
                    <div className="w-7 h-7 rounded-full bg-[#0a4a82] flex items-center justify-center shadow-lg">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {value && !value.includes("unsplash.com") ? (
            <div className="relative rounded-xl overflow-hidden border-2 border-[#0a4a82] h-32">
              <img src={value} alt="Custom cover" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Button type="button" variant="secondary" size="sm" className="shadow-lg" onClick={() => fileInputRef.current?.click()} disabled={isUploading} data-testid="button-replace-cover">
                  <Upload className="h-3.5 w-3.5 mr-1.5" /> Replace
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={`flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-[#0a4a82]/20 bg-[#0a4a82]/5 cursor-pointer hover:border-[#0a4a82]/40 transition-colors ${isUploading ? "pointer-events-none opacity-60" : ""}`}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              data-testid="dropzone-cover-image"
            >
              <div className="w-10 h-10 rounded-full bg-[#0a4a82]/10 flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-[#0a4a82]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Upload your own cover image</p>
                <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, or WebP · Max 10MB</p>
              </div>
            </div>
          )}
          {isUploading && (
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Uploading...</span>
                <span className="font-medium text-[#0a4a82]">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#0a4a82] to-[#d4a373] rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileUpload}
            data-testid="input-cover-file"
          />
        </div>
      )}

      {value && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">
          <Check className="h-3.5 w-3.5" />
          <span>Cover image selected</span>
        </div>
      )}
    </div>
  );
}
