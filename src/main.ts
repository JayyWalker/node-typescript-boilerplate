import { fileURLToPath } from 'url'
import path, { dirname, resolve, join } from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { Octokit } from '@octokit/rest'

// THE TYPES
type Maybe<T> = T | undefined | null;

type FilePath = string

type ParsedStory = {
  title: string;
  labels: string[];
  milestone?: string | number;
  body: string;
}

type PushedStory = {
  issueNumber: number;
}

type TrackingEntryParams = {
  hash: string
  filePath: string
  issueNumber: number
}

type TrackedDataEntry = { issueNumber: number; hash: string }

type TrackedData = Record<FilePath, TrackedDataEntry>;

// UTILITIES
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// CONSTANTS
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''
const REPO_OWNER = 'jayywalker'
const REPO_NAME = 'craftwriter'
const STORIES_FOLDER = resolve(__dirname, '../', './stories')
const TRACKING_FILE = resolve(
  __dirname,
  '../',
  './stories/.pushed_stories.json',
)

const octokit = new Octokit({ auth: GITHUB_TOKEN })

if ( !GITHUB_TOKEN) {
  console.error('GitHub token is not set. Please provide it as an environment variable.')
  process.exit(1)
}

function scanForStories (): FilePath[] {
  const files = fs
    .readdirSync(STORIES_FOLDER)
    .filter((file) => file.endsWith('.md'))
    .map((file) => join(STORIES_FOLDER, file))

  if (files.length === 0) {
    console.log('No markdown files found in the stories folder.')

    return []
  }

  return files
}

function parseStoryFile (fileContent: string): ParsedStory {

  const lines = fileContent.split('\n')

  let title = ''
  const labels: string[] = []
  const body: string[] = []
  let milestone: string | undefined = undefined;
  let isBodySection = false
  let isLabelSection = false

  for (const line of lines) {
    // Get Headline
    if (line.startsWith('# ')) {
      const headline = lines[lines.indexOf(line)]?.trim() || ''

      title = headline.slice(2).trim()
    }

    // Get Labels
    if (line.startsWith('## Labels')) {
      isLabelSection = line.startsWith('## Labels')
    }

    if (isLabelSection && !line.startsWith('#')) {
      const labelLine = line.trim()

      if (labelLine.startsWith('-')) {
        const label = labelLine.replace(/^-\s*/, '')

        if (label === 'core-feature') {
          milestone = '1';
          labels.push('mvp')
        } else {
          labels.push(label)
        }
      }
    }

    // New section so let's reset isLabelSection
    if (isLabelSection && line.startsWith('#') && !line.startsWith('## Labels')) {
      isLabelSection = false
    }

    // Get Body Section
    if (line.startsWith('## ') && !line.startsWith('## Labels')) {
      isBodySection = true
      line.startsWith('## ')
    }

    if (isBodySection) {
      body.push(line)
    }

    // EOF
    if (lines.indexOf(line) === lines.length - 1) {
      isBodySection = false
    }
  }

  const parsedBody: ParsedStory = {
    title,
    labels,
    milestone,
    body: body.join('\n').trim(),
  }

  return parsedBody
}

function getFileHash (fileContent: string): string {
  return crypto.createHash('sha256').update(fileContent).digest('hex')
}

async function pushStoryToGithub ({ title, body, labels, milestone }: ParsedStory, trackedData?: TrackedDataEntry): Promise<PushedStory> {
  if (trackedData) {
    const response = await octokit.rest.issues.update({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: trackedData.issueNumber,
      title,
      body,
      labels,
      milestone: milestone || null,
    })

    return {
      issueNumber: response.data.number,
    }
  }

  const response = await octokit.rest.issues.create({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    title,
    body,
    labels,
    milestone: milestone || null,
  })

  console.log(`Created issue #${response.data.number}: ${response.data.html_url}`)

  return {
    issueNumber: response.data.number,
  }
}

function updateTrackingData(original: TrackedData, { filePath, issueNumber, hash}: TrackingEntryParams): void {
  const trackedFileName = getTrackedFileName(filePath)

  original[trackedFileName] = {issueNumber, hash}

  fs.writeFileSync(TRACKING_FILE, JSON.stringify(original, null, 2))

  console.log(`Updated tracking data: ${trackedFileName} -> ${issueNumber} - ${hash}`)
}

function loadTrackingData(): TrackedData {
  return fs.existsSync(TRACKING_FILE)
    ? JSON.parse(fs.readFileSync(TRACKING_FILE, "utf8"))
    : {}
}

function getTrackedFileName(filepath: string): string {
  return path.parse(filepath).base
}

async function main (): Promise<void> {
  const filePaths = scanForStories()

  const trackingData = loadTrackingData()

  for( const filePath of filePaths ) {
    const trackedData = trackingData[getTrackedFileName(filePath)]

    const fileContent = fs.readFileSync(filePath, 'utf8')

    const fileHash = getFileHash(fileContent)

    if (trackedData?.hash === fileHash) {
      console.log(`${getTrackedFileName(filePath)} already updated`)
      continue;
    }

    const parsedStory = parseStoryFile(fileContent)

    const { title, body } = parsedStory

    if (!title || !body) {
      console.error(`Invalid story structure in file: ${filePath}`);
      continue;
    }

    const { issueNumber } = await pushStoryToGithub(parsedStory, trackedData)

    updateTrackingData(trackingData, { hash: fileHash, issueNumber, filePath });
  }
}

main()
