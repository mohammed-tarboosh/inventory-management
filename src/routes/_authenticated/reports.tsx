import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useI18n } from "@/lib/i18n";
export const Route = createFileRoute("/_authenticated/reports")({ component: () => { const { t } = useI18n(); return <PageHeader title={t("reports")} />; } });