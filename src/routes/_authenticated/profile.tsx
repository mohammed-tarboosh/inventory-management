import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, usePermissions } from "@/lib/permissions";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
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
import { useCallback, useRef, useState } from "react";

export const Route = createFileRoute("/_authenticated/profile")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: ProfilePage,
});

type Tab = "profile" | "password" | "permissions";

function ProfilePage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("profile");
  const { data: user } = useCurrentUser();
  const { perms } = usePermissions();
  const qc = useQueryClient();

  const refetchUser = () => qc.invalidateQueries({ queryKey: ["current-user"] });

  if (!user) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile",     label: t("profile_info"),    icon: <User className="h-4 w-4" /> },
    { id: "password",    label: t("change_password"), icon: <Lock className="h-4 w-4" /> },
    { id: "permissions", label: t("my_permissions"),  icon: <ShieldCheck className="h-4 w-4" /> },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header البروفايل */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* غطاء ملوّن */}
        <div className="h-24 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent" />
        {/* معلومات المستخدم */}
        <div className="px-6 pb-5 -mt-10 flex items-end gap-4">
          <div className="relative shrink-0">
            <UserAvatar
              userId={user.id}
              avatarUrl={user.profile?.avatar_url}
              name={user.profile?.full_name ?? user.profile?.username}
              size="xl"
              onDone={refetchUser}
            />
          </div>
          <div className="pb-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">
              {user.profile?.full_name ?? user.profile?.username}
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              @{user.profile?.username} · {user.email}
            </p>
          </div>
        </div>
      </div>

      {/* التابات */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-150",
              tab === tb.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tb.icon}
            <span className="hidden sm:inline">{tb.label}</span>
          </button>
        ))}
      </div>

      {/* محتوى التاب */}
      <div className="rounded-xl border bg-card p-6">
        {tab === "profile"     && <ProfileTab uid={user.id} profile={user.profile} onDone={refetchUser} />}
        {tab === "password"    && <PasswordTab />}
        {tab === "permissions" && <PermissionsTab perms={perms} />}
      </div>
    </div>
  );
}

// ─── Tab: Profile ─────────────────────────────────────────────────────────────
function ProfileTab({ uid, profile, onDone }: { uid: string; profile: any; onDone: () => void }) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [bust, setBust] = useState<number | undefined>();

  const handleAvatarUpload = useCallback(async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error(t("avatar_too_large")); return; }
    setUploading(true);
    try {
      // ضغط وتحويل لـ WebP عبر Canvas
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const MAX = 400;
      const ratio = Math.min(MAX / bitmap.width, MAX / bitmap.height, 1);
      canvas.width  = Math.round(bitmap.width  * ratio);
      canvas.height = Math.round(bitmap.height * ratio);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/webp", 0.88));

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(`${uid}/avatar.webp`, blob, { contentType: "image/webp", upsert: true, cacheControl: "no-cache" });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(`${uid}/avatar.webp`);
      const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", uid);
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

  const handleAvatarDelete = async () => {
    setUploading(true);
    try {
      await supabase.storage.from("avatars").remove([`${uid}/avatar.webp`]);
      await supabase.from("profiles").update({ avatar_url: null }).eq("id", uid);
      onDone();
      toast.success(t("avatar_removed"));
    } catch (e: any) {
      toast.error(e.message);
    } finally { setUploading(false); }
  };

  const handleSaveName = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName || null }).eq("id", uid);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(t("save_success")); onDone(); }
  };

  return (
    <div className="space-y-6">
      {/* الصورة الشخصية */}
      <div>
        <Label className="text-sm font-medium mb-3 block">{t("profile_photo")}</Label>
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <UserAvatar
              userId={uid}
              avatarUrl={profile?.avatar_url}
              name={profile?.full_name ?? profile?.username}
              size="lg"
              bust={bust}
            />
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
            />
            <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()} className="gap-2 w-full sm:w-auto">
              <Camera className="h-3.5 w-3.5" />
              {profile?.avatar_url ? t("change_avatar") : t("upload_avatar")}
            </Button>
            {profile?.avatar_url && (
              <Button size="sm" variant="ghost" disabled={uploading} onClick={handleAvatarDelete}
                className="gap-2 w-full sm:w-auto text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" />
                {t("remove_avatar")}
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">{t("avatar_hint")}</p>
          </div>
        </div>
      </div>

      <div className="border-t" />

      {/* الاسم الكامل */}
      <div className="space-y-1.5">
        <Label>{t("full_name")}</Label>
        <div className="flex gap-2">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={profile?.username} className="flex-1" />
          <Button onClick={handleSaveName} disabled={saving} className="shrink-0">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
          </Button>
        </div>
      </div>

      {/* معلومات ثابتة */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("username")}</Label>
          <p className="text-sm font-medium bg-muted/50 rounded-lg px-3 py-2">{profile?.username}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("email")}</Label>
          <p className="text-sm font-medium bg-muted/50 rounded-lg px-3 py-2 truncate">{profile?.email ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Password ────────────────────────────────────────────────────────────
function PasswordTab() {
  const { t } = useI18n();
  const [next, setNext]       = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  const strength = next.length === 0 ? 0 : next.length >= 12 ? 4 : next.length >= 10 ? 3 : next.length >= 8 ? 2 : 1;
  const strengthColor = ["", "bg-destructive", "bg-yellow-400", "bg-blue-400", "bg-green-500"][strength];
  const valid = next.length >= 8 && next === confirm;

  const handleSubmit = async () => {
    if (!valid) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: next });
    setLoading(false);
    if (error) toast.error(error.message);
    else { setDone(true); setNext(""); setConfirm(""); toast.success(t("password_changed")); }
  };

  if (done) return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-green-500" />
      </div>
      <div>
        <p className="font-semibold text-base">{t("password_changed")}</p>
        <p className="text-sm text-muted-foreground mt-1">{t("password_changed_hint")}</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => setDone(false)}>{t("change_again")}</Button>
    </div>
  );

  return (
    <div className="space-y-5 max-w-sm">
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
          <button type="button" onClick={() => setShowNew(!showNew)}
            className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground">
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {/* مؤشر القوة */}
        {next.length > 0 && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[1,2,3,4].map((lvl) => (
                <div key={lvl} className={cn("h-1 flex-1 rounded-full transition-all duration-300", lvl <= strength ? strengthColor : "bg-muted")} />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{t("password_min_length")}</p>
          </div>
        )}
      </div>

      {/* تأكيد */}
      <div className="space-y-1.5">
        <Label>{t("confirm_password")}</Label>
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className={cn(confirm.length > 0 && next !== confirm ? "border-destructive focus-visible:ring-destructive" : "")}
        />
        {confirm.length > 0 && next !== confirm && (
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
  system:    { ar: "النظام",      en: "System" },
  users:     { ar: "المستخدمون", en: "Users" },
  items:     { ar: "الأصناف",    en: "Items" },
  invoices:  { ar: "الفواتير",   en: "Invoices" },
  customers: { ar: "العملاء",    en: "Customers" },
  suppliers: { ar: "الموردون",   en: "Suppliers" },
  debts:     { ar: "الحسابات",   en: "Accounts" },
  reports:   { ar: "التقارير",   en: "Reports" },
  settings:  { ar: "الإعدادات", en: "Settings" },
};

const PERM_LABELS: Record<string, { ar: string; en: string }> = {
  "system.admin":       { ar: "مسؤول النظام",      en: "System Admin" },
  "users.manage":       { ar: "إدارة المستخدمين",  en: "Manage Users" },
  "permissions.manage": { ar: "إدارة الصلاحيات",   en: "Manage Permissions" },
  "settings.view":      { ar: "عرض الإعدادات",     en: "View Settings" },
  "settings.manage":    { ar: "إدارة الإعدادات",   en: "Manage Settings" },
  "items.view":         { ar: "عرض الأصناف",       en: "View Items" },
  "items.manage":       { ar: "إدارة الأصناف",     en: "Manage Items" },
  "items.import":       { ar: "استيراد الأصناف",   en: "Import Items" },
  "invoices.view":      { ar: "عرض الفواتير",      en: "View Invoices" },
  "invoices.manage":    { ar: "إدارة الفواتير",    en: "Manage Invoices" },
  "customers.view":     { ar: "عرض العملاء",       en: "View Customers" },
  "customers.manage":   { ar: "إدارة العملاء",     en: "Manage Customers" },
  "suppliers.view":     { ar: "عرض الموردين",      en: "View Suppliers" },
  "suppliers.manage":   { ar: "إدارة الموردين",    en: "Manage Suppliers" },
  "debts.view":         { ar: "عرض الحسابات",      en: "View Accounts" },
  "debts.manage":       { ar: "إدارة الحسابات",    en: "Manage Accounts" },
  "reports.view":       { ar: "عرض التقارير",      en: "View Reports" },
};

function PermissionsTab({ perms }: { perms: string[] }) {
  const { locale } = useI18n();
  const isAdmin = perms.includes("system.admin");

  const grouped = perms.reduce<Record<string, string[]>>((acc, key) => {
    const cat = key.split(".")[0];
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(key);
    return acc;
  }, {});

  if (perms.length === 0) return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <ShieldCheck className="h-12 w-12 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">لا توجد صلاحيات مخصصة</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {isAdmin && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-primary">
              {locale === "ar" ? "مسؤول النظام" : "System Admin"}
            </p>
            <p className="text-xs text-primary/70">
              {locale === "ar" ? "صلاحية وصول كاملة لجميع أقسام النظام" : "Full access to all system sections"}
            </p>
          </div>
        </div>
      )}
      <div className="grid gap-4">
        {Object.entries(grouped).map(([cat, keys]) => (
          <div key={cat} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {PERM_CATEGORIES[cat]?.[locale === "ar" ? "ar" : "en"] ?? cat}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {keys.map((key) => (
                <Badge key={key} variant="secondary" className="text-xs gap-1.5 py-1 font-normal">
                  <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                  {PERM_LABELS[key]?.[locale === "ar" ? "ar" : "en"] ?? key}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
