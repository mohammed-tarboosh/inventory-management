/**
 * UserAvatar
 * ──────────
 * يعرض صورة المستخدم أو الحرف الأول من اسمه كـ fallback.
 * الأحجام: sm (32px) | md (40px) | lg (64px) | xl (80px)
 */
import { useState } from "react";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-16 w-16 text-xl",
  xl: "h-20 w-20 text-2xl",
};

interface UserAvatarProps {
  userId?: string;
  avatarUrl?: string | null;
  name?: string | null;
  size?: Size;
  /** cache-bust timestamp — يُمرَّر بعد رفع صورة جديدة */
  bust?: number;
  className?: string;
  /** callback اختياري — لا يُستخدم هنا، للتوافق مع profile page */
  onDone?: () => void;
}

export function UserAvatar({
  userId,
  avatarUrl,
  name,
  size = "md",
  bust,
  className,
}: UserAvatarProps) {
  const [imgErr, setImgErr] = useState(false);
  const initial = (name ?? userId ?? "?")[0].toUpperCase();

  // أضف timestamp لكسر cache عند الحاجة
  const src =
    avatarUrl && !imgErr
      ? bust
        ? `${avatarUrl}?t=${bust}`
        : avatarUrl
      : null;

  return (
    <div
      className={cn(
        "rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden select-none font-bold text-primary",
        SIZE_CLASS[size],
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={name ?? ""}
          className="w-full h-full object-cover"
          onError={() => setImgErr(true)}
        />
      ) : (
        initial
      )}
    </div>
  );
}
