import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentProcessor } from "./DocumentProcessor";

interface SettingsSidebarProps {
  googleCloudApiKey: string;
  onGoogleCloudApiKeyChange: (key: string) => void;
  enableAutoCropping: boolean;
  onAutoCroppingChange: (enabled: boolean) => void;
  autoCropMargin: number;
  onAutoCropMarginChange: (margin: number) => void;
  onTestOCR?: () => void;
  isTestingOCR: boolean;
  principles: string;
  setPrinciples: (principles: string) => void;
  uploadedImage: string | null;
}

export const SettingsSidebar = ({
  principles,
  setPrinciples,
}: SettingsSidebarProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 right-4 z-50 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className="w-[400px] sm:w-[540px] bg-gray-800 border-gray-700 text-white overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-white">Settings</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {/* AI Principles */}
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-6">
              <h3 className="text-white text-lg font-medium mb-4">AI Principles</h3>
              <Textarea
                placeholder="Enter the key principles for AI to follow when generating replies..."
                value={principles}
                onChange={(e) => setPrinciples(e.target.value)}
                rows={6}
                className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 resize-none"
              />
            </CardContent>
          </Card>
        </div>

        <div className="border-t border-gray-700 pt-4 mt-4">
          <DocumentProcessor />
        </div>
      </SheetContent>
    </Sheet>
  );
};
