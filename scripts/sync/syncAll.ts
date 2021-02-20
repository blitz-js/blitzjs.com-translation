/**
 * Run [command] on the given [configFile] on all languages in the given [langDir]
 *
 * ```
 * runAll [command] [configfile] [langDir]
 * ```
 */
import * as fs from "fs/promises"
import {map as mapAsync} from "bluebird"
import * as shell from "shelljs"
import {formatISO, subDays} from "date-fns"

import syncOne from "./syncOne"
import {CONFIG, getJSON, LangSchema, octokit} from "../_utils"

async function main() {
  const langFiles = await fs.readdir("langs")
  const langs = await mapAsync(langFiles, async (file) => {
    const data = await getJSON(`langs/${file}`)
    return LangSchema.parse(data)
  })

  shell.mkdir("repos")
  shell.cd("repos")

  let newCommits: boolean
  try {
    const {data: commits} = await octokit.repos.listCommits({
      owner: CONFIG.org,
      repo: CONFIG.mainRepo,
      sha: CONFIG.defaultBranch,
      since: formatISO(subDays(new Date(), 7)),
    })
    newCommits = commits.length > 0
  } catch (error) {
    newCommits = false
  }

  if (!newCommits) {
    console.log("No new commits")
    return
  }

  await mapAsync(langs, syncOne, {concurrency: CONFIG.concurrency})
}

main()
