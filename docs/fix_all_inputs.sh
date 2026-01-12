#!/bin/bash

# Fix all remaining input/textarea/select elements across all components
for file in *.tsx; do
    if [ -f "$file" ]; then
        # Skip UIComponents.tsx as it's already correct
        if [ "$file" = "UIComponents.tsx" ]; then
            continue
        fi
        
        echo "Checking $file..."
        
        # Fix any remaining bg-white without dark mode on inputs
        sed -i 's/bg-white border/bg-white dark:bg-neutral-800 border/g' "$file"
        
        # Fix toggle backgrounds
        sed -i 's/bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300/bg-slate-200 dark:bg-neutral-700 peer-focus:ring-2 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-500\/50/g' "$file"
        
        # Fix text color on form elements if missing
        sed -i 's/outline-none"/outline-none text-slate-900 dark:text-white"/g' "$file"
        
        # Remove duplicate text-slate-900 dark:text-white if it exists
        sed -i 's/text-slate-900 dark:text-white text-slate-900 dark:text-white/text-slate-900 dark:text-white/g' "$file"
    fi
done

echo "All inputs fixed!"
