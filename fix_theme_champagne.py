import re

with open("index.html", "r") as f:
    content = f.read()

# Replace main CSS variables and hex codes (from Purple to Champagne Gold)
content = content.replace("#a855f7", "#D4B886")
content = content.replace("#c084fc", "#E8D5AD")
content = content.replace("#7e22ce", "#A68A56")

# Replace RGB values
content = content.replace("168, 85, 247", "212, 184, 134")
content = content.replace("168,85,247", "212,184,134")

# Funnel replacement map
funnel_replaces = [
    # Step 1
    ("linear-gradient(90deg, #2a0e45, #3b1461, #2a0e45)", "linear-gradient(90deg, #302517, #423422, #302517)"),
    ("--r-fold: #1c0a2e", "--r-fold: #1c150c"),
    ("--r-text: #e9d5ff", "--r-text: #D4B886"),
    
    # Step 2
    ("linear-gradient(90deg, #3f1969, #55218c, #3f1969)", "linear-gradient(90deg, #4A3B26, #5C4930, #4A3B26)"),
    ("--r-fold: #2a0e45", "--r-fold: #302517"),
    ("--r-text: #f3e8ff", "--r-text: #E8D5AD"),
    
    # Step 3
    ("linear-gradient(90deg, #572591, #7131bf, #572591)", "linear-gradient(90deg, #695438, #7D6544, #695438)"),
    ("--r-fold: #3f1969", "--r-fold: #4A3B26"),
    
    # Step 4
    ("linear-gradient(90deg, #7434c4, #8c42eb, #7434c4)", "linear-gradient(90deg, #8C724E, #A1845B, #8C724E)"),
    ("--r-fold: #572591", "--r-fold: #695438"),
    
    # Step 5
    ("linear-gradient(90deg, #9042f5, #ab61fa, #9042f5)", "linear-gradient(90deg, #B09568, #C4A776, #B09568)"),
    ("--r-fold: #7434c4", "--r-fold: #8C724E"),
    
    # Step 6
    ("linear-gradient(90deg, #D4B886, #d8b4fe, #D4B886)", "linear-gradient(90deg, #D4B886, #E8D5AD, #D4B886)"), # Note: #a855f7 was replaced by #D4B886 globally before this
    ("--r-fold: #8c42eb", "--r-fold: #B09568")
]

for old_val, new_val in funnel_replaces:
    content = content.replace(old_val, new_val)

with open("index.html", "w") as f:
    f.write(content)

print("Theme updated to Champagne Gold successfully!")
