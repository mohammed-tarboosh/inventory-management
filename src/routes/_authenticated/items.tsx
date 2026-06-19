import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { usePermissions } from "@/lib/permissions";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { exportToExcel, readExcelFile } from "@/lib/excel";
import { fmtNum } from "@/lib/format";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Plus,
  Pencil,
  Upload,
  Download,
  Images,
  Star,
  StarOff,
  Trash2,
  X,
  ImagePlus,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/items")({ component: Page });

// ─── helpers ─────────────────────────────────────────────────────────────────

const BUCKET = "item-images";

function getPublicUrl(path: string) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function Page() {
  const { t, locale } = useI18n();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => (await supabase.from("items").select("*").order("name_ar")).data ?? [],
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*")).data ?? [],
  });
  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: async () => (await supabase.from("units").select("*")).data ?? [],
  });
  const { data: stock = [] } = useQuery({
    queryKey: ["item_stock"],
    queryFn: async () =>
      (await supabase.from("stock_movements").select("item_id, quantity")).data ?? [],
  });
  // جلب الصورة الرئيسية لكل صنف دفعة واحدة
  const { data: primaryImages = [] } = useQuery({
    queryKey: ["item_primary_images"],
    queryFn: async () =>
      (
        await supabase
          .from("item_images")
          .select("item_id, storage_path")
          .eq("is_primary", true)
      ).data ?? [],
  });

  const primaryMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const img of primaryImages as any[]) m.set(img.item_id, img.storage_path);
    return m;
  }, [primaryImages]);

  const stockMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of stock as any[]) m.set(s.item_id, (m.get(s.item_id) ?? 0) + Number(s.quantity));
    return m;
  }, [stock]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items as any[];
    return (items as any[]).filter((i) =>
      [i.code, i.name_ar, i.name_en].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [items, search]);

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["items"] });
    qc.invalidateQueries({ queryKey: ["item_stock"] });
    qc.invalidateQueries({ queryKey: ["item_primary_images"] });
  };

  const catName = (id: string) =>
    (categories as any[]).find((c) => c.id === id)?.[locale === "ar" ? "name_ar" : "name_en"] ??
    "-";
  const unitName = (id: string) =>
    (units as any[]).find((u) => u.id === id)?.[locale === "ar" ? "name_ar" : "name_en"] ?? "-";

  const handleExport = () => {
    exportToExcel(
      filtered.map((i: any) => ({
        code: i.code,
        name_ar: i.name_ar,
        name_en: i.name_en,
        category: catName(i.category_id),
        unit: unitName(i.unit_id),
        last_price: i.last_purchase_price_local,
        qty: stockMap.get(i.id) ?? 0,
      })),
      "items",
    );
  };

  return (
    <div>
      <PageHeader title={t("items")}>
        <Input
          className="w-full sm:w-48"
          placeholder={t("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 me-1" />
          {t("export_excel")}
        </Button>
        {can("items.import") && (
          <ImportButton categories={categories as any[]} units={units as any[]} onDone={refetch} />
        )}
        {can("items.manage") && (
          <ItemForm categories={categories as any[]} units={units as any[]} onDone={refetch} />
        )}
      </PageHeader>
      <DataTable
        rows={filtered}
        columns={[
          {
            key: "thumb",
            header: "",
            className: "w-12",
            cell: (r: any) => {
              const path = primaryMap.get(r.id);
              return path ? (
                <img
                  src={getPublicUrl(path)}
                  alt={r.name_ar}
                  className="h-9 w-9 rounded object-cover border"
                />
              ) : (
                <div className="h-9 w-9 rounded border bg-muted flex items-center justify-center text-muted-foreground">
                  <Images className="h-4 w-4" />
                </div>
              );
            },
          },
          { key: "code", header: t("code"), cell: (r: any) => r.code ?? "-" },
          { key: "name_ar", header: t("name_ar"), cell: (r: any) => r.name_ar },
          { key: "name_en", header: t("name_en"), cell: (r: any) => r.name_en ?? "-" },
          { key: "cat", header: t("category"), cell: (r: any) => catName(r.category_id) },
          { key: "unit", header: t("unit"), cell: (r: any) => unitName(r.unit_id) },
          {
            key: "qty",
            header: t("current_qty"),
            cell: (r: any) => fmtNum(stockMap.get(r.id) ?? 0, 2),
          },
          {
            key: "price",
            header: t("last_price"),
            cell: (r: any) => fmtNum(r.last_purchase_price_local, 2),
          },
          {
            key: "actions",
            header: t("actions"),
            className: "w-36",
            cell: (r: any) => (
              <div className="flex gap-1">
                {/* زر gallery دائماً ظاهر */}
                <ItemImagesDialog item={r} canManage={can("items.manage")} />
                {can("items.manage") && (
                  <>
                    <ItemForm
                      row={r}
                      categories={categories as any[]}
                      units={units as any[]}
                      onDone={refetch}
                    />
                    <ConfirmDelete
                      onConfirm={async () => {
                        const { error } = await supabase.from("items").delete().eq("id", r.id);
                        if (error) toast.error(error.message);
                        else {
                          toast.success(t("save_success"));
                          refetch();
                        }
                      }}
                    />
                  </>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

// ─── ItemImagesDialog ─────────────────────────────────────────────────────────

function ItemImagesDialog({ item, canManage }: { item: any; canManage: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // للموبايل: الصورة المحددة عند الضغط المطول
  const [menuImg, setMenuImg] = useState<any>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLongPress = (img: any) => {
    longPressTimer.current = setTimeout(() => setMenuImg(img), 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const { data: images = [], refetch: refetchImages } = useQuery({
    queryKey: ["item_images", item.id],
    queryFn: async () =>
      (
        await supabase
          .from("item_images")
          .select("*")
          .eq("item_id", item.id)
          .order("sort_order")
          .order("created_at")
      ).data ?? [],
    enabled: open,
  });

  const invalidate = () => {
    refetchImages();
    qc.invalidateQueries({ queryKey: ["item_primary_images"] });
  };

  const handleUpload = useCallback(
    async (files: FileList) => {
      if (!files.length) return;
      setUploading(true);
      const { data: u } = await supabase.auth.getUser();
      const isFirst = (images as any[]).length === 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop();
        const path = `items/${item.id}/${Date.now()}_${i}.${ext}`;

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (upErr) {
          toast.error(`${file.name}: ${upErr.message}`);
          continue;
        }

        const { error: dbErr } = await supabase.from("item_images").insert({
          item_id: item.id,
          storage_path: path,
          is_primary: isFirst && i === 0,
          sort_order: (images as any[]).length + i,
          created_by: u.user?.id,
        });
        if (dbErr) toast.error(dbErr.message);
      }

      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
      toast.success(t("images_uploaded"));
      invalidate();
    },
    [images, item.id],
  );

  const handleSetPrimary = async (imgId: string) => {
    const { error } = await supabase
      .from("item_images")
      .update({ is_primary: true })
      .eq("id", imgId);
    if (error) toast.error(error.message);
    else invalidate();
  };

  const handleDelete = async (img: any) => {
    // حذف من Storage
    await supabase.storage.from(BUCKET).remove([img.storage_path]);
    // حذف من DB
    const { error } = await supabase.from("item_images").delete().eq("id", img.id);
    if (error) toast.error(error.message);
    else {
      // إذا كانت الصورة المحذوفة هي الرئيسية، اجعل أول صورة متبقية هي الرئيسية
      if (img.is_primary) {
        const remaining = (images as any[]).filter((x: any) => x.id !== img.id);
        if (remaining.length > 0) {
          await supabase
            .from("item_images")
            .update({ is_primary: true })
            .eq("id", remaining[0].id);
        }
      }
      invalidate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title={t("item_images")}>
          <Images className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Images className="h-4 w-4" />
            {t("item_images")} — {item.name_ar}
          </DialogTitle>
        </DialogHeader>

        {/* منطقة رفع الصور */}
        {canManage && (
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) handleUpload(e.dataTransfer.files);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
            <ImagePlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {uploading ? t("uploading") : t("upload_images_hint")}
            </p>
          </div>
        )}

        {/* Gallery */}
        {(images as any[]).length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">{t("no_images")}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
            {(images as any[]).map((img: any) => (
              <ContextMenu key={img.id}>
                <ContextMenuTrigger asChild>
                  {/* لمس مطول للموبايل */}
                  <div
                    className="relative rounded-lg overflow-hidden border bg-muted aspect-square select-none cursor-pointer"
                    onContextMenu={(e) => e.preventDefault()}
                    onTouchStart={() => canManage && startLongPress(img)}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                  >
                    <img
                      src={getPublicUrl(img.storage_path)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {img.is_primary && (
                      <Badge className="absolute top-1 start-1 text-xs px-1.5 py-0.5 bg-yellow-500 text-white border-0">
                        <Star className="h-3 w-3 me-0.5" />
                        {t("primary")}
                      </Badge>
                    )}
                  </div>
                </ContextMenuTrigger>
                {/* كليك يمين على الديسكتوب */}
                {canManage && (
                  <ContextMenuContent className="w-48">
                    {!img.is_primary && (
                      <ContextMenuItem onClick={() => handleSetPrimary(img.id)}>
                        <Star className="h-4 w-4 me-2 text-yellow-500" />
                        {t("set_primary")}
                      </ContextMenuItem>
                    )}
                    {!img.is_primary && <ContextMenuSeparator />}
                    <ContextMenuItem
                      onClick={() => handleDelete(img)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 me-2" />
                      {t("delete")}
                    </ContextMenuItem>
                  </ContextMenuContent>
                )}
              </ContextMenu>
            ))}
          </div>
        )}

        {/* Bottom sheet للموبايل عند الضغط المطول */}
        {menuImg && canManage && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
            onClick={() => setMenuImg(null)}
          >
            <div
              className="w-full max-w-sm rounded-t-2xl bg-background p-4 space-y-1 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs text-muted-foreground text-center mb-3 font-medium">
                {t("image_actions")}
              </p>
              {!menuImg.is_primary && (
                <button
                  className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
                  onClick={() => { handleSetPrimary(menuImg.id); setMenuImg(null); }}
                >
                  <Star className="h-5 w-5 text-yellow-500" />
                  {t("set_primary")}
                </button>
              )}
              <button
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                onClick={() => { handleDelete(menuImg); setMenuImg(null); }}
              >
                <Trash2 className="h-5 w-5" />
                {t("delete")}
              </button>
              <button
                className="flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-medium bg-muted mt-1 transition-colors"
                onClick={() => setMenuImg(null)}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            <X className="h-4 w-4 me-1" />
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ItemForm ──────────────────────────────────────────────────────────────────

function ItemForm({
  row,
  categories,
  units,
  onDone,
}: {
  row?: any;
  categories: any[];
  units: any[];
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(row?.code ?? "");
  const [name_ar, setNameAr] = useState(row?.name_ar ?? "");
  const [name_en, setNameEn] = useState(row?.name_en ?? "");
  const [category_id, setCategoryId] = useState<string | null>(row?.category_id ?? null);
  const [unit_id, setUnitId] = useState<string | null>(row?.unit_id ?? null);
  const [notes, setNotes] = useState(row?.notes ?? "");

  const submit = async () => {
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      code: code || null,
      name_ar,
      name_en: name_en || null,
      category_id,
      unit_id,
      notes: notes || null,
    };
    if (row) {
      payload.updated_by = u.user?.id;
      const { error } = await supabase.from("items").update(payload).eq("id", row.id);
      if (error) return toast.error(error.message);
    } else {
      payload.created_by = u.user?.id;
      const { error } = await supabase.from("items").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success(t("save_success"));
    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {row ? (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4 me-1" />
            {t("add")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {row ? t("edit") : t("add")} - {t("items")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>{t("code")}</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div>
            <Label>{t("name_ar")}</Label>
            <Input value={name_ar} onChange={(e) => setNameAr(e.target.value)} />
          </div>
          <div>
            <Label>{t("name_en")}</Label>
            <Input value={name_en} onChange={(e) => setNameEn(e.target.value)} />
          </div>
          <div>
            <Label>{t("category")}</Label>
            <Select
              value={category_id ?? "_"}
              onValueChange={(v) => setCategoryId(v === "_" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_">{t("none")}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("unit")}</Label>
            <Select value={unit_id ?? "_"} onValueChange={(v) => setUnitId(v === "_" ? null : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_">{t("none")}</SelectItem>
                {units.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>{t("notes")}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} disabled={!name_ar}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ImportButton ──────────────────────────────────────────────────────────────

function ImportButton({
  categories,
  units,
  onDone,
}: {
  categories: any[];
  units: any[];
  onDone: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const rows = await readExcelFile(file);
      const { data: u } = await supabase.auth.getUser();
      const findCat = (n: string) =>
        categories.find((c) => [c.name_ar, c.name_en, c.id].includes(n))?.id ?? null;
      const findUnit = (n: string) =>
        units.find((x) => [x.name_ar, x.name_en, x.id].includes(n))?.id ?? null;
      const payload = rows
        .filter((r: any) => r.name_ar)
        .map((r: any) => ({
          code: r.code ? String(r.code) : null,
          name_ar: String(r.name_ar),
          name_en: r.name_en ? String(r.name_en) : null,
          category_id: r.category ? findCat(String(r.category)) : null,
          unit_id: r.unit ? findUnit(String(r.unit)) : null,
          last_purchase_price_local: r.price ? Number(r.price) : 0,
          created_by: u.user?.id,
        }));
      if (!payload.length) {
        toast.error(t("import_help"));
        return;
      }
      const { error } = await supabase.from("items").insert(payload);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("rows_imported", { n: payload.length }));
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <Button
        variant="outline"
        onClick={() => ref.current?.click()}
        disabled={busy}
        title={t("import_help")}
      >
        <Upload className="h-4 w-4 me-1" />
        {t("import_excel")}
      </Button>
    </>
  );
}
