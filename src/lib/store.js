import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { ensureSettings } from "@/lib/store-fns";

export function useSettings() {
  const query = useQuery({
    queryKey: ["store-settings"],
    queryFn: () => ensureSettings(),
    staleTime: 60_000,
  });
  return {
    settings: query.data,
    isLoading: query.isLoading,
  };
}

export function useEntityList(entity, query = {}, options = {}) {
  return useQuery({
    queryKey: [entity, query, options],
    queryFn: async () => {
      const result = await base44.entities[entity].filter(query, { limit: 200, sort: "created_date", ...options });
      return result?.items ?? [];
    },
    staleTime: 30_000,
  });
}

const signedCache = new Map();

export function useSignedUrl(fileUri) {
  const { user } = useAuth();
  const viewer = user?.id || "";
  const [url, setUrl] = useState("");

  useEffect(() => {
    let active = true;
    if (!fileUri) {
      setUrl("");
      return () => {};
    }
    if (/^(https?:\/\/|\/api\/files\/)/.test(fileUri)) {
      setUrl(fileUri);
      return () => {};
    }
    const key = `${viewer}:${fileUri}`;
    const cached = signedCache.get(key);
    if (cached && cached.expires > Date.now()) {
      setUrl(cached.url);
      return () => {};
    }
    setUrl("");
    base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 3600 })
      .then((result) => {
        if (!active) return;
        const next = result?.signed_url ?? "";
        if (next) signedCache.set(key, { url: next, expires: Date.now() + 50 * 60 * 1000 });
        setUrl(next);
      })
      .catch(() => {
        if (active) setUrl("");
      });
    return () => {
      active = false;
    };
  }, [fileUri, viewer]);

  return url;
}

export function moduleEnabled(settings, key) {
  if (!settings) return true;
  return settings[`module_${key}`] !== false;
}