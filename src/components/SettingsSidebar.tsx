import { lazy, Suspense, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Settings, LogOut, Sun, Moon, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { syncNativeTheme } from "@/utils/nativeApp";

const DocumentProcessor = lazy(() =>
  import("./DocumentProcessor").then((module) => ({
    default: module.DocumentProcessor,
  })),
);

interface SettingsSidebarProps {
  googleCloudApiKey: string;
  onGoogleCloudApiKeyChange: (key: string) => void;
  enableAutoCropping: boolean;
  onAutoCroppingChange: (enabled: boolean) => void;
  autoCropMargin: number;
  onAutoCropMarginChange: (margin: number) => void;
  onTestOCR?: () => void;
  isTestingOCR: boolean;
  uploadedImage: string | null;
  user: User | null;
  onSignOut: () => void;
  isAdmin: boolean;
  huddleMode: 'single' | 'batch';
  onHuddleModeChange: (mode: 'single' | 'batch') => void;
}

export const SettingsSidebar = ({
  user,
  onSignOut,
  isAdmin,
  huddleMode,
  onHuddleModeChange,
}: SettingsSidebarProps) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem('theme_preference');
    return stored === 'dark' ? 'dark' : 'light';
  });

  // Sync theme to document and localStorage.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.add('dark');
    }
    localStorage.setItem('theme_preference', theme);
    void syncNativeTheme(theme);
  }, [theme]);

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      const { documentService } = await import("@/services/documentService");
      await documentService.deleteAllDocuments();
      toast({
        title: "Success",
        description: "All documents have been deleted. You can now re-upload them.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete documents. Please check the console for details.",
        variant: "destructive",
      });
      console.error("Failed to delete all documents:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Open settings"
          className="fixed top-4 right-4 z-50 border border-[#1b2f4a] bg-[#071326] text-[#f4efe7] hover:bg-[#1b2f4a] dark:border-[#c49b5d]/40 dark:bg-[#c49b5d] dark:text-[#0d0c0b] dark:hover:bg-[#d5aa67]"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[540px] border-l border-[#826f56]/15 bg-[#fffcf7] text-[#29231c] overflow-y-auto flex flex-col dark:border-white/10 dark:bg-[#171513] dark:text-[#f4efe7]"
      >
        <div>
          <SheetHeader>
            <SheetTitle className="text-[#29231c] dark:text-[#f4efe7]">Settings</SheetTitle>
            <SheetDescription className="text-[#776b5d] dark:text-[#b4a89a]">
              Appearance, huddle mode, and account tools.
            </SheetDescription>
          </SheetHeader>

          <div className="border-b border-[#826f56]/15 pb-4 mb-4 dark:border-white/10">
            <h3 className="text-sm text-[#776b5d] mb-2 dark:text-[#b4a89a]">Appearance</h3>
            <div className="flex gap-2">
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                className={theme === 'dark'
                  ? "flex items-center gap-2 border-[#071326] bg-[#071326] text-[#f4efe7] hover:bg-[#1b2f4a]"
                  : "flex items-center gap-2 border-[#826f56]/15 bg-white/70 text-[#29231c] hover:bg-[#efe7dc] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#f4efe7] dark:hover:bg-white/[0.08]"}
                onClick={() => setTheme('dark')}
              >
                <Moon className="w-4 h-4" />
                Dark
              </Button>
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                className={theme === 'light'
                  ? "flex items-center gap-2 border-[#c49b5d] bg-[#c49b5d] text-[#071326] hover:bg-[#b58a52]"
                  : "flex items-center gap-2 border-[#826f56]/15 bg-white/70 text-[#29231c] hover:bg-[#efe7dc] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#f4efe7] dark:hover:bg-white/[0.08]"}
                onClick={() => setTheme('light')}
              >
                <Sun className="w-4 h-4" />
                Light
              </Button>
            </div>
          </div>

          <div className="border-b border-[#826f56]/15 pb-4 mb-4 dark:border-white/10">
            <h3 className="text-sm text-[#776b5d] mb-2 dark:text-[#b4a89a]">Huddle mode</h3>
            <div className="flex flex-col gap-3 bg-white/70 border border-[#826f56]/15 rounded-xl px-3 py-3 dark:border-white/10 dark:bg-black/20">
              <div>
                <p className="text-[#29231c] text-sm font-medium dark:text-[#f4efe7]">Single vs Batch</p>
                <p className="text-xs text-[#776b5d] dark:text-[#b4a89a]">Batch lets you queue up to 5 screenshots for sequential replies.</p>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-[#826f56]/10 pt-3 text-sm text-[#29231c] dark:border-white/10 dark:text-[#f4efe7]">
                Single
                <Switch
                  checked={huddleMode === 'batch'}
                  onCheckedChange={(checked) => onHuddleModeChange(checked ? 'batch' : 'single')}
                />
                Batch
              </div>
            </div>
          </div>
          
          {isAdmin && (
            <div className="border-t border-[#826f56]/15 pt-4 mt-4 dark:border-white/10">
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#a97d45] dark:text-[#d5aa67]" />
                  <h3 className="text-lg font-semibold text-[#29231c] dark:text-[#f4efe7]">
                    Admin Tools
                  </h3>
                  <Badge className="border border-[#c49b5d]/30 bg-[#c49b5d]/12 text-[#8f5b18] dark:text-[#d5aa67]">
                    Administrator
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-[#776b5d] dark:text-[#b4a89a]">
                  Manage the shared knowledge base and protected document data.
                </p>
              </div>
              <Suspense
                fallback={
                  <p className="text-sm text-[#776b5d] dark:text-[#b4a89a]">
                    Loading document tools…
                  </p>
                }
              >
                <DocumentProcessor />
              </Suspense>
               <div className="mt-4">
                <h3 className="text-lg font-semibold mb-2">Danger Zone</h3>
                 <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isDeleting}>
                      {isDeleting ? "Deleting..." : "Delete All Documents"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete all document knowledge from the database and all associated files from storage.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAll}>
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <p className="text-xs text-[#776b5d] mt-2 dark:text-[#b4a89a]">
                  This will delete all processed documents and their embeddings. Use this before re-uploading documents after a chunking strategy change.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto border-t border-[#826f56]/15 pt-4 dark:border-white/10">
          {user && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#348f6a] rounded-full"></div>
                <span className="text-[#29231c] text-sm font-sans dark:text-[#f4efe7]">{user.email}</span>
              </div>
              <Button
                onClick={onSignOut}
                variant="ghost"
                size="sm"
                className="text-[#776b5d] hover:text-[#29231c] font-sans h-8 px-2 dark:text-[#b4a89a] dark:hover:text-[#f4efe7]"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
