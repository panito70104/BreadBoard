import { json, route } from "@/lib/server/http";
import { listPlans } from "@/lib/server/services/plans";

export const GET = route(async () => json({ plans: listPlans() }));
