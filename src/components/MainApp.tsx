import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, History, Camera, Users } from "lucide-react";
import { SettingsSidebar } from "@/components/SettingsSidebar";
import { InterruptionsTab } from "@/components/InterruptionsTab";
import { PastHuddlesTab } from "@/components/PastHuddlesTab";
import { HuddlePlayTab } from "@/components/HuddlePlayTab";
import { PeopleTab } from "@/components/PeopleTab";
import { useHuddleState } from "@/hooks/useHuddleState";
import { useInterruptions } from "@/hooks/useInterruptions";
import { useAuth } from '@/hooks/useAuth';

export const MainApp = () => {
  const { user, onSignOut, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("huddle-play");
  const [direction, setDirection] = useState(0);
  const huddleState = useHuddleState();
  const interruptionsState = useInterruptions();
  const {
    googleCloudApiKey,
    setGoogleCloudApiKey,
    enableAutoCropping,
    setEnableAutoCropping,
    autoCropMargin,
    setAutoCropMargin,
    uploadedImage,
    extractText,
    isOCRProcessing,
    toast,
  } = huddleState;

  // Save Google Cloud API key to localStorage
  const handleGoogleCloudApiKeyChange = (key: string) => {
    setGoogleCloudApiKey(key);
    localStorage.setItem('google_cloud_api_key', key);
  };

  // Save auto-cropping settings
  const handleAutoCroppingChange = (enabled: boolean) => {
    setEnableAutoCropping(enabled);
    localStorage.setItem('enable_auto_cropping', JSON.stringify(enabled));
  };

  const handleAutoCropMarginChange = (margin: number) => {
    setAutoCropMargin(margin);
    localStorage.setItem('auto_crop_margin', margin.toString());
  };

  const handleTestOCR = async () => {
    if (!uploadedImage) {
      toast({
        title: "No image to test",
        description: "Please upload a screenshot first.",
        variant: "destructive",
      });
      return;
    }

    console.log('OCR: Testing OCR with current screenshot...');
    const text = await extractText(uploadedImage);
    
    toast({
      title: "OCR Test Complete",
      description: text
        ? `Extracted ${text.length} characters successfully`
        : "OCR test completed with issues. Check console for details.",
    });
  };

  const tabContentVariants = {
    hidden: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    visible: {
      x: 0,
      opacity: 1,
      transition: { type: 'spring' as const, stiffness: 260, damping: 30 },
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      transition: { type: 'spring' as const, stiffness: 260, damping: 30 },
    }),
  };

  const handleTabChange = (newTab: string) => {
    const tabs = ["huddle-play", "interruptions", "people", "past-huddles"];
    const oldIndex = tabs.indexOf(activeTab);
    const newIndex = tabs.indexOf(newTab);
    setDirection(newIndex - oldIndex);
    setActiveTab(newTab);
  };

  return (
    <div
      className="min-h-screen bg-gray-900 text-white"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)'
      }}
    >
      {/* Settings Sidebar */}
      <SettingsSidebar
        googleCloudApiKey={googleCloudApiKey}
        onGoogleCloudApiKeyChange={handleGoogleCloudApiKeyChange}
        enableAutoCropping={enableAutoCropping}
        onAutoCroppingChange={handleAutoCroppingChange}
        autoCropMargin={autoCropMargin}
        onAutoCropMarginChange={handleAutoCropMarginChange}
        onTestOCR={uploadedImage ? handleTestOCR : undefined}
        isTestingOCR={isOCRProcessing}
        uploadedImage={uploadedImage}
        user={user}
        onSignOut={onSignOut}
        isAdmin={isAdmin}
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-500 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 font-sans">🤝 Huddle Assistant</h1>
          <p className="text-purple-100 font-sans">AI-powered conversation suggestions</p>
        </div>
      </div>

      <div className="p-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800/50 border border-gray-700 rounded-lg p-1">
            <TabsTrigger
              value="huddle-play"
              className="flex items-center gap-2 text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-md transition-all duration-200 font-sans text-xs"
            >
              <MessageSquare className="w-4 h-4" />
              Huddle
            </TabsTrigger>
            <TabsTrigger
              value="interruptions"
              className="flex items-center gap-2 text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-md transition-all duration-200 font-sans text-xs"
            >
              <Camera className="w-4 h-4" />
              Interruptions
            </TabsTrigger>
            <TabsTrigger
              value="people"
              className="flex items-center gap-2 text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-md transition-all duration-200 font-sans text-xs"
            >
              <Users className="w-4 h-4" />
              People
            </TabsTrigger>
            <TabsTrigger
              value="past-huddles"
              className="flex items-center gap-2 text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-md transition-all duration-200 font-sans text-xs"
            >
              <History className="w-4 h-4" />
              History
            </TabsTrigger>
          </TabsList>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={tabContentVariants}
              custom={direction}
            >
              <TabsContent value="huddle-play" forceMount className={activeTab === 'huddle-play' ? 'block' : 'hidden'}>
                <HuddlePlayTab huddleState={huddleState} />
              </TabsContent>
              <TabsContent value="interruptions" forceMount className={activeTab === 'interruptions' ? 'block' : 'hidden'}>
                <InterruptionsTab
                  stories={interruptionsState.stories}
                  processStories={interruptionsState.processStories}
                  clearStories={interruptionsState.clearStories}
                />
              </TabsContent>
              <TabsContent value="people" forceMount className={activeTab === 'people' ? 'block' : 'hidden'}>
                <PeopleTab />
              </TabsContent>
              <TabsContent value="past-huddles" forceMount className={activeTab === 'past-huddles' ? 'block' : 'hidden'}>
                <PastHuddlesTab />
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
};
