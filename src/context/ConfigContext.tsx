import React, { createContext, useContext } from "react";
import type { LightseedConfig } from "@/types/ConfigTypes";

const Ctx = createContext<LightseedConfig | null>(null);
export const useConfig = () => {
  const cfg = useContext(Ctx);
  if (!cfg) throw new Error("Config not loaded yet");
  return cfg;
};
export const ConfigProvider: React.FC<{
  cfg: LightseedConfig;
  children: React.ReactNode;
}> = ({ cfg, children }) => <Ctx.Provider value={cfg}>{children}</Ctx.Provider>;
