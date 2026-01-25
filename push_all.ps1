# Pushes current branch to all remotes (force overwrite)

# Get current branch
$branch = git rev-parse --abbrev-ref HEAD

# Prompt for commit message
$commitMessage = Read-Host "Enter commit message"

# Stage all changes and commit
git add -A
git commit -m "$commitMessage"

# Get remotes
$remotes = git remote

Write-Output "⚡ Force pushing branch '$branch' to all remotes with commit message: '$commitMessage' ..."
foreach ($remote in $remotes) {
    Write-Output "🔄 Pushing to $remote..."
    git push --force $remote $branch
}
Write-Output "✅ All force pushes complete!"

# Note: Use force push with caution as it can overwrite changes in the remote repository.
# Ensure you have the necessary permissions to push to the remotes.
# If you encounter any issues, check your SSH keys and GitHub access.
#if you want to push to a specific branch, you can modify the script to include the branch name in the push command.
#example: git push --force $remote $branch:branch_name
