# Script used to inject Razorpay checkout script into index.html
import sys
import os

path = r'c:\Users\prasanth\OneDrive\Desktop\PRASANTH projects\clg canteen\index.html'

try:
    with open(path, 'rb') as f:
        content = f.read().decode('utf-8')
        
    old_head_end = '</head>'
    new_head_end = '    <!-- Razorpay Checkout Script -->\n    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>\n</head>'
    
    if '</head>' in content and 'checkout.razorpay.com' not in content:
        content = content.replace(old_head_end, new_head_end)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Successfully injected Razorpay script")
    else:
        print("Script already exists or </head> not found")
        
except Exception as e:
    print(f"File modified manually or via AI. Details: {e}")

