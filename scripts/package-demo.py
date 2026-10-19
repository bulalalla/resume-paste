from pathlib import Path
import sys,zipfile
root=Path(__file__).resolve().parents[1]
output=Path(sys.argv[1]) if len(sys.argv)>1 else root/'release/resume-paste-demo.zip'
output.parent.mkdir(parents=True,exist_ok=True)
required=['test-resume.json','test-resume.pdf','test-resume.md','materials/学历证明-示例.pdf']
for item in required:
    if not (root/'examples'/item).is_file():raise SystemExit('Missing demo file: '+item)
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
    for name in required:archive.write(root/'examples'/name,name)
    archive.write(root/'docs/使用教程.md','使用教程.md')
    archive.write(root/'提取提示词.txt','提取提示词.txt')
print('Created '+str(output))
