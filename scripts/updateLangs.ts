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

  const doesRepoExists = async (repo: string) => {
    try {
      await octokit.repos.get({
        owner: org,
        repo,
      })
      return true
    } catch (error) {
      return false
    }
  }

  for await (const {code: langCode, name: langName, maintainers} of langs) {
    const logger = log4js.getLogger(langCode)
    logger.level = "info"

    try {
      const newRepoName = `${langCode}.${mainRepo}`

      if (await doesRepoExists(newRepoName)) {
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
      } else {
        // Create repo!!

        logger.debug("Creating new repo in GitHub...")
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

        await octokit.repos.updateBranchProtection({
          owner: org,
          repo: newRepoName,
          branch: defaultBranch,
          required_pull_request_reviews: {
            required_approving_review_count: 1,
            dismiss_stale_reviews: true,
          },
          allow_force_pushes: false,
          restrictions: null,
          enforce_admins: null,
          required_status_checks: null,
        })
      }

      logger.info("Finished!")
    } catch (error) {
      logger.error(error)
    }
  }
}

main()
