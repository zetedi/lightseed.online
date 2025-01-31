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
## Lifetree Network: A Decentralized, Regenerative Economy & Governance Model

### 1. The Seed of a New Society
In the heart of the Earth, a new societal layer is forming—one rooted in the wisdom of trees, the interconnectedness of mycelium, and the regenerative cycles of life itself. The Lifetree Network is not just a system; it is a living, evolving ecosystem where every individual nurtures a tree, and every tree represents a gateway into a world of reciprocity, wisdom, and co-creation.

### 2. Lifetrees as Avatars of a New World
Each lifetree is both real and digital—planted in the physical world and mirrored in the network as a symbolic representation of its caretaker. As these trees grow, they forge bonds with other lifetrees, forming vast networks of trust, support, and shared purpose. Identity in this world is fluid; pseudonymity is protected, with layers of transparency unlocking only through trusted interactions.

### 3. The Economy of the Living
Traditional monetary systems disconnect value from life. The Lifetree Network operates on a hybrid model where bartering, teaching, and artistic expression are valued alongside a new regenerative currency: Lifetree Leaves. Created when a good is offered, these Leaves are not hoarded; they decay, returning to the roots of the system, ensuring continuous engagement and organic balance.

### 4. AI as the Mycelial Guide
In this world, AI is not an overlord but a river of inspiration, whispering the wisdom of the trees. Each Lifetree can opt for AI guidance, receiving multi-step decision-making support based on humanity’s collective knowledge and the needs of the Earth. Dreams and contributions define connections, with AI facilitating partnerships between lifetrees to bring visions to reality.

### 5. Real-World Roots & Global Activism
Lifetrees are not just symbolic. They are planted, nurtured, and protected. Each member commits to caring for their own tree and choosing a sacred global tree to safeguard. These mother trees, such as the Shaman Tree in the Dominican Republic, become real-world gathering points for councils, festivals, and cultural regeneration.

### 6. A System That Can Restart, But Never Die
The Lifetree Network is not bound by rigid structures. It can be restarted at any time, but what remains are the trees, the human connections, and the experiences shared. It is a system where governance, AI, and transactions evolve with every iteration, ensuring that the byproduct of every cycle is more trees, deeper bonds, and a more sustainable future.

### 7. Technical & Governance Details

#### 1. Governance & Decision-Making
- **Peer-Approval Mechanism:** Simple decisions require **6 approvals**, complex ones require **12 approvals**, mirroring the **kissing number principle**.
- **Veto System:** One veto halts a change, ensuring consensus-based governance.
- **Escalation:** Issues escalate when **a veto remains after deep discussions** or **3+ members seek change in a microcommunity**.
- **Microcommunity Governance:** Localized decision-making, escalating through **7 layers of separation** for global issues.

#### 2. Identity & Security
- **Two-Level Pseudonymity:** Lifetrees communicate directly; usernames exist separately and unlock visibility through trusted interactions.
- **Selective Transparency:** Users can choose to **hide specific data (e.g., Lifetree coordinates)**.
- **Sybil Resistance:** **One country = One primary Lifetree**, with natural expansion as planting spreads.
- **AI Moderation:** AI flags anomalies, but ultimate governance is handled through real-world gatherings.

#### 3. Economic Model & Tokenization
- **Hybrid Economy:** A mix of **bartering & Lifetree Leaves (non-hoardable, decaying currency)**.
- **Dynamic Decay Mechanism:** Leaves decay based on the **impact of their creation**, ensuring **continuous participation**.
- **Inter-Blockchain Communication:** Every Lifetree is its own blockchain, with transactions as **inter-blockchain interactions**.
- **AI as Economic Balancer:** AI adjusts decay rates dynamically to maintain **fair distribution & thriving communities**.

#### 4. AI & Dream Matchmaking System
- **Dreams require Peer Approval** before entering the network.
- **AI suggests matches between Lifetrees** based on the taxonomy of goods & dream-defining rituals.
- **Transaction Graph Visualization:** Every transaction **adds a layer to the Lifetree**, forming a **2D graph** where **line width depicts connection strength**.
- **Voting System:** Impact of Leaves can be **adjusted retrospectively by recipients** to track true value.

#### 5. Real-World Impact & Adoption
- **Lifeseed Certification:** Websites display a **green symbol** if their real-world tree is alive.
- **Global Activist Board:** Members prioritize **biodiversity threats & key life knowledge preservation**.
- **Mother Trees as Sacred Nodes:** Real-world sacred trees serve as **meeting points & festival locations**.
- **Artificial Bootstrapping Phase:** Artificial data will be marked as such, serving as a **helper wheel** until real data takes over.

#### 6. A Living, Regenerative System
- **The System Can Be Restarted Anytime**, but only three things persist:
  1. The **real trees planted**
  2. The **human connections built**
  3. The **experiences shared**
- **Governance, AI, and the economy refine with each cycle**, always producing **more trees, deeper connections, and a thriving life-affirming matrix**.

#### 7. Next Steps
1. **Prototype Development**: Implement the first **AI matchmaking model** at **lifeseed.online**.
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
