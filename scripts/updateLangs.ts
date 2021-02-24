/**
 * Create a new translation of the original repo with the info in [lang config].
 *
 * YOU MUST HAVE ADMIN ACCESS TO THE ORGANIZATION FOR THIS TO WORK.
 * BEHAVIOR IF YOU ARE NOT AN OWNER IS UNDEFINED.
 *
 * ```
 * yarn update-langs [langs files]
 * ```
 */
import * as fs from "fs/promises"
import * as shell from "shelljs"
import * as log4js from "log4js"
import {CONFIG, LangSchema, getGitHubRepo, getJSON, octokit} from "./_utils"
// shell.config.silent = true;

const branchIsProtected = async (owner: string, repo: string, branch: string) => {
  const {data} = await octokit.repos.getBranchProtection({owner, repo, branch})
  return data.required_pull_request_reviews?.require_code_owner_reviews !== undefined
}

const activateBranchProtection = (owner: string, repo: string, branch: string) =>
  octokit.repos.updateBranchProtection({
    owner,
    repo,
    branch,
    required_pull_request_reviews: {
      required_approving_review_count: 1,
      dismiss_stale_reviews: true,
    },
    allow_force_pushes: false,
    restrictions: null,
    enforce_admins: null,
    required_status_checks: null,
  })

const doesRepoExists = async (owner: string, repo: string) => {
  try {
    await octokit.repos.get({owner, repo})
    return true
  } catch (error) {
    return false
  }
}

async function main() {
  const langFiles = process.argv.slice(2)
  if (langFiles.length === 0) {
    throw new Error("Language config files not provided")
  }
  const langs = await Promise.all(
    langFiles
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const data = await getJSON(file)
        return LangSchema.parse(data)
      }),
  )
  const {org, mainRepo, defaultBranch} = CONFIG

  for await (const {code: langCode, name: langName, maintainers, branchProtection} of langs) {
    const logger = log4js.getLogger(langCode)
    logger.level = "info"

    try {
      const newRepoName = `${langCode}.${mainRepo}`

      if (await doesRepoExists(org, newRepoName)) {
        // Update maintainers

        const {data: originalMaintainers} = await octokit.repos.listCollaborators({
          owner: org,
          repo: newRepoName,
          affiliation: "direct",
          per_page: 100,
        })
        const originalMaintainersNames = originalMaintainers
          .filter((om) => om.type === "User")
          .map((om) => om.login.toLowerCase())
        const maintainersNames = maintainers.map((username) => username.toLowerCase())

        const newMaintainers = maintainersNames.filter(
          (username) => !originalMaintainersNames.includes(username),
        )
        const removedMaintainers = originalMaintainersNames.filter(
          (username) => !maintainersNames.includes(username) && username !== process.env.USER_NAME,
        )

        if (newMaintainers.length > 0) {
          logger.info("Adding maintainers...")
          await Promise.all(
            newMaintainers.map((username) =>
              octokit.repos.addCollaborator({
                owner: org,
                repo: newRepoName,
                username,
                permission: "maintain",
              }),
            ),
          )
        }

        if (removedMaintainers.length > 0) {
          logger.info("Removing maintainers...")
          await Promise.all(
            removedMaintainers.map((username) =>
              octokit.repos.removeCollaborator({
                owner: org,
                repo: newRepoName,
                username,
              }),
            ),
          )
        }

        if (await branchIsProtected(org, newRepoName, defaultBranch)) {
          if (!branchProtection) {
            logger.info("Removing branch protection...")
            await octokit.repos.deleteBranchProtection({
              owner: org,
              repo: newRepoName,
              branch: defaultBranch,
            })
          }
        } else {
          if (branchProtection) {
            logger.info("Adding branch protection...")
            await activateBranchProtection(org, newRepoName, defaultBranch)
          }
        }
      } else {
        // Create repo!!

        logger.info("Creating new repo in GitHub...")
        await octokit.repos.createInOrg({
          org,
          name: newRepoName,
          description: `(Work in progress) Blitzjs.com website in ${langName}!`,
        })
        logger.info("Finished creating repo!")

        logger.info("Inviting maintainers...")
        await Promise.all(
          maintainers.map((username) =>
            octokit.repos.addCollaborator({
              owner: org,
              repo: newRepoName,
              username,
              permission: "maintain",
            }),
          ),
        )

        logger.info("Creating Progress Issue...")
        const rawBody = await fs.readFile("./docs/PROGRESS.template.md", {encoding: "utf-8"})
        const maintainerList = maintainers.map((name) => `* @${name}`).join("\n")
        const body = rawBody.replace("{MAINTAINERS}\n", maintainerList)
        await octokit.issues.create({
          owner: org,
          repo: newRepoName,
          title: `${langName} Translation Progress`,
          body,
        })

        logger.trace("Setting up duplicate repo...")
        shell.exec(`git clone ${getGitHubRepo(org, mainRepo)} repo`)
        shell.cd("repo")
        shell.exec(`git remote add duplicated-repo ${getGitHubRepo(org, newRepoName)}`)
        shell.exec(`git push -u duplicated-repo ${defaultBranch}`)

        if (branchProtection) {
          logger.info("Adding branch protection...")
          await activateBranchProtection(org, newRepoName, defaultBranch)
        }
      }

      logger.info("Finished!")
    } catch (error) {
      logger.error(error)
    }
  }
}

main()
