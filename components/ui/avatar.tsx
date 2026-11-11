import { cn, getInitials, generateAvatarUrl } from '@/lib/utils';
import Image from 'next/image';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  id?: string;
}

const sizeMap = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

const pixelMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

export function Avatar({ src, name, size = 'md', className, id }: AvatarProps) {
  const fallback = generateAvatarUrl(name, id);
  const imgSrc = src || fallback;
  const px = pixelMap[size];

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-full bg-brand-100',
        sizeMap[size],
        className,
      )}
    >
      <Image
        src={imgSrc}
        alt={name}
        width={px}
        height={px}
        // Next's image optimizer refuses SVGs (the generated fallback avatars are SVG)
        unoptimized={/dicebear|\.svg(\?|$)/i.test(imgSrc)}
        className="h-full w-full object-cover"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = `<span class="absolute inset-0 flex items-center justify-center font-semibold text-brand-700">${getInitials(name)}</span>`;
          }
        }}
      />
    </div>
  );
}

interface AvatarGroupProps {
  users: Array<{ id?: string; name: string; avatar?: string | null }>;
  max?: number;
  size?: AvatarProps['size'];
}

export function AvatarGroup({ users, max = 3, size = 'sm' }: AvatarGroupProps) {
  const shown = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className="flex -space-x-2">
      {shown.map((u, i) => (
        <div key={u.id || i} className="rounded-full ring-2 ring-white">
          <Avatar src={u.avatar} name={u.name} size={size} id={u.id} />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-gray-200 font-medium text-gray-600 ring-2 ring-white',
            sizeMap[size],
          )}
        >
          <span className="text-[10px]">+{remaining}</span>
        </div>
      )}
    </div>
  );
}
