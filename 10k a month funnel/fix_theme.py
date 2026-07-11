import re

with open("index.html", "r") as f:
    content = f.read()

# Replace variables
content = content.replace("#0ea5e9", "#a855f7")
content = content.replace("#38bdf8", "#c084fc")
content = content.replace("#0284c7", "#7e22ce")

# Replace RGB values
content = content.replace("14, 165, 233", "168, 85, 247")
content = content.replace("14,165,233", "168,85,247")

# Fix overflow on body
content = content.replace("body { \n        margin: 0; padding: 0; \n        background: var(--ink); color: var(--text); \n        font-family: var(--sans); \n        -webkit-font-smoothing: antialiased; \n    }", "body { \n        margin: 0; padding: 0; \n        background: var(--ink); color: var(--text); \n        font-family: var(--sans); \n        -webkit-font-smoothing: antialiased; \n        overflow-x: hidden;\n    }")

# Fix engine-section positioning and overflow
content = content.replace(".engine-section {\n        background: var(--ink);\n    }", ".engine-section {\n        background: var(--ink);\n        position: relative;\n        overflow: hidden;\n    }")

with open("index.html", "w") as f:
    f.write(content)

print("Theme updated successfully!")
