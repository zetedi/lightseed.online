import { Modal } from './Modal';

export type LegalDoc = 'privacy' | 'terms' | 'imprint';

const TITLES: Record<LegalDoc, string> = { privacy: 'Privacy', terms: 'Terms of Use', imprint: 'Imprint' };

// Generic STARTER texts — plain, honest placeholders. Each node should review and adapt them;
// they are not legal advice. Kept short and readable; interpolate the node name and year.
const sectionsFor = (doc: LegalDoc, node: string, year: number): { h: string; p: string[] }[] => {
    if (doc === 'privacy') return [
        { h: 'What we keep', p: [
            'To run the network we store what you give us: your account (email and display name), the beings and content you create (trees, pulses, visions, events), and the basic technical data a web service needs to work.',
        ] },
        { h: 'How we use it', p: [
            'We use your data only to provide and improve the network. We do not sell it, and we do not share it with third parties for advertising.',
        ] },
        { h: 'What others see', p: [
            'Content you mark public is visible to others by design; that is the point of a shared, living record. Content you keep private stays with you and the people you share it with.',
        ] },
        { h: 'The living record', p: [
            'Some marks are written to append-only chains and cannot be erased, only withdrawn. Deleting your account removes your profile and content and re-homes or clears the rest; a chain block that was already witnessed keeps its place in history.',
        ] },
        { h: 'Your rights', p: [
            'You can access, export, or delete your account and your data at any time from your profile settings. For anything else, reach the keeper of this node.',
        ] },
    ];
    if (doc === 'terms') return [
        { h: 'Using the network', p: [
            'By using this node you agree to these terms. If you do not agree, please do not use it. The service is offered during an ongoing testing phase and may change.',
        ] },
        { h: 'Your content', p: [
            'You keep ownership of what you create. By publishing, you grant this node permission to store and display it as part of the network so others can see what you chose to share.',
        ] },
        { h: 'How to be here', p: [
            'Be kind. Do not use the network for anything unlawful, harmful, deceptive, or that infringes others’ rights. Care is the currency here; treat the beings and people accordingly.',
        ] },
        { h: 'The living record', p: [
            'Chains are append-only: you may withdraw, but not rewrite, what has been sealed. This is a feature, not a fault, and it is how trust travels.',
        ] },
        { h: 'No warranty', p: [
            'The service is provided “as is”, without warranties. We do our best to keep it running and safe, but we cannot promise it will be uninterrupted or error-free.',
        ] },
    ];
    return [
        { h: 'Responsible for this node', p: [
            `This node (${node}) is operated by its keeper. For any request, correction, or question, contact the keeper of ${node} through the community or the profile that hosts it.`,
        ] },
        { h: 'The network', p: [
            'lightseed is a network of nodes, life recognising life. Its source is open under the GNU Affero General Public License v3.0, so any node running it can be inspected and its users offered its source.',
        ] },
        { h: 'Copyright', p: [
            `© 2019–${year} the lightseed contributors. Brand marks and node content belong to their respective owners.`,
        ] },
    ];
};

export const LegalModal = ({ doc, nodeName = 'lightseed', onClose }: { doc: LegalDoc; nodeName?: string; onClose: () => void }) => {
    const sections = sectionsFor(doc, nodeName, new Date().getFullYear());
    return (
        <Modal title={TITLES[doc]} onClose={onClose} wide fullScreenOnMobile>
            <div className="space-y-5 text-sm leading-relaxed text-slate-600">
                {sections.map(s => (
                    <section key={s.h}>
                        <h4 className="mb-1 font-bold text-slate-800">{s.h}</h4>
                        {s.p.map((para, i) => <p key={i} className="mb-2">{para}</p>)}
                    </section>
                ))}
                <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
                    A generic starter text, not legal advice. Each node should review and adapt it before relying on it.
                </p>
            </div>
        </Modal>
    );
};
