
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
        <SelectTrigger className="w-48 bg-gray-900 border-gray-600 text-white">
          <SelectValue placeholder="Adjust tone..." />
        </SelectTrigger>
        <SelectContent className="bg-gray-800 border-gray-600">
          {TONE_OPTIONS.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className="text-white hover:bg-gray-700"
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
        className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
        size="sm"
      >
        {isAdjusting ? 'Adjusting...' : 'Apply Tone'}
      </Button>
    </div>
  );
};
