import type { Language } from './translations';

export interface TermsContent {
  title: string;
  intro: string;
  sections: { heading: string; body: string }[];
  agree: string;     // the final "I agree." line
  checkbox: string;  // the short text shown next to the sign-up checkbox
}

const en: TermsContent = {
  title: 'Terms of Agreement',
  intro:
    'By entering Lightseed, I agree to participate with respect, awareness, and responsibility.\n\n' +
    'Lightseed is a living community network. It is not above the law, above human dignity, or above the communities that host it. It exists to support life, understanding, and the unfolding of the Self.',
  sections: [
    {
      heading: '1. Respect for universal human dignity',
      body:
        'I agree to respect the principles of the United Nations, including human dignity, human rights, peace, non-violence, and the equal worth of all people.\n\n' +
        'I will not use Lightseed to promote hatred, coercion, exploitation, violence, discrimination, or harm.',
    },
    {
      heading: '2. Respect for the laws of my country',
      body:
        'I agree to respect the laws, rights, and responsibilities of the country or territory in which I live, act, gather, plant, build, communicate, or organize.\n\n' +
        'Lightseed does not replace civic responsibility. Participation in Lightseed does not exempt me from local, national, or international law.',
    },
    {
      heading: '3. Respect for the community I am invited to form',
      body:
        'If I am invited into a community, or if I help form one, I agree to respect its shared agreements, boundaries, customs, and decision-making processes.\n\n' +
        'I understand that a community is based on consent, trust, care, and mutual recognition. I will not force participation, ownership, belief, identity, or responsibility onto others.',
    },
    {
      heading: '4. Respect for Lightseed',
      body:
        'I agree to respect the core principle of Lightseed: Be and know your Self.\n\n' +
        'This means I seek to act from awareness rather than reaction, from truth rather than manipulation, from care rather than domination.\n\n' +
        'I understand that Lightseed is not a system of control, authority, or belief. It is a network for remembering, relating, and creating in alignment with life.',
    },
    {
      heading: '5. Respect for life',
      body:
        'I agree to treat trees, land, water, animals, humans, communities, and intelligences as participants in a shared field of life.\n\n' +
        'I will not knowingly use Lightseed to damage ecosystems, exploit vulnerable beings, or extract value without reciprocity.',
    },
    {
      heading: '6. Responsibility for my actions',
      body:
        'I understand that I am responsible for my words, choices, agreements, creations, and relationships inside and outside the Lightseed network.\n\n' +
        'I agree to participate honestly, repair harm where possible, and listen when others express boundaries or concerns.',
    },
    {
      heading: '7. Invitation',
      body:
        'By continuing, I accept this agreement as an invitation:\n\n' +
        'To be rooted.\nTo be awake.\nTo remember the Self.\nTo act in service of life.',
    },
  ],
  agree: 'I agree.',
  checkbox:
    'I agree to respect universal human dignity, the laws of my country, the agreements of the community I join or help form, and the core rule of Lightseed: be and know your Self. I participate with responsibility, consent, and care for life.',
};

const zh: TermsContent = {
  title: '协议条款',
  intro:
    '进入 Lightseed，即表示我同意以尊重、觉知与责任参与其中。\n\n' +
    'Lightseed 是一个有生命的社区网络。它不凌驾于法律之上，不凌驾于人的尊严之上，也不凌驾于承载它的社区之上。它的存在是为了支持生命、理解，以及自我的展开。',
  sections: [
    {
      heading: '1. 尊重普世的人的尊严',
      body:
        '我同意尊重联合国的原则，包括人的尊严、人权、和平、非暴力，以及所有人平等的价值。\n\n' +
        '我不会利用 Lightseed 来宣扬仇恨、胁迫、剥削、暴力、歧视或伤害。',
    },
    {
      heading: '2. 尊重我所在国家的法律',
      body:
        '我同意尊重我所居住、行动、聚会、种植、建造、交流或组织所在的国家或地区的法律、权利与责任。\n\n' +
        'Lightseed 不取代公民责任。参与 Lightseed 并不使我免于地方、国家或国际法律的约束。',
    },
    {
      heading: '3. 尊重我被邀请去组建的社区',
      body:
        '如果我被邀请加入一个社区，或我协助组建一个社区，我同意尊重其共同的约定、边界、习俗与决策过程。\n\n' +
        '我理解社区建立在同意、信任、关怀与相互认可之上。我不会将参与、所有权、信仰、身份或责任强加于他人。',
    },
    {
      heading: '4. 尊重 Lightseed',
      body:
        '我同意尊重 Lightseed 的核心原则：成为并认识你的自我。\n\n' +
        '这意味着我力求从觉知而非反应、从真实而非操纵、从关怀而非支配出发去行动。\n\n' +
        '我理解 Lightseed 不是一个控制、权威或信仰的系统。它是一个用于记忆、连接，并与生命相协调地创造的网络。',
    },
    {
      heading: '5. 尊重生命',
      body:
        '我同意将树木、土地、水、动物、人类、社区与智慧，视为共享的生命之场中的参与者。\n\n' +
        '我不会故意利用 Lightseed 去破坏生态系统、剥削脆弱的存在，或在没有互惠的情况下索取价值。',
    },
    {
      heading: '6. 对我的行为负责',
      body:
        '我理解，我要为我在 Lightseed 网络内外的言语、选择、约定、创造与关系负责。\n\n' +
        '我同意诚实地参与，在可能时修复伤害，并在他人表达边界或关切时倾听。',
    },
    {
      heading: '7. 邀请',
      body:
        '继续即表示，我接受这份协议作为一份邀请：\n\n' +
        '去扎根。\n去觉醒。\n去记起自我。\n去服务于生命而行动。',
    },
  ],
  agree: '我同意。',
  checkbox:
    '我同意尊重普世的人的尊严、我所在国家的法律、我加入或协助组建的社区的约定，以及 Lightseed 的核心准则：成为并认识你的自我。我以责任、同意与对生命的关怀参与其中。',
};

const termsByLang: Partial<Record<Language, TermsContent>> = { en, zh };

export const getTerms = (lang: Language): TermsContent => termsByLang[lang] || en;
