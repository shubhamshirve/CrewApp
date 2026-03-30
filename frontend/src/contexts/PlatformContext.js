/**
 * PlatformContext — fetches event types and roles once on app mount,
 * then shares them across all pages. Eliminates duplicate API calls
 * in Gigs, GigBoard, GigDetail, Onboarding, Search, and Wallet pages.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useApi } from "@/contexts/AuthContext";

const DEFAULT_EVENT_TYPES = [
  "Haldi", "Mehendi", "Sangeet", "Baraat", "Wedding",
  "Reception", "Pre-Wedding Shoot", "Corporate", "Birthday", "Other"
];

const DEFAULT_ROLES = [
  "Lead Photographer", "Second Shooter", "Traditional Videographer",
  "Cinematic Videographer", "Drone Operator", "Photo Assistant",
  "Video Assistant", "Lighting Technician", "Photo Editor", "Video Editor"
];

const PlatformContext = createContext(null);

export function PlatformProvider({ children }) {
  const api = useApi();
  const [eventTypes, setEventTypes] = useState(DEFAULT_EVENT_TYPES);
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [platformSettings, setPlatformSettings] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const loadPlatformData = useCallback(async () => {
    try {
      const [etRes, rolesRes] = await Promise.all([
        api.get("/platform/event-types").catch(() => null),
        api.get("/platform/roles").catch(() => null),
      ]);
      if (etRes?.data?.event_types?.length) {
        setEventTypes(etRes.data.event_types);
      }
      if (rolesRes?.data?.roles?.length) {
        setRoles(rolesRes.data.roles);
      }
    } catch {
      // Silently keep defaults on error
    } finally {
      setLoaded(true);
    }
  }, [api]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.get("/platform/settings");
      setPlatformSettings(res.data);
    } catch {
      // Keep null — callers handle absence
    }
  }, [api]);

  useEffect(() => {
    loadPlatformData();
    loadSettings();
  }, [loadPlatformData, loadSettings]);

  return (
    <PlatformContext.Provider value={{ eventTypes, roles, platformSettings, loaded, reload: loadPlatformData }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error("usePlatform must be used within PlatformProvider");
  return ctx;
}
