import { notFound } from "next/navigation";
import { AccountingWorkspace } from "@/components/accounting/workspace";
import { sections, type Section } from "@/lib/accounting/types";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!Object.hasOwn(sections, section)) notFound();
  return <AccountingWorkspace key={section} section={section as Section} />;
}
