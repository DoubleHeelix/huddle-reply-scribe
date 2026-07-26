
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface ToneSelectorProps {
  selectedTone: string;
  onToneChange: (tone: string) => void;
  onApplyTone: () => void;
  isAdjusting: boolean;
  disabled: boolean;
}

const TONE_OPTIONS = [
  { value: 'none', label: 'Original Tone' },
  { value: 'casual', label: 'More Casual' },
  { value: 'professional', label: 'More Professional' },
  { value: 'friendly', label: 'More Friendly' },
  { value: 'direct', label: 'More Direct' },
  { value: 'warm', label: 'Warmer' },
  { value: 'confident', label: 'More Confident' },
  { value: 'curious', label: 'More Curious' }
];

export const ToneSelector = ({ 
  selectedTone, 
  onToneChange, 
  onApplyTone, 
  isAdjusting, 
  disabled 
}: ToneSelectorProps) => {
  return (
    <div className="flex gap-2 items-center">
      <Select value={selectedTone} onValueChange={onToneChange} disabled={disabled}>
        <SelectTrigger className="w-48 border-[#826f56]/15 bg-white/80 text-[#29231c] dark:border-white/10 dark:bg-[#0d0c0b]/70 dark:text-[#f4efe7]">
          <SelectValue placeholder="Adjust tone..." />
        </SelectTrigger>
        <SelectContent className="border-[#826f56]/15 bg-[#fffcf7] dark:border-white/10 dark:bg-[#171513]">
          {TONE_OPTIONS.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className="text-[#29231c] focus:bg-[#efe7dc] focus:text-[#29231c] dark:text-[#f4efe7] dark:focus:bg-white/[0.08] dark:focus:text-[#f4efe7]"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Button
        onClick={onApplyTone}
        disabled={disabled || selectedTone === 'none' || isAdjusting}
        variant="outline"
        className="border-[#c49b5d] bg-[#c49b5d] text-[#071326] hover:bg-[#b58a52]"
        size="sm"
      >
        {isAdjusting ? 'Adjusting...' : 'Apply Tone'}
      </Button>
    </div>
  );
};
