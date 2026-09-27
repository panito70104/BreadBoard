import { requireUser } from "@/lib/server/auth/dal";
import { toUserDto } from "@/lib/server/dto";
import { json, readJson, route } from "@/lib/server/http";
import { updateProfile } from "@/lib/server/services/accounts";
import { usageSummary } from "@/lib/server/services/usage";
import type { VideoDurationMinutes, VideoStyle } from "@/types";

/** Name and generation defaults. */
export const PATCH = route(async (request) => {
  const user = await requireUser();
  const profile = await updateProfile(user.id, await readJson(request));

  const updated = {
    ...user,
    name: profile.name,
    preferences: {
      defaultStyle: profile.defaultStyle as VideoStyle,
      defaultDurationMinutes: profile.defaultDurationMinutes as VideoDurationMinutes,
    },
  };
  return json({ user: toUserDto(updated, await usageSummary(user.id, user.planId)) });
});
