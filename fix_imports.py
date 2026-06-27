import os
import re

SRC_DIR = './src'

# Automatically collect all top-level files and folders in src/ to act as local names
LOCAL_NAMES = set()
for item in os.listdir(SRC_DIR):
    if item.endswith('.js'):
        LOCAL_NAMES.add(item[:-3])
    else:
        LOCAL_NAMES.add(item)

print(f"Local names in src/: {LOCAL_NAMES}")

def get_relative_path(from_file, to_import):
    # If it already ends with .glsl, don't append .js!
    if to_import.endswith('.glsl'):
        target_path = os.path.join(SRC_DIR, to_import)
    else:
        target_path = os.path.join(SRC_DIR, to_import + '.js')
    
    from_dir = os.path.dirname(from_file)
    rel_path = os.path.relpath(target_path, from_dir)
    rel_path = rel_path.replace(os.sep, '/')
    
    if not rel_path.startswith('.'):
        rel_path = './' + rel_path
        
    return rel_path

for root, _, files in os.walk(SRC_DIR):
    for file in files:
        if file.endswith('.js'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            modified = False
            
            # First, clean up any previous incorrect .glsl.js references in the file
            if '.glsl.js' in content:
                content = content.replace('.glsl.js', '.glsl')
                modified = True
                
            lines = content.split('\n')
            for i, line in enumerate(lines):
                match = re.search(r'(?:import|export)\s+.*?from\s+[\'"]([^\'"]+)[\'"]', line)
                if not match:
                    match = re.search(r'import\s+[\'"]([^\'"]+)[\'"]', line)
                    
                if match:
                    import_str = match.group(1)
                    parts = import_str.split('/')
                    first_part = parts[0]
                    
                    if first_part in LOCAL_NAMES:
                        if import_str == 'yagui':
                            continue
                            
                        # Extract clean import name (avoid double extensions)
                        if import_str.endswith('.js') and not import_str.endswith('.glsl.js'):
                            clean_import = import_str[:-3]
                        else:
                            clean_import = import_str
                            
                        new_rel_path = get_relative_path(filepath, clean_import)
                        lines[i] = line.replace(f"'{import_str}'", f"'{new_rel_path}'").replace(f'"{import_str}"', f"'{new_rel_path}'")
                        modified = True
            
            if modified:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write('\n'.join(lines))
                print(f"Updated imports in {filepath}")
