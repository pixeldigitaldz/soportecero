#!/bin/bash
# SoporteCero - Weekly Auto-Compiler and Deployer Script

# Navigate to the repository directory
cd /home/castroalaver/SoporteCero || exit 1

# Pull any new Markdown posts or edits pushed from other machines/sessions
git pull origin main --rebase

# Compile the site (Markdown -> HTML + Sitemap + Index Grid)
npm run build

# Check if compiling generated any new files or modifications
if [[ -n $(git status --porcelain) ]]; then
  echo "[$(date)] Changes detected. Staging and committing..."
  git add .
  git commit -m "Automated Compilation: Weekly build and layout deployment"
  git push origin main
else
  echo "[$(date)] No new changes to deploy."
fi
