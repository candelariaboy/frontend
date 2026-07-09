import type { CertificateRecord } from "../types"

export type SuggestedCertificate = {
  id: string
  title: string
  provider: string
  url: string
  rewardXp: number
  providerAliases: string[]
  matchTokens: string[]
  groups: string[]
}

const SUGGESTED_CERTIFICATES: SuggestedCertificate[] = [
  {
    id: "fcc-rwd",
    title: "Responsive Web Design Certification",
    provider: "freeCodeCamp",
    url: "https://www.freecodecamp.org/learn/responsive-web-design/",
    rewardXp: 720,
    providerAliases: ["freecodecamp", "free code camp"],
    matchTokens: ["responsive web design", "responsive-web-design", "html", "css"],
    groups: ["frontend"],
  },
  {
    id: "fcc-js",
    title: "JavaScript Algorithms and Data Structures",
    provider: "freeCodeCamp",
    url: "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/",
    rewardXp: 780,
    providerAliases: ["freecodecamp", "free code camp"],
    matchTokens: ["javascript algorithms", "data structures", "javascript", "algorithms"],
    groups: ["frontend", "backend"],
  },
  {
    id: "fcc-react",
    title: "React Basics (via Frontend Certification)",
    provider: "freeCodeCamp",
    url: "https://www.freecodecamp.org/learn/front-end-development-libraries/",
    rewardXp: 740,
    providerAliases: ["freecodecamp", "free code camp"],
    matchTokens: ["react", "frontend", "ui", "javascript library", "component"],
    groups: ["frontend"],
  },
  {
    id: "odin-fullstack",
    title: "Full Stack JavaScript Path",
    provider: "The Odin Project",
    url: "https://www.theodinproject.com/paths/full-stack-javascript",
    rewardXp: 760,
    providerAliases: ["the odin project", "odin project"],
    matchTokens: ["full stack javascript", "odin full stack", "full-stack", "node"],
    groups: ["frontend", "backend"],
  },
  {
    id: "mslearn-web-dev",
    title: "Web Development for Beginners",
    provider: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/training/modules/build-simple-website/",
    rewardXp: 680,
    providerAliases: ["microsoft learn", "microsoft"],
    matchTokens: ["web development", "html", "css", "javascript", "web"],
    groups: ["frontend"],
  },
  {
    id: "fcc-backend",
    title: "Back End Development and APIs",
    provider: "freeCodeCamp",
    url: "https://www.freecodecamp.org/learn/back-end-development-and-apis/",
    rewardXp: 800,
    providerAliases: ["freecodecamp", "free code camp"],
    matchTokens: ["back end development and apis", "backend", "api", "server", "node"],
    groups: ["backend"],
  },
  {
    id: "fastapi-tutorial",
    title: "FastAPI - Complete Tutorial",
    provider: "FastAPI Official Docs",
    url: "https://fastapi.tiangolo.com/tutorial/",
    rewardXp: 750,
    providerAliases: ["fastapi", "fast api"],
    matchTokens: ["fastapi", "api", "backend", "python api"],
    groups: ["backend"],
  },
  {
    id: "mslearn-backend",
    title: "Build Web APIs with ASP.NET Core",
    provider: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/training/paths/build-web-apis-with-aspnet-core/",
    rewardXp: 710,
    providerAliases: ["microsoft learn", "microsoft"],
    matchTokens: ["web api", "api development", "backend", "service"],
    groups: ["backend"],
  },
  {
    id: "fcc-database",
    title: "Relational Database Certification (SQL & PostgreSQL)",
    provider: "freeCodeCamp",
    url: "https://www.freecodecamp.org/learn/relational-database/",
    rewardXp: 790,
    providerAliases: ["freecodecamp", "free code camp"],
    matchTokens: ["relational database", "sql", "database", "postgresql", "crud"],
    groups: ["database", "backend", "data"],
  },
  {
    id: "mongodb-university",
    title: "MongoDB Basics Course",
    provider: "MongoDB University",
    url: "https://learn.mongodb.com/courses/",
    rewardXp: 700,
    providerAliases: ["mongodb university", "mongodb"],
    matchTokens: ["mongodb", "nosql", "database"],
    groups: ["database", "backend", "data"],
  },
  {
    id: "fcc-data-analysis",
    title: "Data Analysis with Python",
    provider: "freeCodeCamp",
    url: "https://www.freecodecamp.org/learn/data-analysis-with-python/",
    rewardXp: 840,
    providerAliases: ["freecodecamp", "free code camp"],
    matchTokens: ["data analysis with python", "pandas", "analytics", "data science"],
    groups: ["data", "ai"],
  },
  {
    id: "fcc-ml",
    title: "Machine Learning with Python",
    provider: "freeCodeCamp",
    url: "https://www.freecodecamp.org/learn/machine-learning-with-python/",
    rewardXp: 920,
    providerAliases: ["freecodecamp", "free code camp"],
    matchTokens: ["machine learning", "ml", "scikit-learn", "ai", "neural"],
    groups: ["data", "ai"],
  },
  {
    id: "kaggle-ml",
    title: "Intro to Machine Learning",
    provider: "Kaggle Learn",
    url: "https://www.kaggle.com/learn/intro-to-machine-learning",
    rewardXp: 760,
    providerAliases: ["kaggle learn", "kaggle"],
    matchTokens: ["intro to machine learning", "kaggle", "ml beginner"],
    groups: ["data", "ai"],
  },
  {
    id: "deeplearning-ai",
    title: "Machine Learning for Beginners",
    provider: "DeepLearning.AI",
    url: "https://www.deeplearning.ai/short-courses/",
    rewardXp: 730,
    providerAliases: ["deeplearning.ai", "deeplearning", "andrew ng"],
    matchTokens: ["machine learning", "deep learning", "neural networks"],
    groups: ["data", "ai"],
  },
  {
    id: "fcc-qa",
    title: "Quality Assurance Testing Certification",
    provider: "freeCodeCamp",
    url: "https://www.freecodecamp.org/learn/quality-assurance/",
    rewardXp: 730,
    providerAliases: ["freecodecamp", "free code camp"],
    matchTokens: ["quality assurance", "qa", "testing", "test automation", "playwright"],
    groups: ["qa", "backend"],
  },
  {
    id: "fcc-info-sec",
    title: "Information Security Certification",
    provider: "freeCodeCamp",
    url: "https://www.freecodecamp.org/learn/information-security/",
    rewardXp: 820,
    providerAliases: ["freecodecamp", "free code camp"],
    matchTokens: ["information security", "security", "authentication", "oauth", "jwt"],
    groups: ["security", "devops"],
  },
  {
    id: "cisco-networking",
    title: "Networking Basics (Cisco Skills for All)",
    provider: "Cisco Networking Academy",
    url: "https://www.netacad.com/courses/networking-basics",
    rewardXp: 760,
    providerAliases: ["cisco networking academy", "netacad", "cisco"],
    matchTokens: ["networking", "tcp", "ip", "socket"],
    groups: ["networking", "devops"],
  },
  {
    id: "cisco-cyber",
    title: "Introduction to Cybersecurity (Cisco)",
    provider: "Cisco Networking Academy",
    url: "https://www.netacad.com/courses/cybersecurity/introduction-cybersecurity",
    rewardXp: 780,
    providerAliases: ["cisco networking academy", "netacad", "cisco"],
    matchTokens: ["cybersecurity", "security", "threat", "vulnerability"],
    groups: ["security", "networking"],
  },
  {
    id: "docker-essentials",
    title: "Docker Essentials - Getting Started",
    provider: "Docker Official Training",
    url: "https://docker-docs.umd.edu/guides/docker-fundamentals/",
    rewardXp: 770,
    providerAliases: ["docker", "containerization"],
    matchTokens: ["docker", "container", "devops", "deployment"],
    groups: ["devops", "cloud"],
  },
  {
    id: "aws-cloud",
    title: "AWS Cloud Practitioner Essentials",
    provider: "AWS Skill Builder",
    url: "https://explore.skillbuilder.aws/learn/course/15091/aws-cloud-practitioner-essentials",
    rewardXp: 780,
    providerAliases: ["aws skill builder", "aws"],
    matchTokens: ["cloud", "aws", "ec2", "s3"],
    groups: ["cloud", "devops"],
  },
  {
    id: "mslearn-devops",
    title: "DevOps Engineer Learning Path",
    provider: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/training/career-paths/devops-engineer",
    rewardXp: 800,
    providerAliases: ["microsoft learn", "microsoft"],
    matchTokens: ["devops", "ci", "cd", "pipeline", "deployment"],
    groups: ["cloud", "devops"],
  },
  {
    id: "gcloud-data-ml",
    title: "Google Cloud Machine Learning Fundamentals",
    provider: "Google Cloud Skills Boost",
    url: "https://www.cloudskillsboost.google/quests/32",
    rewardXp: 790,
    providerAliases: ["google cloud skills boost", "gcp"],
    matchTokens: ["cloud", "gcp", "machine learning", "bigquery"],
    groups: ["cloud", "data", "ai"],
  },
  {
    id: "sololearn-python",
    title: "Python for Beginners",
    provider: "SoloLearn",
    url: "https://www.sololearn.com/learn/courses/python-for-beginners",
    rewardXp: 680,
    providerAliases: ["sololearn"],
    matchTokens: ["python", "programming", "backend"],
    groups: ["backend", "data"],
  },
  {
    id: "linux-academy",
    title: "Linux Fundamentals",
    provider: "Linux Academy / A Cloud Guru",
    url: "https://acloudguru.com/course/linux-command-line-basics",
    rewardXp: 740,
    providerAliases: ["linux academy", "a cloud guru"],
    matchTokens: ["linux", "bash", "shell", "deployment"],
    groups: ["devops", "cloud"],
  },
  {
    id: "git-github",
    title: "Git & GitHub for Beginners",
    provider: "Udemy / freeCodeCamp",
    url: "https://www.freecodecamp.org/learn/git-and-github/",
    rewardXp: 650,
    providerAliases: ["freecodecamp", "udemy"],
    matchTokens: ["git", "github", "version control"],
    groups: ["backend", "devops"],
  },
  {
    id: "ibm-blockchain",
    title: "Blockchain Essentials",
    provider: "IBM SkillsBuild",
    url: "https://skillsbuild.org/",
    rewardXp: 760,
    providerAliases: ["ibm skillsbuild", "ibm"],
    matchTokens: ["blockchain essentials", "blockchain", "web3"],
    groups: ["blockchain"],
  },
]

export const DEFAULT_SUGGESTED_CERTIFICATE_LIMIT = 6

const GROUP_KEYWORDS: Record<string, string[]> = {
  frontend: ["frontend", "front end", "front-end", "react", "vue", "angular", "ui", "css", "html", "javascript", "typescript", "web", "responsive", "jsx", "tsx", "full stack", "full-stack"],
  backend: ["backend", "back end", "back-end", "api", "server", "fastapi", "express", "django", "flask", "node", "service", "endpoint", "rest", "full stack", "full-stack"],
  database: ["database", "sql", "postgres", "postgresql", "mysql", "mongodb", "supabase", "crud", "orm", "nosql"],
  data: ["data", "analytics", "analysis", "python", "pandas", "numpy", "notebook", "tableau", "powerbi"],
  ai: ["ai", "ml", "machine learning", "deep learning", "llm", "neural", "tensorflow", "pytorch", "scikit-learn"],
  qa: ["test", "testing", "qa", "quality assurance", "playwright", "pytest", "jest", "cypress", "automation"],
  security: ["security", "cyber", "auth", "oauth", "jwt", "owasp", "vulnerability", "encryption", "ctf"],
  networking: ["network", "networking", "tcp", "ip", "routing", "switching", "socket", "websocket", "http"],
  devops: ["devops", "docker", "kubernetes", "ci", "cd", "pipeline", "linux", "bash", "powershell", "deployment", "jenkins"],
  cloud: ["cloud", "aws", "azure", "gcp", "google cloud", "serverless", "terraform", "ec2", "s3", "lambda"],
  mobile: ["mobile", "android", "ios", "flutter", "react native", "kotlin", "swift"],
  blockchain: ["blockchain", "web3", "smart contract", "solidity", "ethereum", "crypto"],
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function collectActiveGroups(learningPathText: string) {
  const groups = new Set<string>()
  const text = normalizeText(learningPathText)

  // Only use learning path text to infer groups, not practice dimensions
  for (const [group, keywords] of Object.entries(GROUP_KEYWORDS)) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      groups.add(group)
    }
  }

  return groups
}

function scoreSuggestion(text: string, item: SuggestedCertificate) {
  const haystack = normalizeText(text)
  const tokens = [item.title, item.provider, ...item.matchTokens]
  return tokens.reduce((sum, token) => sum + (haystack.includes(normalizeText(token)) ? 1 : 0), 0)
}

function rankLearningPathSuggestions(
  learningPathText: string,
  targetGroups: Set<string>,
  reasonPrefix: string,
  maxCount?: number | null
) {
  const scored = SUGGESTED_CERTIFICATES
    .filter((item) => item.groups.some((group) => targetGroups.has(group)))
    .map((item) => {
      const matchedGroups = item.groups.filter((group) => targetGroups.has(group))
      const displayNames = matchedGroups.map(getGroupDisplayName)
      const reasoning = displayNames.length > 0
        ? `${reasonPrefix} ${displayNames.join(" & ")}.`
        : "Aligned with your learning path."
      return {
        ...item,
        reasoning,
        score: scoreSuggestion(learningPathText, item),
      }
    })

  const directMatches = scored.filter((item) => item.score > 0)
  const ranked = (directMatches.length > 0 ? directMatches : scored).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.rewardXp - a.rewardXp
  })
  const limit = typeof maxCount === "number" ? Math.max(0, maxCount) : null
  const limited = limit === null ? ranked : ranked.slice(0, limit)

  return limited.map(({ score, ...item }) => item)
}

const GROUP_DISPLAY_NAMES: Record<string, string> = {
  frontend: "Web Development",
  backend: "Backend & APIs",
  database: "Databases & SQL",
  qa: "Quality Assurance",
  data: "Data Science",
  ai: "AI & Machine Learning",
  cloud: "Cloud & DevOps",
  devops: "Cloud & DevOps",
  mobile: "Mobile Development",
  blockchain: "Blockchain & Web3",
}

export type SuggestedCertificateWithReasoning = SuggestedCertificate & {
  reasoning: string
}

export function getGroupDisplayName(group: string): string {
  return GROUP_DISPLAY_NAMES[group] || group
}

export function inferSuggestedCertificates(learningPathText: string): SuggestedCertificateWithReasoning[] {
  const activeGroups = collectActiveGroups(learningPathText)
  if (activeGroups.size === 0) return []

  return rankLearningPathSuggestions(
    learningPathText,
    activeGroups,
    "Aligned with your learning path in",
    DEFAULT_SUGGESTED_CERTIFICATE_LIMIT
  )
}

export function inferSuggestedCertificatesForCareer(
  learningPathText: string,
  careerText: string,
  maxCount: number | null = DEFAULT_SUGGESTED_CERTIFICATE_LIMIT
): SuggestedCertificateWithReasoning[] {
  const activeGroups = collectActiveGroups(learningPathText)
  const careerGroups = collectActiveGroups(careerText)
  const hasCareerGroups = careerGroups.size > 0

  let targetGroups = activeGroups
  if (hasCareerGroups && activeGroups.size > 0) {
    targetGroups = new Set([...activeGroups].filter((group) => careerGroups.has(group)))
    if (targetGroups.size === 0) targetGroups = careerGroups
  } else if (hasCareerGroups) {
    targetGroups = careerGroups
  }

  if (targetGroups.size === 0) return []

  const combinedText = `${learningPathText} ${careerText}`
  return rankLearningPathSuggestions(
    combinedText,
    targetGroups,
    "Aligned with your career track in",
    maxCount
  )
}

export function matchCertificateToSuggestion(
  suggestion: SuggestedCertificate,
  rows: CertificateRecord[]
) {
  return rows.find((row) => {
    const provider = normalizeText(String(row.provider || ""))
    const haystack = normalizeText(
      `${row.provider || ""} ${row.title || ""} ${row.certificate_url || ""} ${row.certificate_page_url || ""}`
    )

    const providerMatch = suggestion.providerAliases.some((alias) => provider.includes(normalizeText(alias)))
    const tokenMatch = suggestion.matchTokens.some((token) => haystack.includes(normalizeText(token)))

    if (providerMatch && tokenMatch) return true
    return haystack.includes(normalizeText(suggestion.title)) || haystack.includes(normalizeText(suggestion.url))
  })
}

export function matchCertificatesToSuggestion(
  suggestion: SuggestedCertificate,
  rows: CertificateRecord[]
) {
  return rows.filter((row) => {
    const provider = normalizeText(String(row.provider || ""))
    const haystack = normalizeText(
      `${row.provider || ""} ${row.title || ""} ${row.certificate_url || ""} ${row.certificate_page_url || ""}`
    )

    const providerMatch = suggestion.providerAliases.some((alias) => provider.includes(normalizeText(alias)))
    const tokenMatch = suggestion.matchTokens.some((token) => haystack.includes(normalizeText(token)))

    if (providerMatch && tokenMatch) return true
    return haystack.includes(normalizeText(suggestion.title)) || haystack.includes(normalizeText(suggestion.url))
  })
}

export function summarizeSuggestionProgress(
  suggestions: SuggestedCertificate[],
  rows: CertificateRecord[]
) {
  const matched = suggestions.map((item) => matchCertificateToSuggestion(item, rows)).filter(Boolean) as CertificateRecord[]
  const started = matched.filter((row) => {
    const status = normalizeText(String(row.status || "pending"))
    return status === "pending" || status === "verified"
  }).length
  const completed = matched.filter((row) => Boolean(row.completion_locked) || normalizeText(String(row.status || "")) === "verified").length
  const total = suggestions.length
  const overall = total ? Math.round((completed / total) * 100) : 0

  return {
    overall,
    started,
    completed,
    total,
    remaining: Math.max(0, total - completed),
  }
}
