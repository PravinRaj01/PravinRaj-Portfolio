# Run this ONCE to add all remotes

$remotes = @{
    "repo1" = "git@github.com:PravinRaj01/clinimate-project.git"
    "repo2" = "git@github.com:PravinRaj01/my-clini-mate.git"
    "repo3" = "git@github.com:PravinRaj01/your-clini-companion.git"
    "repo4" = "git@github.com:PravinRaj01/quackalicious-clinimate-ai.git"
    "repo5" = "git@github.com:PravinRaj01/clinimate-dr-quack-buddy.git"
    "repo6" = "git@github.com:PravinRaj01/clini-mate-buddy.git"
    "repo7" = "git@github.com:PravinRaj01/clini-ma-te-pravinrajggb.git"
    "repo8" = "git@github.com:PravinRaj01/clinimate-aid-naan-than-.git"
    "repo9" = "git@github.com:PravinRaj01/clinimate-friendly-future.git"
    "repo10" = "git@github.com:PravinRaj01/observe-and-ponder.git"
    "repo11" = "git@github.com:PravinRaj01/clinimate-ai-buddy.git"
    "repo12" = "git@github.com:PravinRaj01/clinic-mate-ai.git"
    "repo13" = "git@github.com:PravinRaj01/clinimate-your-guide.git"
    "repo14" = "git@github.com:PravinRaj01/vital-ai-mate.git"
    "repo15" = "git@github.com:PravinRaj01/clinimate-your-climate-buddy.git"
    "repo16" = "git@github.com:PravinRaj01/clinic-ai-mate.git"

}

foreach ($remote in $remotes.Keys) {
    Write-Output "Adding remote $remote..."
    git remote add $remote $remotes[$remote]
}

Write-Output "✅ All remotes added! Use 'git remote -v' to verify."

# Note: Ensure you have the necessary permissions to add remotes to the repository.
# If you encounter any issues, check your SSH keys and GitHub access.