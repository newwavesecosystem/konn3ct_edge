import avatar from "../../assets/avatar.png";

export const profileData = {
  name: "Akanji Joseph",
  initials: "AJ",
  bio: "I help startups and teams design scalable fintech and AI products that solve real problems and create lasting impact.",
  about: [
    "I'm Akanji Joseph,",
    "a product designer and AI systems builder focused on creating scalable fintech and intelligent digital experiences.",
    "I specialize in designing user-centered platforms that simplify complex workflows, from payment systems to AI-powered tools.",
    "With experience across startups and emerging technologies, I combine design thinking with technical insight to build products that are both functional and impactful.",
    "I'm passionate about helping businesses turn ideas into usable, high-performing solutions. Beyond design, I explore conversations around innovation through content and podcasting, sharing insights on technology, product strategy, and the future of digital experiences.",
  ],
  avatar,
  emailLabel: "Email",
  primaryActionLabel: "Book a session",
};

export const socialLinks = [
  { id: "instagram", label: "Instagram", href: "#" },
  { id: "facebook", label: "Facebook", href: "#" },
  { id: "linkedin", label: "LinkedIn", href: "#" },
  { id: "music", label: "TikTok", href: "#" },
  { id: "youtube", label: "YouTube", href: "#" },
  { id: "twitter", label: "X", href: "#" },
  { id: "github", label: "GitHub", href: "#" },
  { id: "globe", label: "Website", href: "#" },
];

export const sessions = [
  {
    id: "intro-call",
    title: "Intro Call",
    duration: "15 min",
    description: "A quick call to meet and explore how I can help.",
    price: "Free",
  },
  {
    id: "consulting-call",
    title: "Consulting Call",
    duration: "30 min",
    description: "Get expert advice on your product or design challenges",
    price: "$20",
  },
  {
    id: "deep-dive-session",
    title: "Deep Dive Session",
    duration: "60 min",
    description: "In-depth working session to solve complex problems",
    price: "$150",
  },
];

export const availableDates = [23, 24, 25, 26, 29, 30];

export const calendarRows = [
  [null, 1, 2, 3, 4, 5, 6],
  [7, 8, 9, 10, 11, 12, 13],
  [14, 15, 16, 17, 18, 19, 20],
  [21, 22, 23, 24, 25, 26, 27],
  [28, 29, 30, null, null, null, null],
];

export const timeSlots = [
  "09:00 AM",
  "09:00 AM",
  "09:00 AM",
  "09:00 AM",
];

export const podcasts = [
  {
    id: "scaling-in-fintech-with-ai",
    title: "Scaling in fintech with AI",
    author: "Akanji Joseph",
    views: "2,412",
    duration: "08:12",
    image: avatar,
    active: true,
  },
  {
    id: "ai-the-next-gold-mine",
    title: "AI, The Next Gold mine",
    author: "Akanji Joseph",
    views: "2,412",
    duration: "08:12",
    image: avatar,
    active: false,
  },
];
