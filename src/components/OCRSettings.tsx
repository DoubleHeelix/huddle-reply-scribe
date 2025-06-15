
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { AlertCircle, Eye, Settings } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OCRSettingsProps {
  googleCloudApiKey: string;
  onGoogleCloudApiKeyChange: (key: string) => void;
  enableAutoCropping: boolean;
  onAutoCroppingChange: (enabled: boolean) => void;
  autoCropMargin: number;
  onAutoCropMarginChange: (margin: number) => void;
  onTestOCR?: () => void;
  isTestingOCR?: boolean;
}

export const OCRSettings = ({
  googleCloudApiKey,
  onGoogleCloudApiKeyChange,
  enableAutoCropping,
  onAutoCroppingChange,
  autoCropMargin,
  onAutoCropMarginChange,
  onTestOCR,
  isTestingOCR = false
}: OCRSettingsProps) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(googleCloudApiKey);

  const handleSaveApiKey = () => {
    onGoogleCloudApiKeyChange(tempApiKey);
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Settings className="w-5 h-5" />
          OCR Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Google Cloud API Key */}
        <div className="space-y-3">
          <Label className="text-white text-sm font-medium">
            Google Cloud Vision API Key
          </Label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                type={showApiKey ? "text" : "password"}
                placeholder="Enter your Google Cloud Vision API key..."
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-400 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0 text-gray-400 hover:text-white"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
            <Button
              onClick={handleSaveApiKey}
              disabled={tempApiKey === googleCloudApiKey}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Save
            </Button>
          </div>
          {!googleCloudApiKey && (
            <Alert className="bg-orange-900/20 border-orange-600">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-orange-200">
                OCR requires a Google Cloud Vision API key. Without it, you'll see placeholder text instead of actual screenshot content.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Auto-cropping Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-white text-sm font-medium">
                Auto-crop Chat Area
              </Label>
              <p className="text-gray-400 text-xs">
                Automatically crop screenshots to focus on chat content
              </p>
            </div>
            <Switch
              checked={enableAutoCropping}
              onCheckedChange={onAutoCroppingChange}
            />
          </div>

          {enableAutoCropping && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-white text-sm">
                  Crop Margin: {autoCropMargin}px
                </Label>
              </div>
              <Slider
                value={[autoCropMargin]}
                onValueChange={(values) => onAutoCropMarginChange(values[0])}
                max={50}
                min={0}
                step={1}
                className="w-full"
              />
              <p className="text-gray-500 text-xs">
                Extra pixels to include around detected content area
              </p>
            </div>
          )}
        </div>

        {/* Test OCR Button */}
        {onTestOCR && (
          <Button
            onClick={onTestOCR}
            disabled={isTestingOCR}
            variant="outline"
            className="w-full bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
          >
            {isTestingOCR ? 'Testing OCR...' : 'Test OCR with Current Screenshot'}
          </Button>
        )}

        {/* Debug Info */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Processing includes automatic content detection and cropping</p>
          <p>• Supports JPEG, PNG, and other common image formats</p>
          <p>• Response time typically 0.5-2 seconds depending on image size</p>
        </div>
      </CardContent>
    </Card>
  );
};
