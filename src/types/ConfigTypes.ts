import { z } from 'zod';

export const ConfigSchema = z.object({
  appConfig: z.object({
    type: z.string(),
    title: z.string(),
    slug: z.string(),
    imageGlob: z.string().optional(),
  }),
  theme: z.object({
    accent: z.string(),
    mode: z.enum(['light', 'dark']),
    logo: z.string().optional(),
  }),
  features: z.object({
    mastodonBridge: z.boolean(),
    map: z.boolean(),
    filmstrip: z.boolean().default(true),
  }),
  node: z
    .object({
      apiBaseUrl: z.string(),
      chain: z.object({
        networkName: z.string(),
        rpcUrl: z.string(),
        explorer: z.string(),
      }),
    })
    .optional(),
  mainNav: z
    .array(
      z.object({
        title: z.string(),
        href: z.string(),
        disabled: z.boolean().optional(),
      })
    )
    .optional(),
});

export type LightseedConfig = z.infer<typeof ConfigSchema>;