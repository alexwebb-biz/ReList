#!/bin/bash

# Comprehensive dark mode color fix script for all component files
# This script applies consistent slate/neutral color palette with dark mode variants

cd "$(dirname "$0")/components"

echo "Applying dark mode color fixes to all component files..."

# Function to fix colors in a file
fix_file_colors() {
  local file="$1"
  echo "Processing $file..."

  # Skip backup directory
  if [[ "$file" == *"backup-before-dark-mode-fixes"* ]]; then
    return
  fi

  # Fix text colors
  sed -i 's/text-gray-900\([^-]\)/text-slate-900 dark:text-white\1/g' "$file"
  sed -i 's/text-gray-800\([^-]\)/text-slate-800 dark:text-neutral-200\1/g' "$file"
  sed -i 's/text-gray-700\([^-]\)/text-slate-700 dark:text-neutral-300\1/g' "$file"
  sed -i 's/text-gray-600\([^-]\)/text-slate-600 dark:text-neutral-400\1/g' "$file"
  sed -i 's/text-gray-500\([^-]\)/text-slate-500 dark:text-neutral-400\1/g' "$file"
  sed -i 's/text-gray-400\([^-]\)/text-slate-400 dark:text-neutral-500\1/g' "$file"
  sed -i 's/text-gray-300\([^-]\)/text-slate-300 dark:text-neutral-600\1/g' "$file"

  # Fix background colors
  sed -i 's/bg-gray-50\([^-]\)/bg-slate-50 dark:bg-neutral-800\/50\1/g' "$file"
  sed -i 's/bg-gray-100\([^-]\)/bg-slate-100 dark:bg-neutral-700\1/g' "$file"
  sed -i 's/bg-gray-200\([^-]\)/bg-slate-200 dark:bg-neutral-700\1/g' "$file"
  sed -i 's/bg-gray-800\([^-]\)/bg-slate-800 dark:bg-neutral-900\1/g' "$file"
  sed -i 's/bg-gray-900\([^-]\)/bg-slate-900 dark:bg-neutral-950\1/g' "$file"

  # Fix border colors
  sed -i 's/border-gray-200\([^-]\)/border-slate-200 dark:border-neutral-700\1/g' "$file"
  sed -i 's/border-gray-300\([^-]\)/border-slate-300 dark:border-neutral-600\1/g' "$file"
  sed -i 's/border-gray-400\([^-]\)/border-slate-400 dark:border-neutral-500\1/g' "$file"

  # Fix divide colors
  sed -i 's/divide-gray-200\([^-]\)/divide-slate-200 dark:divide-neutral-700\1/g' "$file"
  sed -i 's/divide-gray-300\([^-]\)/divide-slate-300 dark:divide-neutral-600\1/g' "$file"

  # Fix hover backgrounds
  sed -i 's/hover:bg-gray-50\([^-]\)/hover:bg-slate-50 dark:hover:bg-neutral-800\/50\1/g' "$file"
  sed -i 's/hover:bg-gray-100\([^-]\)/hover:bg-slate-100 dark:hover:bg-neutral-700\1/g' "$file"

  # Fix hover text colors
  sed -i 's/hover:text-gray-700\([^-]\)/hover:text-slate-700 dark:hover:text-neutral-300\1/g' "$file"
  sed -i 's/hover:text-gray-600\([^-]\)/hover:text-slate-600 dark:hover:text-neutral-400\1/g' "$file"

  # Fix placeholder colors
  sed -i 's/placeholder-gray-400\([^-]\)/placeholder-slate-400 dark:placeholder-neutral-500\1/g' "$file"
  sed -i 's/placeholder-gray-500\([^-]\)/placeholder-slate-500 dark:placeholder-neutral-400\1/g' "$file"

  # Fix ring colors
  sed -i 's/ring-gray-300\([^-]\)/ring-slate-300 dark:ring-neutral-600\1/g' "$file"

  # Fix specific badge/pill color patterns that might be using gray
  sed -i 's/bg-gray-100 text-gray-800\([^-]\)/bg-slate-100 dark:bg-neutral-700 text-slate-800 dark:text-neutral-300\1/g' "$file"
}

# Process all TSX files except those in backup directory
for file in *.tsx; do
  if [ -f "$file" ]; then
    fix_file_colors "$file"
  fi
done

echo "Dark mode color fixes applied successfully!"
echo "Original files are backed up in: components/backup-before-dark-mode-fixes/"
