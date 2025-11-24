import { useEffect, useState } from 'react';
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

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className="min-h-screen bg-slate-950 text-white"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)'
      }}
    >
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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

        {/* Header + Tabs */}
        <div className={`sticky top-0 z-40 backdrop-blur-xl ${scrolled ? 'bg-white/95 dark:bg-slate-950/95 shadow-lg shadow-black/10 dark:shadow-black/20' : 'bg-white/90 dark:bg-slate-950/90'} border-b border-gray-200 dark:border-white/5`}>
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col gap-3 sm:gap-4 relative items-center text-center">
            <div className="flex flex-col items-center gap-2">
              <div className={`h-11 w-11 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-purple-500/20 mx-auto ${scrolled ? 'scale-95' : ''}`}>
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Huddle Assistant</p>
                <h1 className="text-base sm:text-lg md:text-xl font-display leading-tight text-slate-900 dark:text-white">Replies that stay human</h1>
              </div>
            </div>
            <div className="absolute right-3 top-3 flex items-center gap-3">
              {user?.email && (
                <div className="user-chip hidden sm:flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-slate-200">
                  <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
                  {user.email}
                </div>
              )}
            </div>

            <div className="relative w-full">
              <TabsList className="flex gap-2 overflow-x-auto bg-white/80 dark:bg-slate-900/80 border border-gray-200 dark:border-white/10 rounded-full p-1.5 backdrop-blur-md scrollbar-none relative shadow-md shadow-black/10 dark:shadow-black/30">
                <TabsTrigger
                  value="huddle-play"
                  className="flex items-center gap-2 text-slate-700 dark:text-white data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-white/10 rounded-full transition-all duration-200 font-sans text-xs sm:text-sm px-3.5 sm:px-4.5 py-2 shadow-sm data-[state=active]:shadow-lg"
                >
                  <MessageSquare className="w-4 h-4" />
                  Huddle
                </TabsTrigger>
                <TabsTrigger
                  value="interruptions"
                  className="flex items-center gap-2 text-slate-700 dark:text-white data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-white/10 rounded-full transition-all duration-200 font-sans text-xs sm:text-sm px-3.5 sm:px-4.5 py-2 shadow-sm data-[state=active]:shadow-lg"
                >
                  <Camera className="w-4 h-4" />
                  Interruptions
                </TabsTrigger>
                <TabsTrigger
                  value="people"
                  className="flex items-center gap-2 text-slate-700 dark:text-white data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-white/10 rounded-full transition-all duration-200 font-sans text-xs sm:text-sm px-3.5 sm:px-4.5 py-2 shadow-sm data-[state=active]:shadow-lg"
                >
                  <Users className="w-4 h-4" />
                  People
                </TabsTrigger>
                <TabsTrigger
                  value="past-huddles"
                  className="flex items-center gap-2 text-slate-700 dark:text-white data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-white/10 rounded-full transition-all duration-200 font-sans text-xs sm:text-sm px-3.5 sm:px-4.5 py-2 shadow-sm data-[state=active]:shadow-lg"
                >
                  <History className="w-4 h-4" />
                  History
                </TabsTrigger>
              </TabsList>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white via-white/60 to-transparent dark:from-slate-950 dark:via-slate-950/60 rounded-l-full" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white via-white/60 to-transparent dark:from-slate-950 dark:via-slate-950/60 rounded-r-full" />
            </div>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-5 sm:py-6">
          <div className="max-w-6xl mx-auto">
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
          </div>
        </div>
      </Tabs>
    </div>
  );
};
