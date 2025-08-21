import { z } from "zod";

export const AppType = z.enum(["lightseed", "art", "node", "photography", "docs"]);

export const ConfigSchema = z.object({
  appConfig: z.object({
    type: AppType,
    title: z.string().min(1),
    description: z.string().min(1),
    slug: z.string().min(1),
  }),
  theme: z.object({
    accent: z.string().regex(/^#?[0-9a-fA-F]{3,8}$/),
    mode: z.enum(["light", "dark"]).default("dark"),
  }),
  features: z
    .object({
      mastodonBridge: z.boolean().default(false),
      map: z.boolean().default(false),
    })
    .default({ mastodonBridge: false, map: false }),
  mainNav: z.array(
    z.object({
      title: z.string().min(1),
      href: z.string().min(1),
    })
  ).default([]),
  links: z
    .object({
      github: z.string().url().optional(),
      docs: z.string().url().optional(),
    })
    .default({ github: undefined, docs: undefined }),
  node: z
    .object({
      apiBaseUrl: z.string().url(),
      chain: z.object({
        networkName: z.string(),
        rpcUrl: z.string().url(),
        explorer: z.string().url().optional(),
      }),
    })
    .optional(),
});

export type LightseedConfig = z.infer<typeof ConfigSchema>;