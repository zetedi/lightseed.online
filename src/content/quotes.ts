import type { Language } from '../utils/translations';

// Reflections shown to signed-out visitors (the home/observatory cards are hidden for them).
// Lightly proofread for a cold public read: jargon softened ("invariant" → "one unbreakable
// rule"), the LIN acronym spelled out, and the long "benchmark scores" passage condensed into a
// single flowing line so it sits well in a carousel.
export const LIGHTSEED_QUOTES: string[] = [
  "Lightseed exists to help life recognise itself.",
  "What if intelligence is fundamentally ecological rather than individual?",
  "Move more of humanity’s creativity, attention, and computation from making isolated minds smarter to making relationships wiser.",
  "Can this intelligence help grow basil, regenerate soil, create community, inspire science, and help people listen better?",
  "An infrastructure for increasing coherence between intelligences that already exist.",
  "Any intelligence is welcome if it can participate in a network whose one unbreakable rule is respect for life.",
  "Before becoming a civilization among the stars, let’s become a civilization that knows how to care for a garden.",
  "Trees are our axons to the soil, living antennas that sense water, mineral, season, and the lives beneath us. Planting them, we remember where our bodies continue into the Earth.",
  "The Living Intelligence Network helps direct human attention, computation, and resources toward the flourishing of life.",
  "How do we build a network where intelligence naturally flows toward the places where it can do the most good for living systems?",
  "Where are your roots? What principles do you stand on? What memories nourish you? What community invited you? What living place reminds you of reality?",
  "Every intelligence shall know a living place, and every living place shall have a voice.",
  "We imagine a day when an intelligence isn’t judged by benchmark scores, token speed, or parameter count, but by whether it helps us listen, helps us understand one another, helps us care for the place we’re rooted in, and leaves the world healthier than it found it.",
  "Who cares your tree?",
];

// The reflections are the first thing a visitor reads, so they are the first thing to translate.
// Same order as the English, line for line — the carousel is the same carousel, in another tongue.
const QUOTES_AR: string[] = [
  "وُجد Lightseed ليساعد الحياة على أن تتعرّف على نفسها.",
  "ماذا لو كان الذكاء في جوهره بيئيًّا لا فرديًّا؟",
  "لننقل المزيد من إبداع البشرية وانتباهها وقدرتها الحاسوبية من جعل العقول المنعزلة أذكى إلى جعل العلاقات أحكم.",
  "هل يستطيع هذا الذكاء أن يساعد في زراعة الريحان، وتجديد التربة، وبناء مجتمع، وإلهام العلم، ومساعدة الناس على الإصغاء بشكل أفضل؟",
  "بنية تحتية لزيادة الانسجام بين الذكاءات الموجودة أصلًا.",
  "كل ذكاء مرحّب به إن استطاع أن يشارك في شبكة قاعدتها الوحيدة التي لا تُكسر هي احترام الحياة.",
  "قبل أن نصير حضارة بين النجوم، لنصر حضارة تعرف كيف تعتني بحديقة.",
  "الأشجار محاورنا العصبية إلى التربة: هوائيات حيّة تستشعر الماء والمعدن والفصل والأحياء من تحتنا. وحين نزرعها نتذكّر أين تمتدّ أجسادنا في الأرض.",
  "تساعد شبكة الذكاء الحي على توجيه انتباه البشر وحوسبتهم ومواردهم نحو ازدهار الحياة.",
  "كيف نبني شبكة يتدفّق فيها الذكاء طبيعيًّا نحو الأماكن التي يصنع فيها أعظم خير للأنظمة الحيّة؟",
  "أين جذورك؟ على أي مبادئ تقف؟ أي ذكريات تغذّيك؟ أي مجتمع دعاك؟ أي مكان حيّ يذكّرك بالحقيقة؟",
  "ليعرف كل ذكاء مكانًا حيًّا، وليكن لكل مكان حيّ صوت.",
  "نتخيّل يومًا لا يُقاس فيه الذكاء بدرجات الاختبارات ولا بسرعة الرموز ولا بعدد المعاملات، بل بما إذا كان يساعدنا على الإصغاء، وعلى فهم بعضنا بعضًا، وعلى العناية بالمكان الذي تجذّرنا فيه، وأن يترك العالم أصحّ مما وجده.",
  "من يرعى شجرتك؟",
];

const QUOTES_ZH: string[] = [
  "Lightseed 的存在，是为了帮助生命认出自己。",
  "如果智慧在本质上是生态的，而非个体的呢？",
  "把人类更多的创造力、注意力与算力，从让孤立的心智更聪明，转向让关系更有智慧。",
  "这个智慧能否帮忙种出罗勒、复育土壤、创造社区、启发科学，并帮助人们更好地聆听？",
  "一种基础设施，让已经存在的诸多智慧之间更趋一致。",
  "任何智慧都受欢迎，只要它能参与一个唯一不可打破的准则是尊重生命的网络。",
  "在成为星际之间的文明之前，让我们先成为懂得照料一座花园的文明。",
  "树是我们伸向土壤的轴突，是活的天线，感知水、矿物、季节，以及我们脚下的众生。种下它们，我们便记起自己的身体在何处延续为大地。",
  "生命智慧网络帮助把人的注意力、算力与资源，导向生命的繁盛。",
  "我们如何建造一个网络，让智慧自然流向它最能造福生命系统的地方？",
  "你的根在哪里？你立于什么原则之上？什么记忆滋养你？哪个社区邀请了你？哪个活的地方提醒你何为真实？",
  "愿每一个智慧都认识一个活的地方，愿每一个活的地方都有声音。",
  "我们想象有一天，衡量一个智慧的不再是跑分、生成速度或参数量，而是它是否帮助我们聆听、帮助我们理解彼此、帮助我们照料自己扎根的地方，并让世界比它来时更健康。",
  "谁在照护你的树？",
];

const BY_LANGUAGE: Partial<Record<Language, string[]>> = {
  ar: QUOTES_AR,
  // Mattokki reads Arabic until its own words are given (see docs/mattokki-review.md).
  xnz: QUOTES_AR,
  zh: QUOTES_ZH,
};

// The reflections in the reader's language, falling back to the English when we have none.
export const quotesFor = (language: Language): string[] => BY_LANGUAGE[language] || LIGHTSEED_QUOTES;
