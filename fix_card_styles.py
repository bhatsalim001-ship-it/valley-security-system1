import re

with open('public/app.js', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

original = content

# 1. Replace label TDs: subtextColor -> labelColor, padding 2px -> rowPadding, width 45% -> labelWidth
content = content.replace(
    'font-weight: 600; color: ${subtextColor}; padding: 2px 0; width: 45%;',
    'font-weight: 600; color: ${labelColor}; padding: ${rowPadding}px 0; width: ${labelWidth}%;'
)

# 2. Replace value TDs (nowrap ones): textColor -> valueColor, padding 2px -> rowPadding
content = content.replace(
    'font-weight: 700; color: ${textColor}; padding: 2px 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
    'font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
)

# 3. Replace value TDs (wrap ones for dept/address): textColor -> valueColor
content = content.replace(
    'font-weight: 700; color: ${textColor}; padding: 2px 0; text-align: right; white-space: normal; line-height: 1.1; word-break: break-word;',
    'font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; text-align: right; white-space: normal; line-height: 1.1; word-break: break-word;'
)
content = content.replace(
    'font-weight: 700; color: ${textColor}; padding: 2px 0; text-align: right; white-space: normal; line-height: 1.1;',
    'font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; text-align: right; white-space: normal; line-height: 1.1;'
)

changed = content.count('${labelColor}')
print(f'labelColor replacements in output: {changed}')
print(f'valueColor replacements in output: {content.count("${valueColor}")}')
print(f'rowPadding replacements: {content.count("${rowPadding}")}')
print(f'labelWidth replacements: {content.count("${labelWidth}")}')
print(f'Content changed: {content != original}')

with open('public/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
