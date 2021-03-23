/**
 * Run [command] on the given [configFile] on all languages in the given [langDir]
 *
 * ```
 * runAll [command] [configfile] [langDir]
 * ```
 */
import fs from "fs/promises"
import {map as mapAsync} from "bluebird"
import * as shell from "shelljs"
import {formatISO, subDays} from "date-fns"

import {CONFIG, octokit} from "../_utils"

async function main() {
  const langFiles = await fs.readdir("langs")

  shell.mkdir("-p", "repos")

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

  await mapAsync(
    langFiles,
    (langFile) => shell.exec(`node scripts/sync/syncOne.js ${langFile}`, {async: true}),
    {concurrency: CONFIG.concurrency},
  )
}

main()
