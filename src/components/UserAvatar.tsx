import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface UserAvatarProps {
  avatarUrl?: string | null;
  avatarColor?: string | null;
  avatarEmoji?: string | null;
  firstName?: string | null;
  className?: string;
  textClassName?: string;
}

export default function UserAvatar({
  avatarUrl,
  avatarColor,
  avatarEmoji,
  firstName,
  className = 'w-8 h-8',
  textClassName = 'text-xs',
}: UserAvatarProps) {
  const initial = (firstName || '?')[0].toUpperCase();
  const color = avatarColor || '#3b82f6';

  if (avatarUrl) {
    return (
      <Avatar className={className}>
        <AvatarImage src={avatarUrl} />
        <AvatarFallback style={{ backgroundColor: color }} className={`text-white font-bold ${textClassName}`}>
          {initial}
        </AvatarFallback>
      </Avatar>
    );
  }

  if (avatarEmoji) {
    return (
      <div className={`${className} rounded-full bg-secondary flex items-center justify-center`}>
        <span className={textClassName} role="img">{avatarEmoji}</span>
      </div>
    );
  }

  return (
    <Avatar className={className}>
      <AvatarFallback style={{ backgroundColor: color }} className={`text-white font-bold ${textClassName}`}>
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
