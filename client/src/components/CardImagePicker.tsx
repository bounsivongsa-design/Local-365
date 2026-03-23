import { useState, useRef, useCallback } from "react";
import { Check, Upload, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";

interface CardImagePickerProps {
  category: string;
  value: string;
  onChange: (url: string) => void;
}

export function CardImagePicker({ category, value, onChange }: CardImagePickerProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress } = useUpload();
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(async (file: File) => {
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
  }, [uploadFile, onChange, toast]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">Card Cover Image (Optional)</label>

      {value ? (
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
          className={`flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed transition-colors ${isDragging ? "border-[#0a4a82] bg-[#0a4a82]/10" : "border-[#0a4a82]/20 bg-[#0a4a82]/5"} cursor-pointer hover:border-[#0a4a82]/40 ${isUploading ? "pointer-events-none opacity-60" : ""}`}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          data-testid="dropzone-cover-image"
        >
          <div className="w-10 h-10 rounded-full bg-[#0a4a82]/10 flex items-center justify-center">
            <ImageIcon className="h-5 w-5 text-[#0a4a82]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {isDragging ? "Drop your image here" : "Drag & drop or click to upload a cover image"}
            </p>
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

      {value && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">
          <Check className="h-3.5 w-3.5" />
          <span>Cover image selected</span>
        </div>
      )}
    </div>
  );
}
