import * as log4js from "log4js"
import * as shell from "shelljs"
import {CONFIG, getGitHubRepo, LangType, octokit} from "../_utils"

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#Getting_a_random_integer_between_two_values
function getRandomInt(min: number, max: number) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getRandomSubset(array: any[], n: number) {
  if (array.length <= n) {
    return array
  }
  const copy = [...array]
  let result: any[] = []
  while (result.length < n) {
    const i = getRandomInt(0, copy.length)
    result.push(copy.splice(i, 1))
  }
  return result
}

export default async function syncOne({code: langCode, maintainers}: LangType) {
  const logger = log4js.getLogger(langCode)
  logger.level = "info"

  try {
    const {org, mainRepo, defaultBranch} = CONFIG

    const transRepoName = `${langCode}.${mainRepo}`

    shell.exec(`git clone ${getGitHubRepo(org, transRepoName)}`)
    shell.cd(transRepoName)
    shell.exec(`git remote add mainRepo ${getGitHubRepo(org, mainRepo)}`)
    shell.exec(`git fetch mainRepo ${defaultBranch}`)

    shell.exec(`git config user.name ${process.env.USER_NAME}`)
    shell.exec(`git config user.email ${process.env.USER_EMAIL}`)
    shell.exec("git config pull.rebase false")

    const hash = shell.exec(`git rev-parse mainRepo/${defaultBranch}`).stdout
    const shortHash = hash.substr(0, 8)

    const syncBranch = `sync-${shortHash}`

    if (shell.exec(`git checkout ${syncBranch}`).code !== 0) {
      shell.exec(`git checkout -b ${syncBranch}`)
    }

    // Pull from {source}/{defaultBranch}
    const output = shell.exec(`git pull mainRepo ${defaultBranch}`).stdout
    if (output.includes("Already up to date.")) {
      logger.info(`We are already up to date with ${transRepoName}.`)
      return
    }
    const lines = output.split("\n")

    // Commit all merge conflicts
    const conflictLines = lines.filter((line) => line.startsWith("CONFLICT"))
    const conflictFiles = conflictLines.map((line) => line.substr(line.lastIndexOf(" ") + 1))

    shell.exec(`git commit -am "merging all conflicts"`)

    // If no conflicts, merge directly into {defaultBranch}
    if (conflictFiles.length === 0) {
      logger.info(`No conflicts found. Committing directly to ${defaultBranch}.`)
      shell.exec(`git checkout ${defaultBranch}`)
      shell.exec(`git merge ${syncBranch}`)
      shell.exec(`git push origin ${defaultBranch}`)
      return
    }

    logger.warn("conflict files: ", conflictFiles.join("\n"))

    // Create a new pull request, listing all conflicting files
    shell.exec(`git push --set-upstream origin ${syncBranch}`)

    const title = `Sync with main repo @ ${shortHash}`
    const body = [
      "This PR was automatically generated.",
      `Merge changes from [${mainRepo}](https://github.com/${org}/${mainRepo}/commits/${defaultBranch}) at ${shortHash}`,
      conflictFiles.length === 0
        ? "No conflicts were found."
        : [
            "The following files have conflicts and may need new translations:",
            conflictFiles
              .map(
                (file) => ` * [ ] [${file}](/${org}/${mainRepo}/commits/${defaultBranch}/${file})`,
              )
              .join("\n"),
            "Please fix the conflicts by pushing new commits to this pull request, either by editing the files directly on GitHub or by checking out this branch.",
          ].join("\n\n"),
      "## DO NOT SQUASH MERGE THIS PULL REQUEST!",
      `Doing so will "erase" the commits from ${defaultBranch} and cause them to show up as conflicts the next time we merge.`,
    ].join("\n\n")

    const {data: newPR} = await octokit.pulls.create({
      owner: org,
      repo: transRepoName,
      title,
      body,
      head: syncBranch,
      base: defaultBranch,
    })

    await octokit.pulls.requestReviewers({
      owner: org,
      repo: transRepoName,
      number: newPR.number,
      reviewers: getRandomSubset(maintainers, 3),
    })

    logger.info(`Finished ${transRepoName}`)
  } catch (error) {
    logger.error(error)
  }
}
