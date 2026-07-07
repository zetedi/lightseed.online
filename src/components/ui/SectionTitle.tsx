
// The small heading + optional subtitle that opens a profile section's main panel. Extracted from
// the identical copies that lived in CommunityProfile and LightseedProfile so every profile-style
// view (community, lightseed, lifetree, event, vision) titles its sections the same way.
export const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
    <div className="mb-6">
        <h2 className="text-base sm:text-xl font-bold text-slate-900">{title}</h2>
        {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
    </div>
);
