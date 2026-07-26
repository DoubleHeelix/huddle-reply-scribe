import { lazy, Suspense, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, History, UserRound } from "lucide-react";
import { SettingsSidebar } from "@/components/SettingsSidebar";
import { HuddlePlayTab } from "@/components/HuddlePlayTab";
import { useHuddleState } from "@/hooks/useHuddleState";
import { useStyleProfile } from "@/hooks/useStyleProfile";
import { useAuth } from '@/hooks/useAuth';

const HistoryTab = lazy(() =>
  import("@/components/HistoryTab").then((module) => ({
    default: module.HistoryTab,
  })),
);
const ProfileStyleTab = lazy(() =>
  import("@/components/ProfileStyleTab").then((module) => ({
    default: module.ProfileStyleTab,
  })),
);
export const MainApp = () => {
  const { user, onSignOut, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("huddle-play");
  const [direction, setDirection] = useState(0);
  const huddleState = useHuddleState();
  const styleProfileState = useStyleProfile(user?.id);
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
    huddleMode,
    setHuddleMode,
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

  const navTabs = [
    { value: "huddle-play", label: "Reply", icon: MessageSquare },
    { value: "past-huddles", label: "History", icon: History },
    { value: "style-profile", label: "Profile", icon: UserRound },
  ];

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
    const tabOrder = navTabs.map(tab => tab.value);
    const oldIndex = tabOrder.indexOf(activeTab);
    const newIndex = tabOrder.indexOf(newTab);
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
      className="min-h-screen bg-background text-foreground"
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
          huddleMode={huddleMode}
          onHuddleModeChange={setHuddleMode}
        />

        {/* Header + Tabs */}
        <div className={`sticky top-0 z-40 backdrop-blur-xl ${scrolled ? 'bg-[#f4efe7]/95 dark:bg-[#0d0c0b]/95 shadow-lg shadow-[#4d3c2a]/10 dark:shadow-black/20' : 'bg-[#f4efe7]/90 dark:bg-[#0d0c0b]/90'} border-b border-[#826f56]/15 dark:border-white/10`}>
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col gap-3 sm:gap-4 relative items-center text-center">
            <div className="flex flex-col items-center gap-2">
              <div className={`h-11 w-11 rounded-xl bg-[#c49b5d] flex items-center justify-center shadow-lg shadow-[#c49b5d]/20 mx-auto transition-transform ${scrolled ? 'scale-95' : ''}`}>
                <MessageSquare className="w-5 h-5 text-[#071326]" />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-[#8f5b18] dark:text-[#d5aa67]">Huddle Assistant</p>
                <h1 className="text-base sm:text-lg md:text-xl font-display leading-tight text-[#29231c] dark:text-[#f4efe7]">Replies that stay human</h1>
              </div>
            </div>
            <div className="absolute right-16 top-3 flex items-center gap-3">
              {user?.email && (
                <div className="user-chip hidden sm:flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-slate-200">
                  <div className="h-2 w-2 rounded-full bg-[#c49b5d]"></div>
                  {user.email}
                </div>
              )}
            </div>

            <div className="relative w-full max-w-5xl mx-auto">
              <div className="absolute inset-0 -z-10 rounded-[26px] bg-[#c49b5d]/14 blur-xl" aria-hidden />
              <TabsList className="group relative grid w-full grid-cols-3 overflow-hidden rounded-[22px] bg-white/80 dark:bg-[#171513]/90 border border-[#826f56]/15 dark:border-white/10 px-1.5 py-1.5 backdrop-blur-2xl shadow-[0_15px_50px_-28px_rgba(77,60,42,0.4)]">
                {navTabs.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="group relative overflow-hidden rounded-full px-3 sm:px-4 py-2 text-[13px] sm:text-sm font-medium tracking-tight text-[#776b5d] dark:text-[#b4a89a] hover:text-[#29231c] dark:hover:text-[#f4efe7] transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#c49b5d]/50 focus-visible:outline-none data-[state=active]:text-[#071326] dark:data-[state=active]:text-[#071326]"
                  >
                    {activeTab === value && (
                      <motion.div
                        layoutId="tab-pill"
                        className="absolute inset-0 rounded-full bg-[#c49b5d] shadow-lg shadow-[#c49b5d]/25"
                        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2 px-0.5 group-hover:-translate-y-px transition-transform duration-150 ease-out">
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
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
                {activeTab === "huddle-play" && (
                <TabsContent value="huddle-play">
                  <HuddlePlayTab
                    huddleState={huddleState}
                    styleProfile={styleProfileState.profile}
                  />
                </TabsContent>
                )}
                <Suspense
                  fallback={
                    <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">
                      Loading…
                    </div>
                  }
                >
                  {activeTab === "past-huddles" && (
                    <TabsContent value="past-huddles">
                      <HistoryTab />
                    </TabsContent>
                  )}
                  {activeTab === "style-profile" && (
                    <TabsContent value="style-profile">
                      <ProfileStyleTab styleProfileState={styleProfileState} />
                    </TabsContent>
                  )}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Tabs>
    </div>
  );
};
