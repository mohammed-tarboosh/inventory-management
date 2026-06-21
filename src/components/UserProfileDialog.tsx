/**
 * UserProfileDialog
 * ─────────────────
 * Dialog شاملة لإدارة الملف الشخصي:
 *  - عرض / تغيير الصورة الشخصية (Supabase Storage → avatars/{uid}/avatar.webp)
 *  - تعديل الاسم الكامل
 *  - تغيير كلمة المرور
 *  - استعراض الصلاحيات الفعالة
 */

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, usePermissions } from "@/lib/permissions";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Trash2,
  User,
  Lock,
  ShieldCheck,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";

const AVATAR_BUCKET = "avatars";

function getAvatarUrl(userId: string, bust?: number) {
  const { data } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(`${userId}/avatar.webp`);
  return bust ? `${data.publicUrl}?t=${bust}` : data.publicUrl;
}

// ─── Avatar component ─────────────────────────────────────────────────────────
function UserAvatar({
  userId,
  avatarUrl,
  name,
  size = "md",
  bust,
}: {
  userId?: string;
  avatarUrl?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
  bust?: number;
}) {
  const [imgErr, setImgErr] = useState(false);
  const sizeClass = { sm: "h-8 w-8 text-sm", md: "h-10 w-10 text-base", lg: "h-20 w-20 text-2xl" }[size];
  const initial = (name ?? "?")[0].toUpperCase();

  const src = avatarUrl && userId && !imgErr
    ? (avatarUrl.startsWith("http") ? (bust ? `${avatarUrl}?t=${bust}` : avatarUrl) : getAvatarUrl(userId, bust))
    : null;

  return (
    <div className={cn("rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden select-none font-bold text-primary", sizeClass)}>
      {src ? (
        <img src={src} alt={name ?? ""} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
      ) : (
        initial
      )}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = "profile" | "password" | "permissions";

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────
export function UserProfileDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const { perms } = usePermissions();
  const [tab, setTab] = useState<Tab>("profile");

  if (!user) return null;

  const uid = user.id;
  const profile = user.profile;
  const avatarUrl = profile?.avatar_url ?? null;

  const refetchUser = () => qc.invalidateQueries({ queryKey: ["current-user"] });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            {t("my_profile")}
          </DialogTitle>
        </DialogHeader>

        {/* بانر المستخدم */}
        <div className="flex items-center gap-4 px-6 py-4 bg-muted/40 border-b">
          <UserAvatar userId={uid} avatarUrl={avatarUrl} name={profile?.full_name ?? profile?.username} size="lg" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">
              {profile?.full_name || profile?.username}
            </p>
            <p className="text-sm text-muted-foreground truncate">@{profile?.username}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>

        {/* التابس */}
        <div className="flex gap-1 px-4 pt-3 pb-1">
          <TabButton active={tab === "profile"} onClick={() => setTab("profile")}>
            <User className="h-3.5 w-3.5" />
            {t("profile_info")}
          </TabButton>
          <TabButton active={tab === "password"} onClick={() => setTab("password")}>
            <Lock className="h-3.5 w-3.5" />
            {t("change_password")}
          </TabButton>
          <TabButton active={tab === "permissions"} onClick={() => setTab("permissions")}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {t("my_permissions")}
          </TabButton>
        </div>

        <div className="px-6 py-4 min-h-[240px]">
          {tab === "profile" && (
            <ProfileTab uid={uid} profile={profile} avatarUrl={avatarUrl} onDone={refetchUser} />
          )}
          {tab === "password" && <PasswordTab />}
          {tab === "permissions" && <PermissionsTab perms={perms} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab: Profile ─────────────────────────────────────────────────────────────
function ProfileTab({
  uid,
  profile,
  avatarUrl,
  onDone,
}: {
  uid: string;
  profile: any;
  avatarUrl: string | null;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [bust, setBust] = useState<number | undefined>();

  // ── رفع صورة ──
  const handleAvatarUpload = useCallback(async (file: File) => {
    if (!file) return;

    // تحقق من الحجم (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("avatar_too_large"));
      return;
    }

    setUploading(true);
    try {
      // تحويل إلى WebP عبر Canvas لتوحيد الصيغة وتقليل الحجم
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const MAX = 400;
      const ratio = Math.min(MAX / bitmap.width, MAX / bitmap.height, 1);
      canvas.width = Math.round(bitmap.width * ratio);
      canvas.height = Math.round(bitmap.height * ratio);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/webp", 0.88));

      // رفع للـ storage — upsert يستبدل القديم
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(`${uid}/avatar.webp`, blob, {
          contentType: "image/webp",
          upsert: true,
          cacheControl: "no-cache",
        });
      if (upErr) throw upErr;

      // حفظ URL في الـ profile
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(`${uid}/avatar.webp`);
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", uid);
      if (dbErr) throw dbErr;

      setBust(Date.now());
      onDone();
      toast.success(t("avatar_updated"));
    } catch (e: any) {
      toast.error(e.message ?? t("save_error"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [uid, t, onDone]);

  // ── حذف صورة ──
  const handleAvatarDelete = async () => {
    setUploading(true);
    try {
      await supabase.storage.from("avatars").remove([`${uid}/avatar.webp`]);
      await supabase.from("profiles").update({ avatar_url: null }).eq("id", uid);
      onDone();
      toast.success(t("avatar_removed"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  // ── حفظ الاسم ──
  const handleSaveName = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName || null })
      .eq("id", uid);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(t("save_success")); onDone(); }
  };

  return (
    <div className="space-y-5">
      {/* Avatar section */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <UserAvatar userId={uid} avatarUrl={avatarUrl} name={profile?.full_name ?? profile?.username} size="lg" bust={bust} />
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="gap-2"
          >
            <Camera className="h-3.5 w-3.5" />
            {avatarUrl ? t("change_avatar") : t("upload_avatar")}
          </Button>
          {avatarUrl && (
            <Button
              size="sm"
              variant="ghost"
              disabled={uploading}
              onClick={handleAvatarDelete}
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("remove_avatar")}
            </Button>
          )}
          <p className="text-[11px] text-muted-foreground">{t("avatar_hint")}</p>
        </div>
      </div>

      {/* الاسم الكامل */}
      <div className="space-y-1.5">
        <Label>{t("full_name")}</Label>
        <div className="flex gap-2">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={profile?.username}
          />
          <Button onClick={handleSaveName} disabled={saving} className="shrink-0">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
          </Button>
        </div>
      </div>

      {/* معلومات ثابتة (للعرض فقط) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("username")}</Label>
          <p className="text-sm font-medium">{profile?.username}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("email")}</Label>
          <p className="text-sm font-medium truncate">{profile?.email ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Password ────────────────────────────────────────────────────────────
function PasswordTab() {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const valid = next.length >= 8 && next === confirm;

  const handleSubmit = async () => {
    if (!valid) return;
    setLoading(true);
    // Supabase: تغيير كلمة المرور للمستخدم الحالي
    const { error } = await supabase.auth.updateUser({ password: next });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setDone(true);
      setCurrent(""); setNext(""); setConfirm("");
      toast.success(t("password_changed"));
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <p className="font-medium">{t("password_changed")}</p>
        <p className="text-sm text-muted-foreground">{t("password_changed_hint")}</p>
        <Button variant="outline" size="sm" onClick={() => setDone(false)}>
          {t("change_again")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* كلمة المرور الجديدة */}
      <div className="space-y-1.5">
        <Label>{t("new_password")}</Label>
        <div className="relative">
          <Input
            type={showNew ? "text" : "password"}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="••••••••"
            className="pe-10"
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground"
          >
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {/* مؤشر القوة */}
        {next && (
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4].map((lvl) => {
              const strength = next.length >= 12 ? 4 : next.length >= 10 ? 3 : next.length >= 8 ? 2 : 1;
              return (
                <div
                  key={lvl}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    lvl <= strength
                      ? strength <= 1 ? "bg-destructive" : strength === 2 ? "bg-yellow-400" : strength === 3 ? "bg-blue-400" : "bg-green-500"
                      : "bg-muted",
                  )}
                />
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">{t("password_min_length")}</p>
      </div>

      {/* تأكيد */}
      <div className="space-y-1.5">
        <Label>{t("confirm_password")}</Label>
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className={cn(confirm && !valid && confirm.length > 0 && next !== confirm ? "border-destructive" : "")}
        />
        {confirm && next !== confirm && (
          <p className="text-xs text-destructive">{t("passwords_no_match")}</p>
        )}
      </div>

      <Button onClick={handleSubmit} disabled={!valid || loading} className="w-full gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {t("change_password")}
      </Button>
    </div>
  );
}

// ─── Tab: Permissions ─────────────────────────────────────────────────────────
const PERM_CATEGORIES: Record<string, { ar: string; en: string }> = {
  system:    { ar: "النظام",       en: "System" },
  users:     { ar: "المستخدمون",   en: "Users" },
  items:     { ar: "الأصناف",      en: "Items" },
  invoices:  { ar: "الفواتير",     en: "Invoices" },
  customers: { ar: "العملاء",      en: "Customers" },
  suppliers: { ar: "الموردون",     en: "Suppliers" },
  debts:     { ar: "الحسابات",     en: "Accounts" },
  reports:   { ar: "التقارير",     en: "Reports" },
  settings:  { ar: "الإعدادات",    en: "Settings" },
};

const PERM_LABELS: Record<string, { ar: string; en: string }> = {
  "system.admin":        { ar: "مسؤول النظام",        en: "System Admin" },
  "users.manage":        { ar: "إدارة المستخدمين",    en: "Manage Users" },
  "permissions.manage":  { ar: "إدارة الصلاحيات",     en: "Manage Permissions" },
  "settings.view":       { ar: "عرض الإعدادات",       en: "View Settings" },
  "settings.manage":     { ar: "إدارة الإعدادات",     en: "Manage Settings" },
  "items.view":          { ar: "عرض الأصناف",         en: "View Items" },
  "items.manage":        { ar: "إدارة الأصناف",       en: "Manage Items" },
  "items.import":        { ar: "استيراد الأصناف",     en: "Import Items" },
  "invoices.view":       { ar: "عرض الفواتير",        en: "View Invoices" },
  "invoices.manage":     { ar: "إدارة الفواتير",      en: "Manage Invoices" },
  "customers.view":      { ar: "عرض العملاء",         en: "View Customers" },
  "customers.manage":    { ar: "إدارة العملاء",       en: "Manage Customers" },
  "suppliers.view":      { ar: "عرض الموردين",        en: "View Suppliers" },
  "suppliers.manage":    { ar: "إدارة الموردين",      en: "Manage Suppliers" },
  "debts.view":          { ar: "عرض الحسابات",        en: "View Accounts" },
  "debts.manage":        { ar: "إدارة الحسابات",      en: "Manage Accounts" },
  "reports.view":        { ar: "عرض التقارير",        en: "View Reports" },
};

function PermissionsTab({ perms }: { perms: string[] }) {
  const { locale } = useI18n();
  const isAdmin = perms.includes("system.admin");

  // تجميع الصلاحيات حسب التصنيف
  const grouped = perms.reduce<Record<string, string[]>>((acc, key) => {
    const cat = key.split(".")[0];
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(key);
    return acc;
  }, {});

  if (perms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <ShieldCheck className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">لا توجد صلاحيات مخصصة</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto pe-1">
      {isAdmin && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-primary">
            {locale === "ar" ? "مسؤول النظام — جميع الصلاحيات" : "System Admin — Full Access"}
          </span>
        </div>
      )}
      {Object.entries(grouped).map(([cat, keys]) => (
        <div key={cat}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            {PERM_CATEGORIES[cat]?.[locale === "ar" ? "ar" : "en"] ?? cat}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {keys.map((key) => (
              <Badge key={key} variant="secondary" className="text-xs gap-1 font-normal">
                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                {PERM_LABELS[key]?.[locale === "ar" ? "ar" : "en"] ?? key}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Export re-usable avatar ──────────────────────────────────────────────────
export { UserAvatar };
