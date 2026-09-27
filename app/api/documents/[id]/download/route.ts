import { NextResponse } from "next/server";

import { requireUser } from "@/lib/server/auth/dal";
import { route } from "@/lib/server/http";
import { getOwnedDocument } from "@/lib/server/services/documents";
import { signedReadUrl } from "@/lib/server/storage";

/** Redirects to a five-minute signed URL, after checking ownership. */
export const GET = route<RouteContext<"/api/documents/[id]/download">>(
  async (_request, { params }) => {
    const user = await requireUser();
    const { id } = await params;
    const document = await getOwnedDocument(user.id, id);
    const url = await signedReadUrl("documents", document.storageKey, {
      downloadAs: document.name,
    });
    return NextResponse.redirect(url, { status: 302 });
  },
);
