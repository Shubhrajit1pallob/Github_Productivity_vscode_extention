require('dotenv').config();

const vscode = require('vscode');
const {Octokit} = require("@octokit/rest");
const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');


let octokit
let git
let repoName
let repoPath

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	let disposable = vscode.commands.registerCommand('gitTracker.startTracking', async function () {

		const projectName = vscode.workspace.name

		//Check if a project is open
		if (!projectName) {
			vscode.window.showErrorMessage("Please open a project folder")
			return
		}

		repoName = `${projectName}-tracker`
		repoPath = path.join(vscode.workspace.rootPath || '', repoName);		// Pathe of the local repository.

		// Check if the repository already exists
		octokit = new Octokit({
			auth: process.env.GITHUB_TOKEN			// GitHub token
		});

		try {

			await octokit.repos.get({
				owner: process.env.GITHUB_USER,
				repo: repoName
			});

			// If the repository exists, show a message to the user
			vscode.window.showInformationMessage(`Repository ${repoName} already exists.`);

		} catch (error) {
			
			if (error.status === 404) {
				// Create the repository
				vscode.window.showInformationMessage(`Repository ${repoName} does not exist.`);
			} else {
				vscode.window.showErrorMessage(`An error occurred while checking the repository. Checking Repo: ${error.message}`);
			}
		}


		// Create the local repository
		git = simpleGit(repoPath);
		if (!fs.existsSync(repoPath)) {
			fs.mkdirSync(repoPath);
		}
		await git.init();
		await git.branch(['-M', 'main']);
		await git.addRemote('origin',  `https://github.com/YOUR_GITHUB_USERNAME/${repoName}.git`);		// This line has to be modified according to your git user name.

		setInterval(commitChanges, 30*60*1000);		// Commit changes every 30 minutes


	});

	context.subscriptions.push(disposable);
}

// Function helps to save and commit the changes to the repository.

async function commitChanges() {

	try {

		const summaryContent = generateSummaryContent();
		const timestamp = new Date().toISOString();
		const filePath = `logs/summary-${timestamp}.md`;

		let sha; 		// The SHA of the last commit

		try {

			const { data } = await octokit.repos.getCommit({
				owner: process.env.GITHUB_USER,
				repo: repoName,
				path: filePath
			});

			sha = data.sha;

		} catch (error) {
			
			if (error.status === 404) {
				vscode.window.showErrorMessage(`An error occurred while getting the file: ${error.message}`);
				return;
			}

		}

		await octokit.repos.createOrUpdateFileContents({
			owner: process.env.GITHUB_USER,
			repo: repoName,
			path: filePath,
			message: `Summary-time: ${timestamp}`,
			content: Buffer.from(summaryContent).toString('base64'),
			sha: sha
		});

		vscode.window.showInformationMessage('Changes committed successfully');

	} catch (error) {
		vscode.window.showErrorMessage(`An error occurred while committing changes: ${error.message}`);
	}

	
}


//Generate the summary content based on the users input.
async function generateSummaryContent() {

	try {

		const summaryContest = await vscode.window.showInputBox({
			prompt: "Enter your summary",
			placeHolder: 'What did you work on?',
			multiline: true
		});

		if (!summaryContest) {
			vscode.window.showErrorMessage('No summary content provided');
			throw new Error('No summary content provided');
		}

		return summaryContest;

	} catch (error) {
		throw new Error(`An error occurred while generating the summary content: ${error.message}`);
	}

}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
