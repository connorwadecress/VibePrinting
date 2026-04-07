import { redirect } from "next/navigation";

/**
 * The admin UI has no dashboard. `/` immediately bounces to `/brands`,
 * which is the first screen operators actually care about. Auth is
 * handled by middleware.ts, so this redirect runs post-auth.
 */
export default function RootPage() {
  redirect("/brands");
}
