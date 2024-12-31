import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const REPO_OWNER = "jayywalker";
const REPO_NAME = "craftwriter";
const STORIES_FOLDER = path.resolve(__dirname, '../', "./stories");
const TRACKING_FILE = path.resolve(__dirname, '../', "./stories/.pushed_stories.json");

if (!GITHUB_TOKEN) {
  console.error("GitHub token is not set. Please provide it as an environment variable.");
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * Loads tracking data from the tracking file, or initializes an empty object if the file doesn't exist.
 * @returns Record<string, string> - A mapping of file paths to their respective hash values.
 */
function loadTrackingData(): Record<string, string> {
  if (fs.existsSync(TRACKING_FILE)) {
    return JSON.parse(fs.readFileSync(TRACKING_FILE, "utf8"));
  }
  return {};
}

/**
 * Saves tracking data to the tracking file.
 * @param data - The tracking data mapping file paths to hash values.
 */
function saveTrackingData(data: Record<string, string>): void {
  fs.writeFileSync(TRACKING_FILE, JSON.stringify(data, null, 2));
}

/**
 * Computes a SHA-256 hash for the content of a file.
 * @param filePath - The path of the file to hash.
 * @returns string - The computed hash value.
 */
function getFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf8");
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Extracts the issue data (title, labels, and body) from a markdown file.
 * @param fileContent - The content of the markdown file.
 * @returns { title: string; labels: string[]; body: string } - Extracted issue data.
 */
function parseStoryFile(fileContent: string): { title: string; labels: string[]; body: string } {
  const lines = fileContent.split("\n");

  let title = "";
  const labels: string[] = [];
  const body: string[] = [];
  let isBodySection = false;

  for (const line of lines) {
    if (line.startsWith("# ")) {
      const headline = lines[lines.indexOf(line)]?.trim() || "";

      title = headline.slice(2).trim();
    } else if (line.startsWith("## Labels")) {
      const labelLines = lines.slice(lines.indexOf(line) + 1);
      for (const labelLine of labelLines) {
        if (labelLine.trim().startsWith("-") && labelLine.trim().length > 1) {
          labels.push(labelLine.replace(/^-\s*/, "").trim());
        } else {
          break;
        }
      }
    } else if (line.startsWith("## ")) {
      isBodySection = true;
    }

    if (isBodySection && !line.startsWith("#")) {
      body.push(line);
    }
  }

  return { title, labels, body: body.join("\n").trim() };
}

/**
 * Pushes a story from a markdown file to GitHub as an issue.
 * @param filePath - The path of the markdown file.
 * @param trackingData - The record of previously pushed files and their hash values.
 */
async function pushStoryToGithub(filePath: string, trackingData: Record<string, string>): Promise<void> {
  const fileContent = fs.readFileSync(filePath, "utf8");
  const fileHash = getFileHash(filePath);

  if (trackingData[filePath] === fileHash) {
    console.log(`No changes detected for file: ${filePath}`);
    return;
  }

  const { title, labels, body } = parseStoryFile(fileContent);

  if (!title || !body) {
    console.error(`Invalid story structure in file: ${filePath}`);
    return;
  }

  try {
    const response = await octokit.rest.issues.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title,
      body,
      labels,
    });

    console.log(`Created issue #${response.data.number}: ${response.data.html_url}`);

    trackingData[filePath] = fileHash;
    saveTrackingData(trackingData);
  } catch (error) {
    console.error(`Failed to create issue for file: ${filePath}`, error);
  }
}

/**
 * Processes all markdown files in the stories folder, pushing them as issues if needed.
 */
function processStories(): void {
  const trackingData = loadTrackingData();

  const files = fs
    .readdirSync(STORIES_FOLDER)
    .filter((file) => file.endsWith(".md"));

  if (files.length === 0) {
    console.log("No markdown files found in the stories folder.");
    return;
  }

  files.forEach((file) => {
    const filePath = path.join(STORIES_FOLDER, file);
    pushStoryToGithub(filePath, trackingData);
  });
}

processStories();
