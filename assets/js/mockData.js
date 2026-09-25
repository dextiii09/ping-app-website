// Ping Web Platform - Initial Mock Data & Seed Profiles
// Hyperlocal Creator-Business Marketplace — Pilot Phase
// Ping isn't tied to any one city: members detect or type their own location
// on signup, and matching is done by area + niche. These seed profiles are
// deliberately spread across different cities to reflect that. Budgets and
// follower counts are scaled to local micro/nano creators (~1K-300K
// followers) and small local businesses, not national/luxury-scale deals.

// Shared niche vocabulary used by signup (tag picker) and discovery (filter
// chips), so both stay in sync as niches are added. Kept broader than the
// 4 niches in the seed data below since real signups won't be limited to
// café/salon/gym/boutique.
export const NICHE_TAGS = [
  "Food & Café",
  "Beauty & Salon",
  "Fitness",
  "Fashion & Boutique",
  "Lifestyle",
  "Home & Decor",
  "Events",
  "Tech & Gadgets"
];

export const SEED_USERS = [
  {
    id: "creator_1",
    name: "Simran Kaur",
    role: "INFLUENCER",
    talentType: "INFLUENCER",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    bio: "Local food & café explorer covering the best brews, bakes, and hidden menus around Chandigarh.",
    location: "Sector 17, Chandigarh",
    jobTitle: "Food & Café Creator",
    company: "Simran Eats Local",
    tags: ["Food & Café", "Lifestyle", "Photography"],
    verified: true,
    verificationStatus: "VERIFIED",
    status: "ACTIVE",
    pingScore: 93,
    completionRate: 97,
    responseTime: "< 2 hours",
    totalEarnings: 42000,
    rating: 4.9,
    reviewCount: 21,
    stats: {
      followers: "32K",
      engagement: "6.8%",
      budget: "₹2,500 - ₹6,000",
      activeChats: 3
    },
    socialStats: {
      instagramFollowers: "28K",
      youtubeSubscribers: "4K",
      tiktokFollowers: "6K",
      avgEngagement: "6.8%"
    },
    portfolio: [
      "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80"
    ],
    joinedAt: Date.now() - 1000 * 60 * 60 * 24 * 60
  },
  {
    id: "creator_2",
    name: "Arjun Mehta",
    role: "INFLUENCER",
    talentType: "INFLUENCER",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    bio: "Calisthenics coach and gym-floor storyteller helping his neighbourhood's fitness crowd train smarter, one reel at a time.",
    location: "HSR Layout, Bengaluru",
    jobTitle: "Fitness Creator",
    company: "Mehta Fitness Co.",
    tags: ["Fitness", "Nutrition", "Wellness"],
    verified: true,
    verificationStatus: "VERIFIED",
    status: "ACTIVE",
    pingScore: 90,
    completionRate: 95,
    responseTime: "4 hours",
    totalEarnings: 28000,
    rating: 4.8,
    reviewCount: 15,
    stats: {
      followers: "27K",
      engagement: "7.4%",
      budget: "₹2,000 - ₹5,000",
      activeChats: 2
    },
    socialStats: {
      instagramFollowers: "21K",
      youtubeSubscribers: "6K",
      tiktokFollowers: "3K",
      avgEngagement: "7.4%"
    },
    portfolio: [
      "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80"
    ],
    joinedAt: Date.now() - 1000 * 60 * 60 * 24 * 40
  },
  {
    id: "creator_3",
    name: "Priya Malhotra",
    role: "INFLUENCER",
    talentType: "INFLUENCER",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
    bio: "Skincare-first beauty creator sharing honest local salon reviews and everyday glow-up routines.",
    location: "Koregaon Park, Pune",
    jobTitle: "Beauty & Salon Creator",
    company: "Glow with Priya",
    tags: ["Beauty & Salon", "Skincare", "Lifestyle"],
    verified: false,
    verificationStatus: "PENDING",
    status: "ACTIVE",
    pingScore: 87,
    completionRate: 92,
    responseTime: "Under 3h",
    totalEarnings: 12000,
    rating: 4.7,
    reviewCount: 9,
    stats: {
      followers: "15K",
      engagement: "8.1%",
      budget: "₹1,500 - ₹4,000",
      activeChats: 1
    },
    socialStats: {
      instagramFollowers: "14K",
      youtubeSubscribers: "1K",
      tiktokFollowers: "4K",
      avgEngagement: "8.1%"
    },
    portfolio: [
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80"
    ],
    joinedAt: Date.now() - 1000 * 60 * 60 * 24 * 25
  },
  {
    id: "creator_4",
    name: "Karan Sethi",
    role: "INFLUENCER",
    talentType: "INFLUENCER",
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
    bio: "Streetwear stylist and boutique showcase creator styling his city's fashion scene for the 'gram.",
    location: "Hauz Khas, Delhi",
    jobTitle: "Fashion & Boutique Creator",
    company: "Sethi Styles",
    tags: ["Fashion & Boutique", "Streetwear", "Lifestyle"],
    verified: true,
    verificationStatus: "VERIFIED",
    status: "ACTIVE",
    pingScore: 95,
    completionRate: 98,
    responseTime: "< 1 hour",
    totalEarnings: 65000,
    rating: 4.92,
    reviewCount: 27,
    stats: {
      followers: "58K",
      engagement: "5.6%",
      budget: "₹3,000 - ₹8,000",
      activeChats: 4
    },
    socialStats: {
      instagramFollowers: "50K",
      youtubeSubscribers: "5K",
      tiktokFollowers: "8K",
      avgEngagement: "5.6%"
    },
    portfolio: [
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=600&q=80"
    ],
    joinedAt: Date.now() - 1000 * 60 * 60 * 24 * 70
  },
  {
    id: "dj_1",
    name: "DJ Kabir",
    role: "INFLUENCER",
    talentType: "DJ",
    avatar: "https://images.unsplash.com/photo-1695277715416-e225cf09d70c?auto=format&fit=crop&w=400&q=80",
    bio: "Bollywood-meets-house DJ playing café terraces, rooftop launches and club nights around the tricity.",
    location: "Sector 7, Chandigarh",
    jobTitle: "DJ",
    company: "Kabir Live",
    tags: ["Events", "Lifestyle"],
    verified: true,
    verificationStatus: "VERIFIED",
    status: "ACTIVE",
    pingScore: 89,
    stats: { followers: "9K", engagement: "5.2%" },
    socialStats: { instagramFollowers: "9K" },
    talentDetails: { genres: "Bollywood, House", gigs: "140+", mixLink: "https://soundcloud.com/" },
    portfolio: [],
    joinedAt: Date.now() - 1000 * 60 * 60 * 24 * 35
  },
  {
    id: "comic_1",
    name: "Aman Sood",
    role: "INFLUENCER",
    talentType: "COMEDIAN",
    avatar: "https://images.unsplash.com/photo-1730875648513-b08f39b8924c?auto=format&fit=crop&w=400&q=80",
    bio: "Observational stand-up about Punjabi families, office life and chai. Hosts open mics every Thursday.",
    location: "Sector 35, Chandigarh",
    jobTitle: "Stand-up Comedian",
    company: "Aman Sood Comedy",
    tags: ["Events", "Lifestyle"],
    verified: false,
    verificationStatus: "UNVERIFIED",
    status: "ACTIVE",
    pingScore: 84,
    stats: { followers: "22K", engagement: "9.1%" },
    socialStats: { instagramFollowers: "22K" },
    talentDetails: { style: "Observational, crowd work", shows: "80+", showReel: "https://youtube.com/" },
    portfolio: [],
    joinedAt: Date.now() - 1000 * 60 * 60 * 24 * 18
  },
  {
    id: "band_1",
    name: "The Loop Theory",
    role: "INFLUENCER",
    talentType: "BAND",
    avatar: "https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?auto=format&fit=crop&w=400&q=80",
    bio: "Indie-rock three-piece playing originals and Hindi rock covers. Café gigs, college fests, brand launches.",
    location: "Mohali, Chandigarh",
    jobTitle: "Band",
    company: "The Loop Theory",
    tags: ["Events"],
    verified: true,
    verificationStatus: "VERIFIED",
    status: "ACTIVE",
    pingScore: 86,
    stats: { followers: "6K", engagement: "6.4%" },
    socialStats: { instagramFollowers: "6K" },
    talentDetails: { genre: "Indie rock, Hindi rock", gigs: "55", lineup: "3-piece", listenLink: "https://open.spotify.com/" },
    portfolio: [],
    joinedAt: Date.now() - 1000 * 60 * 60 * 24 * 50
  },
  {
    id: "brand_1",
    name: "The Brew Yard Café",
    role: "BUSINESS",
    avatar: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=400&q=80",
    bio: "Neighbourhood café serving specialty coffee, all-day brunch, and a growing local following.",
    location: "Sector 26, Chandigarh",
    industry: "Café & Food",
    company: "The Brew Yard",
    companySize: "5-10 employees",
    website: "https://thebrewyard.example.com",
    tags: ["Food & Café", "Lifestyle"],
    verified: true,
    verificationStatus: "VERIFIED",
    status: "ACTIVE",
    pingScore: 96,
    completionRate: 100,
    responseTime: "< 1 hour",
    totalEarnings: 38000,
    rating: 4.85,
    reviewCount: 12,
    stats: {
      followers: "9K",
      engagement: "4.9%",
      budget: "₹15,000 Monthly Pool",
      activeChats: 3
    },
    socialStats: {
      instagramFollowers: "8K",
      youtubeSubscribers: "0",
      tiktokFollowers: "1K",
      avgEngagement: "4.9%"
    },
    portfolio: [
      "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80"
    ],
    joinedAt: Date.now() - 1000 * 60 * 60 * 24 * 55
  },
  {
    id: "brand_2",
    name: "Glow Studio Salon",
    role: "BUSINESS",
    avatar: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&q=80",
    bio: "Neighbourhood salon and skincare studio, known for honest facials and no-pressure consultations.",
    location: "Koregaon Park, Pune",
    industry: "Beauty & Salon",
    company: "Glow Studio",
    companySize: "5-10 employees",
    website: "https://glowstudio.example.com",
    tags: ["Beauty & Salon", "Wellness"],
    verified: true,
    verificationStatus: "VERIFIED",
    status: "ACTIVE",
    pingScore: 91,
    completionRate: 96,
    responseTime: "1 hour",
    totalEarnings: 21000,
    rating: 4.8,
    reviewCount: 10,
    stats: {
      followers: "6K",
      engagement: "5.3%",
      budget: "₹10,000 Monthly Pool",
      activeChats: 2
    },
    socialStats: {
      instagramFollowers: "5K",
      youtubeSubscribers: "0",
      tiktokFollowers: "1K",
      avgEngagement: "5.3%"
    },
    portfolio: [
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80"
    ],
    joinedAt: Date.now() - 1000 * 60 * 60 * 24 * 48
  },
  {
    id: "brand_3",
    name: "FitZone Studio",
    role: "BUSINESS",
    avatar: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=400&q=80",
    bio: "Community strength & conditioning gym building its city's most consistent training culture.",
    location: "HSR Layout, Bengaluru",
    industry: "Fitness & Wellness",
    company: "FitZone",
    companySize: "10-20 employees",
    website: "https://fitzonestudio.example.com",
    tags: ["Fitness", "Wellness"],
    verified: false,
    verificationStatus: "PENDING",
    status: "ACTIVE",
    pingScore: 85,
    completionRate: 93,
    responseTime: "3 hours",
    totalEarnings: 9500,
    rating: 4.6,
    reviewCount: 6,
    stats: {
      followers: "4K",
      engagement: "6.0%",
      budget: "₹8,000 Monthly Pool",
      activeChats: 1
    },
    socialStats: {
      instagramFollowers: "3K",
      youtubeSubscribers: "500",
      tiktokFollowers: "1K",
      avgEngagement: "6.0%"
    },
    portfolio: [
      "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80"
    ],
    joinedAt: Date.now() - 1000 * 60 * 60 * 24 * 20
  },
  {
    id: "admin_1",
    name: "Ping Pilot Team",
    role: "ADMIN",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    bio: "Pilot operations & trust team running Ping's launch cities — onboarding, verification, and dispute support.",
    location: "Remote / Multi-City",
    jobTitle: "Pilot Operations Lead",
    company: "Ping",
    tags: ["Operations", "Trust & Safety", "Pilot Program"],
    verified: true,
    verificationStatus: "VERIFIED",
    status: "ACTIVE",
    pingScore: 100,
    completionRate: 100,
    responseTime: "Instant",
    totalEarnings: 0,
    rating: 5.0,
    reviewCount: 8,
    stats: {
      followers: "Official",
      engagement: "100%",
      budget: "N/A",
      activeChats: 6
    },
    joinedAt: Date.now() - 1000 * 60 * 60 * 24 * 90
  }
// isDemo marks every seed profile as demo data so the UI can badge it and
// real users don't mistake a placeholder business/creator for a real one.
].map(u => ({ ...u, isDemo: true }));

export const SEED_BRIEFS = [
  {
    id: "brief_1",
    deliverables: "1 Reel + 2 Stories",
    talentType: "INFLUENCER",
    slots: 2,
    slotsFilled: 0,
    status: "OPEN",
    endsOn: Date.now() + 1000 * 60 * 60 * 24 * 10,
    brandId: "brand_1",
    brandName: "The Brew Yard Café",
    brandAvatar: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=400&q=80",
    title: "The Brew Yard — Monsoon Menu Launch Reels",
    description: "Looking for 5 local food & café creators to cover our new monsoon menu — think cozy corners, filter coffee, and comfort snacks. Keep it real and neighbourhood-relatable, not overly polished.",
    budget: "₹4,000",
    location: "Chandigarh, India",
    deadline: Date.now() + 1000 * 60 * 60 * 24 * 10,
    tags: ["Food & Café", "Lifestyle"],
    requirements: [
      "Minimum 5,000 followers, based near Chandigarh",
      "Comfortable filming in-café during peak hours",
      "1 Reel + 2 Stories covering at least 3 menu items"
    ],
    requiredVideos: 1,
    requiredStories: 2,
    applicationsCount: 4,
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2
  },
  {
    id: "brief_2",
    deliverables: "1 Reel + 3 progress Stories",
    talentType: "INFLUENCER",
    slots: 1,
    slotsFilled: 1,
    status: "FILLED",
    startsOn: Date.now() + 1000 * 60 * 60 * 24 * 8,
    endsOn: Date.now() + 1000 * 60 * 60 * 24 * 14,
    brandId: "brand_2",
    brandName: "Glow Studio Salon",
    brandAvatar: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&q=80",
    title: "The 14-Day Glow Facial Challenge",
    description: "Seeking a local beauty creator to document a real 14-day hydrating facial routine at our studio. Honest before/after, no heavy filters.",
    budget: "₹3,000",
    location: "Pune, India",
    deadline: Date.now() + 1000 * 60 * 60 * 24 * 14,
    tags: ["Beauty & Salon", "Skincare", "Wellness"],
    requirements: [
      "Local audience near Pune",
      "No heavy filtering; authentic skin texture showcase",
      "1 Hero Reel + 3 Progress Stories"
    ],
    requiredVideos: 1,
    requiredStories: 3,
    applicationsCount: 3,
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 4
  },
  {
    id: "brief_3",
    deliverables: "1 day-in-the-life Reel + 2 Stories",
    talentType: "INFLUENCER",
    slots: 1,
    slotsFilled: 0,
    status: "OPEN",
    endsOn: Date.now() + 1000 * 60 * 60 * 24 * 18,
    brandId: "brand_3",
    brandName: "FitZone Studio",
    brandAvatar: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=400&q=80",
    title: "New Year Fitness Challenge Promo",
    description: "Need a local fitness creator to promote our 30-day New Year Transformation Challenge — training day-in-the-life plus a sign-up call-to-action.",
    budget: "₹5,000",
    location: "Bengaluru, India",
    deadline: Date.now() + 1000 * 60 * 60 * 24 * 18,
    tags: ["Fitness", "Wellness"],
    requirements: [
      "Local Bengaluru audience preferred",
      "1 training day-in-the-life Reel + 2 Stories",
      "Clear call-to-action for sign-ups"
    ],
    requiredVideos: 1,
    requiredStories: 2,
    applicationsCount: 2,
    timestamp: Date.now() - 1000 * 60 * 60 * 24 * 1
  },
  {
    id: "brief_4",
    deliverables: "One 2-hour evening set (8 to 10 pm)",
    talentType: "ANY",
    slots: 1,
    slotsFilled: 0,
    status: "OPEN",
    endsOn: Date.now() + 1000 * 60 * 60 * 24 * 9,
    brandId: "brand_1",
    brandName: "The Brew Yard Café",
    brandAvatar: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=400&q=80",
    title: "Friday Night Live at The Brew Yard",
    description: "We're starting a Friday live night on our terrace. Looking for one act for the launch night: a DJ, a band or a comedy set. Around 80 guests, sound system provided.",
    budget: "₹8,000",
    location: "Sector 17, Chandigarh",
    deadline: Date.now() + 1000 * 60 * 60 * 24 * 9,
    tags: ["Events", "Food & Café"],
    requirements: [],
    applicationsCount: 3,
    timestamp: Date.now() - 1000 * 60 * 60 * 20
  }
].map(b => ({ ...b, isDemo: true }));

// Demo applications for the campaign matching flow. Simran is already
// booked on the Glow Studio campaign, whose dates overlap the Brew Yard reels
// brief, so selecting her there shows the scheduling-clash warning.
const HOUR = 1000 * 60 * 60;
export const SEED_APPLICATIONS = [
  { briefId: "brief_1", creatorId: "creator_1", status: "PENDING", createdAt: Date.now() - HOUR * 30, pitch: "I cover cafés around Sector 17 every week and most of my audience is local. I'd shoot the monsoon menu at golden hour in your corner seats." },
  { briefId: "brief_1", creatorId: "creator_4", status: "PENDING", createdAt: Date.now() - HOUR * 26, pitch: "Happy to style a cosy monsoon look around the menu. My followers love café outfits." },
  { briefId: "brief_1", creatorId: "creator_2", status: "PENDING", createdAt: Date.now() - HOUR * 20, pitch: "" },
  { briefId: "brief_1", creatorId: "creator_3", status: "PENDING", createdAt: Date.now() - HOUR * 7, pitch: "Would love to do a cosy 'rainy day treat yourself' reel with your filter coffee." },
  { briefId: "brief_4", creatorId: "dj_1", status: "PENDING", createdAt: Date.now() - HOUR * 18, pitch: "Can do a chilled early set that builds up to Bollywood-house by 9:30. I bring my own controller." },
  { briefId: "brief_4", creatorId: "comic_1", status: "PENDING", createdAt: Date.now() - HOUR * 12, pitch: "30 minutes of clean, family-friendly stand-up, and I'll host the rest of the night." },
  { briefId: "brief_4", creatorId: "band_1", status: "PENDING", createdAt: Date.now() - HOUR * 5, pitch: "An acoustic-leaning 90-minute set that suits a terrace crowd: originals and Hindi rock covers." },
  { briefId: "brief_2", creatorId: "creator_1", status: "SELECTED", createdAt: Date.now() - HOUR * 80, decidedAt: Date.now() - HOUR * 60, pitch: "I do honest skincare diaries, happy to document all 14 days." },
  { briefId: "brief_3", creatorId: "creator_2", status: "PENDING", createdAt: Date.now() - HOUR * 3, pitch: "This is my home gym crowd. I can film a real training day." }
].map(a => ({ decidedAt: null, matchId: null, ...a }));


export const SEED_MATCHES = [
  {
    id: "match_1",
    users: ["creator_1", "brand_1"],
    otherUser: {
      id: "brand_1",
      name: "The Brew Yard Café",
      role: "BUSINESS",
      avatar: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=400&q=80",
      company: "The Brew Yard",
      tags: ["Food & Café", "Lifestyle"]
    },
    lastMessage: "Proposal sent: Monsoon Menu Café Reel (₹4,000)",
    lastSenderId: "brand_1",
    lastActive: Date.now() - 1000 * 60 * 25,
    aiMatchReason: "94% Match: Strong local food-audience overlap and consistent café content style.",
    messages: [
      {
        id: "msg_1",
        senderId: "brand_1",
        text: "Hey Simran! Loved your last café roundup. We're launching a monsoon menu next week and would love you to cover it.",
        timestamp: Date.now() - 1000 * 60 * 180,
        read: true,
        type: "text"
      },
      {
        id: "msg_2",
        senderId: "creator_1",
        text: "Hi! That sounds fun, I've actually been wanting to feature The Brew Yard. What's the timeline you're thinking?",
        timestamp: Date.now() - 1000 * 60 * 120,
        read: true,
        type: "text"
      },
      {
        id: "msg_3",
        senderId: "brand_1",
        text: "We'd like it live by next weekend. Here's a Smart Proposal with the deliverables and the fee:",
        timestamp: Date.now() - 1000 * 60 * 30,
        read: true,
        type: "proposal",
        proposalData: {
          id: "prop_1",
          title: "Monsoon Menu Café Reel + Stories",
          price: "₹4,000",
          deadline: "Oct 15, 2026",
          status: "PENDING",
          description: "1 Instagram Reel (min 30 seconds) covering 3 monsoon menu items + 2 Stories tagging the café.",
          senderSignature: "The Brew Yard Café"
        }
      }
    ]
  },
  {
    id: "match_2",
    users: ["creator_3", "brand_2"],
    otherUser: {
      id: "brand_2",
      name: "Glow Studio Salon",
      role: "BUSINESS",
      avatar: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&q=80",
      company: "Glow Studio",
      tags: ["Beauty & Salon", "Wellness"]
    },
    lastMessage: "Would you be interested in featuring our new hydrating facial?",
    lastSenderId: "brand_2",
    lastActive: Date.now() - 1000 * 60 * 60 * 4,
    aiMatchReason: "88% Match: Overlapping beauty-audience niche and nearby location.",
    messages: [
      {
        id: "msg_201",
        senderId: "brand_2",
        text: "Hi Priya! We love your honest skincare reviews and think our new hydrating facial would fit your glow-up routine content. Interested in a quick collab?",
        timestamp: Date.now() - 1000 * 60 * 60 * 4,
        read: false,
        type: "text"
      }
    ]
  }
];
