# Temporary debugging script used to find UI elements in index.html

import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'c:\Users\prasanth\OneDrive\Desktop\PRASANTH projects\clg canteen\index.html'

try:
    with open(path, 'rb') as f:
        content = f.read().decode('utf-8')
        
    print("Looking for string matches in index.html...")
    idx = content.find('cartFooter')
    print('cartFooter index:', idx)
    
except Exception as e:
    print(f"Error accessing file: {e}")
