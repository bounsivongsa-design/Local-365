import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Crop as CropIcon, RotateCcw, Check, X } from "lucide-react";

interface ImageCropperProps {
  imageFile: File;
  aspectRatio?: number;
  onCropped: (croppedBlob: Blob) => void;
  onCancel: () => void;
  maxWidth?: number;
  maxHeight?: number;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

export function ImageCropper({ imageFile, aspectRatio, onCropped, onCancel, maxWidth = 1200, maxHeight = 800 }: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>();
  const [imgSrc, setImgSrc] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setImgSrc(reader.result as string);
    reader.readAsDataURL(imageFile);
    return () => { reader.abort(); };
  }, [imageFile]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (aspectRatio) {
      setCrop(centerAspectCrop(naturalWidth, naturalHeight, aspectRatio));
    } else {
      setCrop(centerAspectCrop(naturalWidth, naturalHeight, naturalWidth / naturalHeight));
    }
  }, [aspectRatio]);

  const handleCrop = async () => {
    if (!imgRef.current || !crop) return;
    setProcessing(true);

    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const pixelCrop = {
      x: (crop.unit === "%" ? (crop.x / 100) * image.width : crop.x) * scaleX,
      y: (crop.unit === "%" ? (crop.y / 100) * image.height : crop.y) * scaleY,
      width: (crop.unit === "%" ? (crop.width / 100) * image.width : crop.width) * scaleX,
      height: (crop.unit === "%" ? (crop.height / 100) * image.height : crop.height) * scaleY,
    };

    const canvas = document.createElement("canvas");
    let outW = pixelCrop.width;
    let outH = pixelCrop.height;

    if (outW > maxWidth) {
      const ratio = maxWidth / outW;
      outW = maxWidth;
      outH = outH * ratio;
    }
    if (outH > maxHeight) {
      const ratio = maxHeight / outH;
      outH = maxHeight;
      outW = outW * ratio;
    }

    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setProcessing(false); return; }

    ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, outW, outH);

    canvas.toBlob((blob) => {
      setProcessing(false);
      if (blob) onCropped(blob);
    }, "image/jpeg", 0.9);
  };

  const handleReset = () => {
    if (!imgRef.current) return;
    const { naturalWidth, naturalHeight } = imgRef.current;
    if (aspectRatio) {
      setCrop(centerAspectCrop(naturalWidth, naturalHeight, aspectRatio));
    } else {
      setCrop(centerAspectCrop(naturalWidth, naturalHeight, naturalWidth / naturalHeight));
    }
  };

  if (!imgSrc) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading image...</div>;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm" style={{ zIndex: 9999 }} data-testid="image-cropper-overlay">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <CropIcon className="h-5 w-5 text-[#0a4a82]" />
            <h3 className="font-semibold text-slate-900">Crop & Resize Image</h3>
          </div>
          <p className="text-xs text-muted-foreground">Drag corners to adjust the crop area</p>
        </div>

        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-100" style={{ maxHeight: '60vh' }}>
          <ReactCrop
            crop={crop}
            onChange={c => setCrop(c)}
            aspect={aspectRatio}
            className="max-w-full"
          >
            <img
              ref={imgRef}
              src={imgSrc}
              alt="Crop preview"
              onLoad={onImageLoad}
              style={{ maxHeight: '55vh', maxWidth: '100%' }}
            />
          </ReactCrop>
        </div>

        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <Button type="button" variant="outline" size="sm" onClick={handleReset} data-testid="button-reset-crop">
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} data-testid="button-cancel-crop">
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleCrop} disabled={processing} className="bg-[#0a4a82] hover:bg-[#0a4a82]/90" data-testid="button-apply-crop">
              <Check className="h-4 w-4 mr-1" /> {processing ? "Processing..." : "Apply Crop"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
