import * as fs from "fs/promises"
import * as z from "zod"
import {Octokit} from "@octokit/rest"

export const CONFIG = {
  org: "blitz-js",
  mainRepo: "blitzjs.com",
  defaultBranch: "main",
  concurrency: 3,
}

export const LangSchema = z.object({
  name: z.string(),
  code: z.string(),
  maintainers: z.string().array().nonempty(),
})
export type LangType = z.infer<typeof LangSchema>

export const getJSON = async (file: string) =>
  JSON.parse(await fs.readFile(file, {encoding: "utf-8"}))

export const octokit = new Octokit({
  auth: `token ${process.env.PERSONAL_ACCESS_TOKEN}`,
})

export const getGitHubRepo = (owner: string, repo: string) =>
  `https://${process.env.USER_NAME}:${process.env.PERSONAL_ACCESS_TOKEN}@github.com/${owner}/${repo}.git`
