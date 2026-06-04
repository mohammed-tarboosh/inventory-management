import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({ rows, columns, empty }: { rows: T[]; columns: Column<T>[]; empty?: ReactNode }) {
  const { t } = useI18n();
  const renderMobile = () => (
    <div className="space-y-3 md:hidden">
      {rows.length === 0 ? (
        <div className="rounded-md border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          {empty ?? t("no_data")}
        </div>
      ) : (
        rows.map((r, idx) => (
          <div key={(r as any).id ?? idx} className="rounded-md border bg-card p-3 shadow-sm">
            <div className="space-y-2">
              {columns.map((c) => (
                <div key={c.key} className="flex items-start justify-between gap-3 border-t pt-2 first:border-t-0 first:pt-0">
                  <div className="min-w-0 text-xs font-medium text-muted-foreground">{c.header}</div>
                  <div className={cn("min-w-0 text-right text-sm", c.className)}>{c.cell(r)}</div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <>
      {renderMobile()}
      <div className="hidden rounded-md border bg-card md:block md:overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.className}>{c.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                  {empty ?? t("no_data")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => (
                <TableRow key={(r as any).id ?? i}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.className}>{c.cell(r)}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}