# Release workflow

When shipping app updates to GitHub, assign a new semantic version in package.json and package-lock.json. Include that version in the release commit and create a matching vX.Y.Z tag. Push the commit and tag, wait for the Windows release workflow to finish, and verify that the published installer, portable executable, and latest.yml match the new version. Do not reuse a published version: existing installations only detect higher versions. Keep GitHub operations headless.
