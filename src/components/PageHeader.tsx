import type { ReactNode } from "react";

export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="min-w-0 text-2xl font-bold">{title}</h1>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{children}</div>
    </div>
  );
}
