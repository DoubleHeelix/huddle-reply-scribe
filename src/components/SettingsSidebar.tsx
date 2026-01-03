import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Settings, LogOut, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentProcessor } from "./DocumentProcessor";
import { documentService } from "@/services/documentService";
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
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem('theme_preference');
    return stored === 'light' ? 'light' : 'dark';
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
  }, [theme]);

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
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
          className="fixed top-4 right-4 z-50 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[540px] bg-gray-800 border-gray-700 text-white overflow-y-auto flex flex-col"
      >
        <div>
          <SheetHeader>
            <SheetTitle className="text-white">Settings</SheetTitle>
          </SheetHeader>

          <div className="border-b border-gray-700 pb-4 mb-4">
            <h3 className="text-sm text-gray-300 mb-2">Appearance</h3>
            <div className="flex gap-2">
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                className="flex items-center gap-2 bg-slate-900/80 border-white/10 text-white hover:bg-slate-800"
                onClick={() => setTheme('dark')}
              >
                <Moon className="w-4 h-4" />
                Dark
              </Button>
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                className="flex items-center gap-2 bg-white text-slate-900 border-white/40 hover:bg-slate-100"
                onClick={() => setTheme('light')}
              >
                <Sun className="w-4 h-4" />
                Light
              </Button>
            </div>
          </div>

          <div className="border-b border-gray-700 pb-4 mb-4">
            <h3 className="text-sm text-gray-300 mb-2">Huddle mode</h3>
            <div className="flex items-center justify-between bg-slate-900/60 border border-white/10 rounded-xl px-3 py-3">
              <div>
                <p className="text-white text-sm font-medium">Single vs Batch</p>
                <p className="text-xs text-gray-400">Batch lets you queue up to 5 screenshots for sequential replies.</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-white">
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
            <div className="border-t border-gray-700 pt-4 mt-4">
              <DocumentProcessor />
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
                <p className="text-xs text-gray-400 mt-2">
                  This will delete all processed documents and their embeddings. Use this before re-uploading documents after a chunking strategy change.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto border-t border-gray-700 pt-4">
          {user && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-white text-sm font-sans">{user.email}</span>
              </div>
              <Button
                onClick={onSignOut}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white font-sans h-8 px-2"
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
