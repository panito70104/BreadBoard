import { requireUser } from "@/lib/server/auth/dal";
import { json, route } from "@/lib/server/http";
import { reapStaleGenerations } from "@/lib/server/services/generation";
import { deleteVideo, getVideo } from "@/lib/server/services/videos";

export const GET = route<RouteContext<"/api/videos/[id]">>(async (_request, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await reapStaleGenerations(user.id);
  return json({ video: await getVideo(user.id, id) });
});

export const DELETE = route<RouteContext<"/api/videos/[id]">>(async (_request, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await deleteVideo(user.id, id);
  return new Response(null, { status: 204 });
});
