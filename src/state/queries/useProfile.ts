import { useQuery } from "@tanstack/react-query";
import { getProfile } from "../../api/profile";
import { qk } from "../queryKeys";
import type { Profile } from "../../types/Profile";

export function useProfile() {
  return useQuery<Profile>({
    queryKey: qk.profile,
    queryFn: getProfile,
  });
}
