import { useState, useRef, useCallback, useEffect } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Paintbrush,
  Type,
  Image as ImageIcon,
  Download,
  RotateCcw,
  Upload,
  Loader2,
  Layers,
  ChevronDown,
  ChevronUp,
  Eye,
  Palette,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdDesignerProps {
  onComplete: (blob: Blob) => void;
  onCancel: () => void;
  adSize?: "small" | "medium" | "large";
  businessName?: string;
  businessLogo?: string;
}

const PRESET_GRADIENTS = [
  { name: "Ocean Blue", from: "#0a4a82", to: "#1e6bb8", text: "#ffffff" },
  { name: "Coastal Sunset", from: "#d4a373", to: "#e8926f", text: "#ffffff" },
  { name: "Dune Green", from: "#5a7a3b", to: "#8a9a5b", text: "#ffffff" },
  { name: "Dark Navy", from: "#1a1a2e", to: "#0a4a82", text: "#ffffff" },
  { name: "Sandy Warm", from: "#f5e6d3", to: "#d4a373", text: "#1a1a2e" },
  { name: "Charcoal", from: "#2d2d2d", to: "#4a4a4a", text: "#ffffff" },
  { name: "Crimson", from: "#8b1a1a", to: "#c0392b", text: "#ffffff" },
  { name: "Forest", from: "#1a3c2e", to: "#2d6a4f", text: "#ffffff" },
  { name: "Purple Night", from: "#2d1b69", to: "#5b2c8e", text: "#ffffff" },
  { name: "Clean White", from: "#ffffff", to: "#f0f0f0", text: "#1a1a2e" },
];

const FONT_OPTIONS = [
  { value: "sans", label: "Modern (Sans)", family: "'Inter', 'Segoe UI', system-ui, sans-serif" },
  { value: "serif", label: "Classic (Serif)", family: "Georgia, 'Times New Roman', serif" },
  { value: "display", label: "Bold Display", family: "'Impact', 'Arial Black', sans-serif" },
];

type BackgroundType = "gradient" | "solid" | "image";

interface DesignState {
  bgType: BackgroundType;
  bgColor1: string;
  bgColor2: string;
  bgGradientAngle: number;
  bgImage: string | null;
  bgOverlayOpacity: number;
  headline: string;
  headlineFontSize: number;
  headlineColor: string;
  headlineBold: boolean;
  headlineFont: string;
  headlineAlign: "left" | "center" | "right";
  tagline: string;
  taglineFontSize: number;
  taglineColor: string;
  taglineFont: string;
  businessName: string;
  businessNameColor: string;
  businessNameFontSize: number;
  showLogo: boolean;
  logoUrl: string | null;
  logoSize: number;
  ctaText: string;
  ctaBgColor: string;
  ctaTextColor: string;
  ctaShow: boolean;
}

const defaultDesign: DesignState = {
  bgType: "gradient",
  bgColor1: "#0a4a82",
  bgColor2: "#1e6bb8",
  bgGradientAngle: 135,
  bgImage: null,
  bgOverlayOpacity: 50,
  headline: "Your Headline Here",
  headlineFontSize: 36,
  headlineColor: "#ffffff",
  headlineBold: true,
  headlineFont: "sans",
  headlineAlign: "center",
  tagline: "Add a compelling tagline",
  taglineFontSize: 16,
  taglineColor: "#ffffff",
  taglineFont: "sans",
  businessName: "",
  businessNameColor: "#d4a373",
  businessNameFontSize: 14,
  showLogo: false,
  logoUrl: null,
  logoSize: 60,
  ctaText: "Learn More",
  ctaBgColor: "#d4a373",
  ctaTextColor: "#ffffff",
  ctaShow: true,
};

export function AdDesigner({ onComplete, onCancel, adSize = "medium", businessName = "", businessLogo }: AdDesignerProps) {
  const [design, setDesign] = useState<DesignState>({
    ...defaultDesign,
    businessName,
    showLogo: !!businessLogo,
    logoUrl: businessLogo || null,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [activePanel, setActivePanel] = useState<string>("background");
  const previewRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const bgFileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  const update = useCallback((partial: Partial<DesignState>) => {
    setDesign(prev => ({ ...prev, ...partial }));
  }, []);

  const getFontFamily = (fontKey: string) => {
    return FONT_OPTIONS.find(f => f.value === fontKey)?.family || FONT_OPTIONS[0].family;
  };

  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      update({ bgType: "image", bgImage: reader.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      update({ showLogo: true, logoUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleGenerate = async () => {
    if (!previewRef.current) return;
    setIsGenerating(true);
    try {
      const dataUrl = await toPng(previewRef.current, {
        width: 1200,
        height: 675,
        pixelRatio: 2,
        cacheBust: true,
      });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      onComplete(blob);
    } catch (err) {
      console.error("Failed to generate ad image:", err);
      toast({ title: "Generation Failed", description: "Could not generate the ad image. Please try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setDesign({
      ...defaultDesign,
      businessName,
      showLogo: !!businessLogo,
      logoUrl: businessLogo || null,
    });
  };

  const applyPreset = (preset: typeof PRESET_GRADIENTS[0]) => {
    update({
      bgType: "gradient",
      bgColor1: preset.from,
      bgColor2: preset.to,
      headlineColor: preset.text,
      taglineColor: preset.text === "#ffffff" ? "rgba(255,255,255,0.85)" : "rgba(26,26,46,0.7)",
    });
  };

  const panels = [
    { id: "background", label: "Background", icon: Palette },
    { id: "text", label: "Text & Headlines", icon: Type },
    { id: "branding", label: "Logo & Branding", icon: Sparkles },
    { id: "cta", label: "Call to Action", icon: Eye },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-5 max-h-[85vh]" data-testid="ad-designer">
      <div className="lg:w-[340px] shrink-0 overflow-y-auto space-y-3 pr-1 max-h-[85vh] lg:max-h-none">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2">
            <Paintbrush className="h-4 w-4 text-[#0a4a82]" />
            Ad Designer
          </h3>
          <button onClick={handleReset} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1" data-testid="button-reset-design">
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>

        {panels.map(panel => {
          const isOpen = activePanel === panel.id;
          const PanelIcon = panel.icon;
          return (
            <div key={panel.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <button
                onClick={() => setActivePanel(isOpen ? "" : panel.id)}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                data-testid={`panel-toggle-${panel.id}`}
              >
                <PanelIcon className="h-4 w-4 text-[#0a4a82]" />
                <span className="text-sm font-semibold text-[#1a1a2e] flex-1">{panel.label}</span>
                {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {isOpen && panel.id === "background" && (
                <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-500">Quick Presets</Label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {PRESET_GRADIENTS.map((preset, i) => (
                        <button
                          key={i}
                          onClick={() => applyPreset(preset)}
                          className="w-full aspect-square rounded-lg border-2 border-transparent hover:border-[#0a4a82] transition-all hover:scale-105 shadow-sm"
                          style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}
                          title={preset.name}
                          data-testid={`preset-${i}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-500">Background Type</Label>
                    <Select value={design.bgType} onValueChange={(v) => update({ bgType: v as BackgroundType })}>
                      <SelectTrigger className="h-9 bg-white" data-testid="select-bg-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gradient">Gradient</SelectItem>
                        <SelectItem value="solid">Solid Color</SelectItem>
                        <SelectItem value="image">Photo Background</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {design.bgType !== "image" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-semibold text-slate-500">
                          {design.bgType === "gradient" ? "Color 1" : "Color"}
                        </Label>
                        <input
                          type="color"
                          value={design.bgColor1}
                          onChange={(e) => update({ bgColor1: e.target.value })}
                          className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer"
                          data-testid="input-bg-color1"
                        />
                      </div>
                      {design.bgType === "gradient" && (
                        <>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs font-semibold text-slate-500">Color 2</Label>
                            <input
                              type="color"
                              value={design.bgColor2}
                              onChange={(e) => update({ bgColor2: e.target.value })}
                              className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer"
                              data-testid="input-bg-color2"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-500">Angle: {design.bgGradientAngle}°</Label>
                            <Slider
                              value={[design.bgGradientAngle]}
                              onValueChange={([v]) => update({ bgGradientAngle: v })}
                              min={0} max={360} step={15}
                              data-testid="slider-gradient-angle"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {design.bgType === "image" && (
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full rounded-lg text-xs"
                        onClick={() => bgFileRef.current?.click()}
                        data-testid="button-upload-bg-image"
                      >
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        {design.bgImage ? "Change Photo" : "Upload Photo"}
                      </Button>
                      <input ref={bgFileRef} type="file" accept="image/*" className="hidden" onChange={handleBgImageUpload} />
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-500">Overlay Darkness: {design.bgOverlayOpacity}%</Label>
                        <Slider
                          value={[design.bgOverlayOpacity]}
                          onValueChange={([v]) => update({ bgOverlayOpacity: v })}
                          min={0} max={90} step={5}
                          data-testid="slider-overlay-opacity"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isOpen && panel.id === "text" && (
                <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-500">Headline</Label>
                    <Input
                      value={design.headline}
                      onChange={(e) => update({ headline: e.target.value })}
                      placeholder="Main headline..."
                      className="h-9 bg-white"
                      style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                      data-testid="input-design-headline"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={design.headlineColor}
                        onChange={(e) => update({ headlineColor: e.target.value })}
                        className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
                        data-testid="input-headline-color"
                      />
                      <Slider
                        value={[design.headlineFontSize]}
                        onValueChange={([v]) => update({ headlineFontSize: v })}
                        min={18} max={60} step={1}
                        className="flex-1"
                        data-testid="slider-headline-size"
                      />
                      <span className="text-[10px] text-slate-400 w-8 text-right">{design.headlineFontSize}px</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Select value={design.headlineFont} onValueChange={(v) => update({ headlineFont: v })}>
                        <SelectTrigger className="h-8 text-xs flex-1" data-testid="select-headline-font"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FONT_OPTIONS.map(f => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-1">
                        {(["left", "center", "right"] as const).map(align => (
                          <button
                            key={align}
                            onClick={() => update({ headlineAlign: align })}
                            className={`px-2 py-1 rounded text-xs ${design.headlineAlign === align ? "bg-[#0a4a82] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                            data-testid={`button-align-${align}`}
                          >
                            {align === "left" ? "L" : align === "center" ? "C" : "R"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-500">Tagline</Label>
                    <Input
                      value={design.tagline}
                      onChange={(e) => update({ tagline: e.target.value })}
                      placeholder="Supporting text..."
                      className="h-9 bg-white"
                      style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                      data-testid="input-design-tagline"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={design.taglineColor.startsWith("rgba") ? "#ffffff" : design.taglineColor}
                        onChange={(e) => update({ taglineColor: e.target.value })}
                        className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
                        data-testid="input-tagline-color"
                      />
                      <Slider
                        value={[design.taglineFontSize]}
                        onValueChange={([v]) => update({ taglineFontSize: v })}
                        min={10} max={28} step={1}
                        className="flex-1"
                        data-testid="slider-tagline-size"
                      />
                      <span className="text-[10px] text-slate-400 w-8 text-right">{design.taglineFontSize}px</span>
                    </div>
                  </div>
                </div>
              )}

              {isOpen && panel.id === "branding" && (
                <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-500">Business Name</Label>
                    <Input
                      value={design.businessName}
                      onChange={(e) => update({ businessName: e.target.value })}
                      placeholder="Your business name..."
                      className="h-9 bg-white"
                      style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                      data-testid="input-design-business-name"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={design.businessNameColor}
                        onChange={(e) => update({ businessNameColor: e.target.value })}
                        className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
                        data-testid="input-biz-name-color"
                      />
                      <Slider
                        value={[design.businessNameFontSize]}
                        onValueChange={([v]) => update({ businessNameFontSize: v })}
                        min={10} max={24} step={1}
                        className="flex-1"
                        data-testid="slider-biz-name-size"
                      />
                      <span className="text-[10px] text-slate-400 w-8 text-right">{design.businessNameFontSize}px</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-500">Logo</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-lg text-xs"
                        onClick={() => logoFileRef.current?.click()}
                        data-testid="button-upload-logo"
                      >
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        {design.logoUrl ? "Change Logo" : "Upload Logo"}
                      </Button>
                      {design.logoUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-red-500"
                          onClick={() => update({ showLogo: false, logoUrl: null })}
                          data-testid="button-remove-logo"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    {design.logoUrl && (
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-500">Logo Size: {design.logoSize}px</Label>
                        <Slider
                          value={[design.logoSize]}
                          onValueChange={([v]) => update({ logoSize: v })}
                          min={30} max={120} step={5}
                          data-testid="slider-logo-size"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isOpen && panel.id === "cta" && (
                <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-500">Show Button</Label>
                    <button
                      onClick={() => update({ ctaShow: !design.ctaShow })}
                      className={`w-10 h-5 rounded-full transition-colors ${design.ctaShow ? "bg-[#0a4a82]" : "bg-slate-300"}`}
                      data-testid="toggle-cta"
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${design.ctaShow ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                  {design.ctaShow && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-500">Button Text</Label>
                        <Input
                          value={design.ctaText}
                          onChange={(e) => update({ ctaText: e.target.value })}
                          placeholder="Call to action..."
                          className="h-9 bg-white"
                          style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
                          data-testid="input-cta-text"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-slate-400">Button</Label>
                          <input
                            type="color"
                            value={design.ctaBgColor}
                            onChange={(e) => update({ ctaBgColor: e.target.value })}
                            className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
                            data-testid="input-cta-bg-color"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-slate-400">Text</Label>
                          <input
                            type="color"
                            value={design.ctaTextColor}
                            onChange={(e) => update({ ctaTextColor: e.target.value })}
                            className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
                            data-testid="input-cta-text-color"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex-1 flex items-center justify-center bg-[repeating-conic-gradient(#e5e5e5_0%_25%,#f5f5f5_0%_50%)] bg-[length:20px_20px] rounded-xl p-4 border border-slate-200 overflow-hidden">
          <div
            ref={previewRef}
            className="relative overflow-hidden shadow-2xl"
            style={{
              width: "100%",
              maxWidth: "600px",
              aspectRatio: "16/9",
              borderRadius: "12px",
            }}
            data-testid="ad-preview-canvas"
          >
            {design.bgType === "image" && design.bgImage ? (
              <>
                <img
                  src={design.bgImage}
                  alt="Background"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: `rgba(0,0,0,${design.bgOverlayOpacity / 100})`,
                  }}
                />
              </>
            ) : (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: design.bgType === "gradient"
                    ? `linear-gradient(${design.bgGradientAngle}deg, ${design.bgColor1}, ${design.bgColor2})`
                    : design.bgColor1,
                }}
              />
            )}

            <div
              style={{
                position: "relative",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: design.headlineAlign === "center" ? "center" : design.headlineAlign === "right" ? "flex-end" : "flex-start",
                height: "100%",
                padding: "32px 40px",
                textAlign: design.headlineAlign,
              }}
            >
              {design.showLogo && design.logoUrl && (
                <img
                  src={design.logoUrl}
                  alt="Logo"
                  style={{
                    width: `${design.logoSize}px`,
                    height: `${design.logoSize}px`,
                    objectFit: "contain",
                    marginBottom: "12px",
                    borderRadius: "8px",
                  }}
                />
              )}

              {design.businessName && (
                <div
                  style={{
                    color: design.businessNameColor,
                    fontSize: `${design.businessNameFontSize}px`,
                    fontWeight: 600,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    marginBottom: "8px",
                    fontFamily: getFontFamily(design.headlineFont),
                  }}
                >
                  {design.businessName}
                </div>
              )}

              {design.headline && (
                <div
                  style={{
                    color: design.headlineColor,
                    fontSize: `${design.headlineFontSize}px`,
                    fontWeight: design.headlineBold ? 800 : 500,
                    lineHeight: 1.15,
                    marginBottom: "10px",
                    fontFamily: getFontFamily(design.headlineFont),
                    maxWidth: "100%",
                    wordBreak: "break-word",
                  }}
                >
                  {design.headline}
                </div>
              )}

              {design.tagline && (
                <div
                  style={{
                    color: design.taglineColor,
                    fontSize: `${design.taglineFontSize}px`,
                    fontWeight: 400,
                    lineHeight: 1.4,
                    marginBottom: "16px",
                    fontFamily: getFontFamily(design.taglineFont),
                    maxWidth: "90%",
                    opacity: 0.9,
                  }}
                >
                  {design.tagline}
                </div>
              )}

              {design.ctaShow && design.ctaText && (
                <div
                  style={{
                    display: "inline-block",
                    backgroundColor: design.ctaBgColor,
                    color: design.ctaTextColor,
                    padding: "10px 28px",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                    fontFamily: getFontFamily(design.headlineFont),
                  }}
                >
                  {design.ctaText}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={onCancel}
            data-testid="button-cancel-design"
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl bg-gradient-to-r from-[#0a4a82] to-[#083a6a] hover:from-[#083a6a] hover:to-[#062d54] text-white font-semibold shadow-lg"
            onClick={handleGenerate}
            disabled={isGenerating}
            data-testid="button-use-design"
          >
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
            ) : (
              <><Download className="h-4 w-4 mr-2" /> Use This Design</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
