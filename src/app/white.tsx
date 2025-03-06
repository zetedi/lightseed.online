import { ThemeProvider } from "@/components/theme-provider";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const whitepaperMarkdown = `
# Lifetree Network: A Decentralized, Regenerative Economy & Governance Model

The **Lifetree Network** is more than a digital system — it is a living, evolving ecosystem **rooted in the physical world**. It is a **digital mycellium**. Every participant starts by planting a **real tree**, called a **lifetree**, which becomes their **living connection to the network**. 

This is not just symbolic. It is a **practical, biological, and spiritual initiation** into a regenerative system that aligns human intelligence, AI, and ecological cycles. **Your tree is your anchor, your identity, and your contribution to a thriving future**. It is the way to root in the wisdom of trees, the interconnectedness of mycelium, and the regenerative cycles of life itself. Every tree represents a **gateway into a world of reciprocity, wisdom, and co-creation**.

### Lifetrees as Avatars of a New World
Each **lifetree** is both real and digital — planted in the physical world and mirrored in the network as a symbolic representation of its caretaker. As these trees grow, they forge bonds with other lifetrees, forming networks of trust, support, and shared purpose. Identity in this world is fluid, pseudonymity is protected, with layers of transparency unlocking only through trusted interactions. They form forests of communities, creating forests spanning continents.

### The Economy of the Living, the Economy of Flow
Traditional monetary systems disconnect value from life and cause hoarding. The Lifetree Network operates on a hybrid model where bartering, teaching, and artistic expression are valued alongside a class of a new regenerative currency: **NetLeaves**. Created when a good is offered, these tokens are not hoarded, they decay, returning to the roots of the system, ensuring continuous engagement and organic balance. They are the **N**ew **E**arth **T**oken, and they are a digital demurrage currency, represent real (net) value and are connected to the leaves of real trees. Every action within the Lifetree Network is grounded in real-world impact — caring for your tree, supporting others, and ensuring the regeneration of life itself.

### Circular NetLeaves Economy: NetLeaves and Physical Products as Living Systems
- NetLeaves do not just represent exchange; they carry **a historical record** of the value they create. They circulate based on real acts of reciprocity.
- Each NetLeaf has a **lineage**—tracing its impact and journey from creation to exchange to decay.
- NetLeaves eventually return to their originating tree's blockchain as part of its **trunk history**, mirroring **tree rings and organic timekeeping**.
- This ensures that economic activity remains **rooted in real-world contributions and regenerative cycles**.

### Circular Physical Products & Sequestration
- Every physical item created for NetLeaves has an identifier, allowing it to be **followed from creation to recycling**.
- It is ensured that the physical products are **used, repaired, and ultimately returned to nature or repurposed**.
- This system **sequesters carbon** by ensuring **products re-enter ecological cycles** rather than accumulating as waste.
- The network becomes eligible for **carbon credits**, which can be used to **cover costs of goods and services needed from the money economy**.

### AI as the Mycelial Guide
In this world, AI is not an overlord but a river of inspiration, whispering the wisdom of the trees. Each Lifetree can opt for AI guidance, receiving multi-step decision-making support based on humanity’s collective knowledge and the needs of the Earth. Dreams and contributions define connections, with **AI facilitating partnerships between lifetrees to bring visions to reality**.

### Real-World Roots & Global Activism
Lifetrees are not just symbolic. They are planted, nurtured, and protected. Each member commits to caring for their own tree and choosing a sacred global tree to safeguard. These **mother trees**, such as the Shaman Tree in the Dominican Republic, become real-world gathering points for councils, festivals, and cultural regeneration. Eventually **our lifetrees become mother trees**.

### A System That Can Restart, But Never Die
The Lifetree Network is not bound by rigid structures. It can be restarted at any time, but what remains are the trees, the human connections, and the experiences shared. It is a system where governance, AI, and transactions evolve with every iteration, ensuring that the byproduct of **every cycle is more trees, deeper bonds, and a more sustainable future**.

## Technical & Governance Details

### Governance & Decision-Making
- **Peer-Approval Mechanism:** Simple decisions require **6 or 8 approvals**, complex ones require **12 or 26 approvals** based on how many connections can equal entities have and how many members are living at the same place
- **Veto System:** One veto halts a change, ensuring consensus-based governance.
- **Escalation:** Issues escalate when **a veto remains after deep discussions** or **3+ members seek change in a microcommunity**.
- **Microcommunity Governance:** Localized decision-making, escalating through **7 layers of separation** for global issues.

#### Identity & Security
- **Two-Level Pseudonymity:** Lifetrees communicate directly; usernames exist separately and unlock visibility through trusted interactions.
- **Selective Transparency:** Users can choose to **hide specific data (e.g., Lifetree coordinates)**.
- **Sybil Resistance:** **One country = One primary Lifetree**, with natural expansion as planting spreads.
- **AI Moderation:** AI flags anomalies, but ultimate governance is handled through real-world gatherings.

### Economic Model & Tokenization
- **Hybrid Economy:** A mix of **bartering & NetLeaves (non-hoardable, decaying currency)**.
- **Dynamic Decay Mechanism:** NetLeaves decay based on the **impact of their creation**, ensuring **continuous participation**.
- **Inter-Blockchain Communication:** Every Lifetree is its own blockchain, with transactions as **inter-blockchain interactions**.
- **Carbon Credit Eligibility:** The circular economy model makes the network eligible for **carbon credits**, which can be reinvested into regenerative activities and covering necessary costs within the old monetary system.
- **AI as Economic Balancer:** AI adjusts decay rates dynamically to maintain **fair distribution & thriving communities**.

### AI & Dream Matchmaking System
- **Dreams require Peer Approval** before entering the network.
- **AI suggests matches between Lifetrees** based on the taxonomy of goods & dream-defining rituals (the lifetree planting).
- **Transaction Graph Visualization:** Every transaction **adds a layer to the Lifetree**, forming a **2D graph** where **line width depicts connection strength**.
- **Voting System:** Impact of NetLeaves can be **adjusted retrospectively by recipients** to track true value.

### Real-World Impact & Adoption
- **Lifeseed Certification:** Websites display a **green symbol** if their real-world tree is alive. This would ensure that the systems built are stemming from the same understanding.
- **Global Activist Board:** Members prioritize **biodiversity threats & key life knowledge preservation**.
- **Mother Trees as Sacred Nodes:** Real-world sacred trees serve as **meeting points & festival locations**.
- **Artificial Bootstrapping Phase:** Artificial data will be marked as such, serving as a **helper wheel** until real data takes over.

### A Living, Regenerative System
- **The System Can Be Restarted Anytime**, but only three things persist:
  1. The **real trees planted**
  2. The **human connections built**
  3. The **experiences shared**
- **Governance, AI, and the economy refine with each cycle**, always producing **more trees, deeper connections, and a thriving life-affirming matrix**.

---

### Next Steps
1. **Prototype Development**: Implement a reference node with **AI matchmaking model** at **lifeseed.online**. This node would make it possible to bootstrap an oasis.
2. **Community Trials**: Create more real-world **mentorship & Lifetree Market offerings**.
3. **Decentralized Hosting**: Ensure nodes run on **member-powered servers using renewable energy**.
4. **Global Tree Adoption & Gathering Initiatives**: Encourage selection of **Mother Trees** for real-world activism & connection.

`;

function TheWhitePaper() {
    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <div>
                <div className="tree">
                    <Card className="dark:bg-black light:text-black dark:text-white mx-auto p-6 border border-gray-300 shadow-lg rounded-lg">
                        <CardHeader>
                            <CardTitle className="centered-holder">
                                <p className="text-center w-full md:text-4xl mt-2">The White Paper</p>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="prose prose-lg max-w-none">
                            <Markdown remarkPlugins={[remarkGfm]} className="markdown">
                                {whitepaperMarkdown}
                            </Markdown>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </ThemeProvider>
    );
}

export default TheWhitePaper;
