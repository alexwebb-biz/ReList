#!/bin/bash
# Dark Mode Fix Script for ReList Application

echo "Fixing dark mode colors across all components..."

# Find all TSX files in components directory
find components -name "*.tsx" -type f | while read file; do
    echo "Processing: $file"
    
    # Backup original file
    cp "$file" "$file.bak"
    
    # Fix common light color patterns
    sed -i 's/text-gray-600/text-slate-600 dark:text-neutral-400/g' "$file"
    sed -i 's/text-gray-500/text-slate-500 dark:text-neutral-400/g' "$file"
    sed -i 's/text-gray-900/text-slate-900 dark:text-white/g' "$file"
    sed -i 's/text-gray-800/text-slate-800 dark:text-neutral-200/g' "$file"
    sed -i 's/text-gray-700/text-slate-700 dark:text-neutral-300/g' "$file"
    sed -i 's/text-gray-400/text-slate-400 dark:text-neutral-500/g' "$file"
    
    sed -i 's/bg-gray-50/bg-slate-50 dark:bg-neutral-800/g' "$file"
    sed -i 's/bg-gray-100/bg-slate-100 dark:bg-neutral-800/g' "$file"
    sed -i 's/bg-gray-200/bg-slate-200 dark:bg-neutral-700/g' "$file"
    
    sed -i 's/border-gray-200/border-slate-200 dark:border-neutral-700/g' "$file"
    sed -i 's/border-gray-300/border-slate-300 dark:border-neutral-600/g' "$file"
    
    sed -i 's/hover:bg-gray-50/hover:bg-slate-50 dark:hover:bg-neutral-800\/50/g' "$file"
    sed -i 's/hover:bg-gray-100/hover:bg-slate-100 dark:hover:bg-neutral-800\/50/g' "$file"
    
    sed -i 's/divide-gray-200/divide-slate-200 dark:divide-neutral-700/g' "$file"
    
    echo "  ✓ Fixed $file"
done

echo "Dark mode fixes complete! Backups saved with .bak extension"
