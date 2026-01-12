#!/bin/bash

# Fix input fields with poor dark mode visibility
for file in InventoryManager.tsx Settings.tsx; do
    if [ -f "$file" ]; then
        echo "Fixing inputs in $file..."
        
        # Fix input backgrounds - change dark:bg-neutral-950 to dark:bg-neutral-800
        sed -i 's/dark:bg-neutral-950/dark:bg-neutral-800/g' "$file"
        
        # Fix input borders - ensure dark:border-neutral-700
        sed -i 's/dark:border-neutral-800/dark:border-neutral-700/g' "$file"
        
        # Fix input text - ensure dark:text-white
        sed -i 's/dark:text-neutral-200/dark:text-white/g' "$file"
        
        # Fix placeholder text
        sed -i 's/dark:placeholder-neutral-600/dark:placeholder-neutral-500/g' "$file"
        
        echo "Fixed $file"
    fi
done

echo "All input fields fixed!"
