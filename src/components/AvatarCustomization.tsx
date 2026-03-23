import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#6366f1', '#a855f7', '#64748b',
];

const PERSON_EMOJIS = [
  // People of all skin tones
  '👶🏻','👶🏼','👶🏽','👶🏾','👶🏿','🧒🏻','🧒🏼','🧒🏽','🧒🏾','🧒🏿',
  '👦🏻','👦🏼','👦🏽','👦🏾','👦🏿','👧🏻','👧🏼','👧🏽','👧🏾','👧🏿',
  '🧑🏻','🧑🏼','🧑🏽','🧑🏾','🧑🏿','👱🏻','👱🏼','👱🏽','👱🏾','👱🏿',
  '👨🏻','👨🏼','👨🏽','👨🏾','👨🏿','👩🏻','👩🏼','👩🏽','👩🏾','👩🏿',
  '🧓🏻','🧓🏼','🧓🏽','🧓🏾','🧓🏿','👴🏻','👴🏼','👴🏽','👴🏾','👴🏿',
  '👵🏻','👵🏼','👵🏽','👵🏾','👵🏿',
  // Professions
  '👮🏻','👮🏼','👮🏽','👮🏾','👮🏿','💂🏻','💂🏼','💂🏽','💂🏾','💂🏿',
  '🕵🏻','🕵🏼','🕵🏽','🕵🏾','🕵🏿','👷🏻','👷🏼','👷🏽','👷🏾','👷🏿',
  '🧑‍⚕️','👨‍⚕️','👩‍⚕️','🧑‍🎓','👨‍🎓','👩‍🎓',
  '🧑‍🏫','👨‍🏫','👩‍🏫','🧑‍⚖️','👨‍⚖️','👩‍⚖️',
  '🧑‍🌾','👨‍🌾','👩‍🌾','🧑‍🍳','👨‍🍳','👩‍🍳',
  '🧑‍🔧','👨‍🔧','👩‍🔧','🧑‍🏭','👨‍🏭','👩‍🏭',
  '🧑‍💼','👨‍💼','👩‍💼','🧑‍🔬','👨‍🔬','👩‍🔬',
  '🧑‍🎨','👨‍🎨','👩‍🎨','🧑‍🚒','👨‍🚒','👩‍🚒',
  '🧑‍✈️','👨‍✈️','👩‍✈️','🧑‍🚀','👨‍🚀','👩‍🚀',
  // Fantasy
  '🧙🏻','🧙🏼','🧙🏽','🧙🏾','🧙🏿','🧚🏻','🧚🏼','🧚🏽','🧚🏾','🧚🏿',
  '🧛🏻','🧛🏼','🧛🏽','🧛🏾','🧛🏿','🧜🏻','🧜🏼','🧜🏽','🧜🏾','🧜🏿',
  '🧝🏻','🧝🏼','🧝🏽','🧝🏾','🧝🏿','🦸🏻','🦸🏼','🦸🏽','🦸🏾','🦸🏿',
  '🦹🏻','🦹🏼','🦹🏽','🦹🏾','🦹🏿',
  // Activities
  '🏃🏻','🏃🏼','🏃🏽','🏃🏾','🏃🏿','🚶🏻','🚶🏼','🚶🏽','🚶🏾','🚶🏿',
  '🧗🏻','🧗🏼','🧗🏽','🧗🏾','🧗🏿','🏋🏻','🏋🏼','🏋🏽','🏋🏾','🏋🏿',
  '⛹🏻','⛹🏼','⛹🏽','⛹🏾','⛹🏿','🤸🏻','🤸🏼','🤸🏽','🤸🏾','🤸🏿',
  '🏊🏻','🏊🏼','🏊🏽','🏊🏾','🏊🏿','🚴🏻','🚴🏼','🚴🏽','🚴🏾','🚴🏿',
  '🧘🏻','🧘🏼','🧘🏽','🧘🏾','🧘🏿',
];

interface AvatarCustomizationProps {
  avatarColor: string;
  avatarEmoji: string | null;
  initial: string;
  onColorChange: (color: string) => void;
  onEmojiChange: (emoji: string) => void;
}

export default function AvatarCustomization({
  avatarColor,
  avatarEmoji,
  initial,
  onColorChange,
  onEmojiChange,
}: AvatarCustomizationProps) {
  const { t } = useTranslation();
  const isEmojiActive = !!avatarEmoji;
  const [colorOpen, setColorOpen] = useState(!isEmojiActive);
  const [emojiOpen, setEmojiOpen] = useState(isEmojiActive);

  const handleColorSelect = (color: string) => {
    onColorChange(color);
    setColorOpen(true);
    setEmojiOpen(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    onEmojiChange(emoji);
    setEmojiOpen(true);
    setColorOpen(false);
  };

  return (
    <div className="space-y-3">
      <Collapsible open={colorOpen} onOpenChange={setColorOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-foreground">
          <span>{t('profile.myColour')}</span>
          <ChevronDown size={16} className={`text-muted-foreground transition-transform ${colorOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => handleColorSelect(c)}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                  !isEmojiActive && avatarColor === c
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-card scale-110'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              >
                <span className="text-white font-bold text-xs">{initial}</span>
              </button>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={emojiOpen} onOpenChange={setEmojiOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-foreground">
          <span>{t('profile.myEmoji')}</span>
          <ChevronDown size={16} className={`text-muted-foreground transition-transform ${emojiOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="max-h-48 overflow-y-auto pt-2">
            <div className="grid grid-cols-8 gap-1">
              {PERSON_EMOJIS.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => handleEmojiSelect(emoji)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                    avatarEmoji === emoji
                      ? 'bg-primary/20 ring-2 ring-primary scale-110'
                      : 'hover:bg-secondary'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
